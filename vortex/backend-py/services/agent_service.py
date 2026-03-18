import os
import logging
import litellm
from typing import Optional, List
from google.adk import Agent, AgentTool
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.events import Event
from google.adk.tools import GoogleSearch, FunctionTool
from google.adk.code_executors import BuiltInCodeExecutor
from google.genai import types
from services.chroma_service import ChromaService
from opentelemetry import trace

# Enable Global LiteLLM Proxy Support
litellm.use_litellm_proxy = True

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

class AgentService:
    def __init__(self):
        self.chroma_service = ChromaService()
        self.session_service = InMemorySessionService()
        self.compression_threshold = 15
        self.runners = {}

    def process_multimodal_request(self, mode: str, model_name: str, api_key: str, session_id: str, query: str, file_data: Optional[bytes] = None, mime_type: Optional[str] = None, filename: Optional[str] = None) -> str:
        
        os.environ["LITELLM_PROXY_API_KEY"] = api_key
        os.environ["LITELLM_PROXY_API_BASE"] = os.getenv("LITELLM_PROXY_BASE_URL")

        with tracer.start_as_current_span("vortex_agent_request") as span:
            parts_list = []
            enhanced_query = query

            if file_data:
                if mime_type and mime_type.startswith("image/"):
                    parts_list.append(types.Part(inline_data=types.Blob(mime_type=mime_type, data=file_data)))
                else:
                    try:
                        extracted_text = file_data.decode('utf-8', errors='ignore')
                        enhanced_query = f"FILE: {filename}\nCONTENT:\n{extracted_text}\n\nUSER: {query}"
                    except: pass

            model = LiteLlm(model=model_name)

            if model_name not in self.runners:
                orchestrator = self._setup_agents(model, api_key)
                self.runners[model_name] = Runner(
                    agent=orchestrator,
                    app_name="Vortex",
                    session_service=self.session_service
                )
            
            runner = self.runners[model_name]
            self._compress_history_if_necessary(session_id, model)

            try:
                final_prompt = f"[MODE: {mode.upper()}] {enhanced_query}"
                parts_list.append(types.Part.from_text(final_prompt))
                content = types.Content.from_parts(parts_list)

                response = ""
                for event in runner.run(user_id="user", session_id=session_id, content=content):
                    if event.final_response:
                        response += event.stringify_content()
                return response
            except Exception as e:
                logger.error(f"Execution Error: {e}")
                return f"Vortex Error: {e}"

    def _compress_history_if_necessary(self, session_id: str, model: LiteLlm):
        try:
            session = self.session_service.get_session(app_id="Vortex", user_id="user", session_id=session_id)
            if session and len(session.events) > self.compression_threshold:
                history_dump = "\n".join([e.stringify_content() for e in session.events])
                summarizer = Agent(name="Summarizer", model=model, instruction="Summarize concisely.")
                temp_runner = Runner(agent=summarizer, app_name="Vortex", session_service=InMemorySessionService())
                summary = ""
                for event in temp_runner.run(user_id="sys", session_id="sum", content=types.Content.from_parts([types.Part.from_text(f"Summarize:\n{history_dump}")])):
                    if event.final_response: summary += event.stringify_content()
                session.events.clear()
                session.events.append(Event(author="System", content=types.Content.from_parts([Part.from_text(f"SUMMARY: {summary}")])))
        except: pass

    def _setup_agents(self, model: LiteLlm, api_key: str) -> Agent:
        def search_org_docs(query: str) -> str:
            """Searches internal organizational documentation."""
            return self.chroma_service.search_docs(query, api_key)

        # 1. Specialized Atomic Experts
        search_expert = Agent(
            name="SearchExpert", model=model, 
            description="Searches the web for real-time information.",
            tools=[GoogleSearch()] 
        )
        
        code_executor_expert = Agent(
            name="CodeExecutionExpert", model=model,
            description="Executes Python code to perform math or logic.",
            code_executor=BuiltInCodeExecutor() 
        )
        
        rag_expert = Agent(
            name="OrgKnowledgeExpert", model=model,
            description="Accesses the internal organization knowledge base.",
            tools=[FunctionTool.from_function(search_org_docs)]
        )

        # 2. Compound Managers (Wrapping sub-agents as tools)
        code_assistant = Agent(
            name="CodeAssistant", model=model,
            instruction="You are a Code Expert. Delegate tasks to specialists.",
            tools=[AgentTool(agent=search_expert), AgentTool(agent=code_executor_expert)]
        )
        
        org_assistant = Agent(
            name="OrgAssistant", model=model,
            instruction="Internal Org Assistant. Delegate to OrgKnowledgeExpert.",
            tools=[AgentTool(agent=rag_expert)]
        )

        # 3. Root Orchestrator
        return Agent(
            name="Orchestrator", model=model,
            instruction=(
                "Analyze [MODE] and query.\n"
                "1. If [MODE: CODE], delegate to CodeAssistant.\n"
                "2. If [MODE: ORG], evaluate if the query is organizational. If yes, delegate to OrgAssistant. If no, reject."
            ),
            tools=[AgentTool(agent=code_assistant), AgentTool(agent=org_assistant)]
        )