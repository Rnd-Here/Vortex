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

    def process_multimodal_request(self, model_name: str, api_key: str, session_id: str, query: str, file_data: Optional[bytes] = None, mime_type: Optional[str] = None, filename: Optional[str] = None) -> str:
        
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
                # No more [MODE] tag - just the raw or file-enhanced query
                content = types.Content.from_parts([types.Part.from_text(enhanced_query)] + parts_list)

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
            """Searches internal organizational documentation and policies."""
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
            description="Accesses the internal organization knowledge base for policies, guidelines, and company data.",
            tools=[FunctionTool.from_function(search_org_docs)]
        )

        # 2. Compound Managers
        code_assistant = Agent(
            name="CodeAssistant", model=model,
            description="Specialist in coding, algorithms, and math.",
            tools=[AgentTool(agent=search_expert), AgentTool(agent=code_executor_expert)]
        )
        
        org_assistant = Agent(
            name="OrgAssistant", model=model,
            description="Specialist in organizational data and internal knowledge.",
            tools=[AgentTool(agent=rag_expert)]
        )

        # 3. Unified Root Orchestrator
        return Agent(
            name="Orchestrator", model=model,
            instruction=(
                "You are the VORTEX Intelligent Router. Analyze the user query and delegate to the correct specialist:\n"
                "1. If the query is about code, math, or logic -> Delegate to CodeAssistant.\n"
                "2. If the query is about company policies, internal data, or organizational info -> Delegate to OrgAssistant.\n"
                "3. If the query is general and requires real-time info -> Delegate to CodeAssistant (for SearchExpert).\n"
                "Maintain a professional, helpful tone."
            ),
            tools=[AgentTool(agent=code_assistant), AgentTool(agent=org_assistant)]
        )