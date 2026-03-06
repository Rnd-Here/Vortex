import os
import logging
from typing import Optional, List
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runner import InMemoryRunner
from google.adk.sessions import Session
from google.adk.events import Event
from google.adk.tools import BuiltInCodeExecutionTool, GoogleSearchTool, FunctionTool
from google.genai.types import Content, Part, Blob
from services.chroma_service import ChromaService
from opentelemetry import trace

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

class AgentService:
    def __init__(self):
        self.chroma_service = ChromaService()
        self.proxy_base_url = os.getenv("LITELLM_PROXY_BASE_URL", "https://internal-llm-proxy.company.com")
        self.compression_threshold = 15
        self.runner_cache = {}

    def process_multimodal_request(self, mode: str, model_name: str, api_key: str, session_id: str, query: str, file_data: Optional[bytes] = None, mime_type: Optional[str] = None, filename: Optional[str] = None) -> str:
        
        with tracer.start_as_current_span("vortex_agent_request") as span:
            span.set_attribute("vortex.mode", mode)
            span.set_attribute("vortex.model", model_name)

            parts_list = []
            enhanced_query = query

            if file_data:
                if mime_type and mime_type.startswith("image/"):
                    parts_list.append(Part(inline_data=Blob(mime_type=mime_type, data=file_data)))
                else:
                    try:
                        extracted_text = file_data.decode('utf-8', errors='ignore')
                        enhanced_query = f"ATTACHED_FILE: {filename}\nCONTENT:\n{extracted_text}\n\nUSER_QUERY: {query}"
                    except:
                        pass

            model = LiteLlm(model_name=model_name, api_base=self.proxy_base_url, api_key=api_key)

            if model_name not in self.runner_cache:
                orchestrator = self._setup_agents(model, api_key)
                self.runner_cache[model_name] = InMemoryRunner(orchestrator)
            
            runner = self.runner_cache[model_name]
            self._compress_history_if_necessary(runner, session_id, model)

            try:
                final_prompt = f"[SESSION_MODE: {mode.upper()}] {enhanced_query}"
                parts_list.append(Part.from_text(final_prompt))
                multimodal_content = Content.from_parts(parts_list)

                response = ""
                for event in runner.run(user_id="user", session_id=session_id, content=multimodal_content):
                    if event.final_response:
                        response += event.stringify_content()
                return response
            except Exception as e:
                return f"Vortex (Py) Agentic Error: {e}"

    def _compress_history_if_necessary(self, runner: InMemoryRunner, session_id: str, model: LiteLlm):
        try:
            session = runner.session_service.get_session(app_id="Vortex", user_id="user", session_id=session_id)
            if session and len(session.events) > self.compression_threshold:
                history_dump = "\n".join([e.stringify_content() for e in session.events])
                summarizer = LlmAgent(name="Summarizer", model=model, instruction="Summarize history.")
                temp_runner = InMemoryRunner(summarizer)
                summary = ""
                for event in temp_runner.run(user_id="system", session_id="temp-sum", content=Content.from_parts([Part.from_text(f"History:\n{history_dump}")])):
                    if event.final_response: summary += event.stringify_content()
                session.events.clear()
                session.events.append(Event(author="System", content=Content.from_parts([Part.from_text(f"SUMMARY: {summary}")])))
        except: pass

    def _setup_agents(self, model: LiteLlm, api_key: str) -> LlmAgent:
        
        # --- ENHANCED: Agentic RAG Tool with Filtering ---
        def search_org_docs(query: str, filename_filter: Optional[str] = None) -> str:
            """
            Searches internal organizational docs. 
            Args:
                query: The search string.
                filename_filter: Optional. If the user mentions a specific file (e.g. 'policy.pdf'), provide it here.
            """
            return self.chroma_service.search_docs(query, api_key, filename_filter)

        search_expert = LlmAgent(
            name="SearchExpert", model=model, 
            instruction="Use Google Search tool for real-time web info.",
            tools=[GoogleSearchTool()]
        )
        code_executor = LlmAgent(
            name="CodeExecutionExpert", model=model,
            instruction="Use Built-in Code Execution to run Python.",
            tools=[BuiltInCodeExecutionTool()]
        )
        
        # RAG Expert with metadata awareness
        rag_expert = LlmAgent(
            name="OrgKnowledgeExpert", model=model,
            instruction="Expert in internal docs. Use 'search_org_docs'. You can filter by filename if the user mentions one.",
            tools=[FunctionTool.from_function(search_org_docs)]
        )

        code_assistant = LlmAgent(
            name="CodeAssistant", model=model,
            instruction="Code Expert. Delegate to SearchExpert or CodeExecutionExpert.",
            sub_agents=[search_expert, code_executor]
        )

        org_assistant = LlmAgent(
            name="OrgAssistant", model=model,
            instruction="Internal Org Assistant. Delegate to OrgKnowledgeExpert for doc searches.",
            sub_agents=[rag_expert]
        )

        return LlmAgent(
            name="Orchestrator", model=model,
            instruction="Route to CodeAssistant or OrgAssistant based on [SESSION_MODE].",
            sub_agents=[code_assistant, org_assistant]
        )