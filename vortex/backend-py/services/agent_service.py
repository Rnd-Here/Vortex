import os
import logging
from typing import Optional, List
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runner import InMemoryRunner
from google.adk.sessions import Session
from google.adk.events import Event
from google.adk.tools import BuiltInCodeExecutionTool, GoogleSearchTool
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
        
        # Start an explicit span for the agentic request
        with tracer.start_as_current_span("vortex_agent_request") as span:
            span.set_attribute("vortex.mode", mode)
            span.set_attribute("vortex.model", model_name)
            span.set_attribute("vortex.session_id", session_id)

            parts_list = []
            enhanced_query = query

            # 1. Handle File Attachment
            if file_data:
                with tracer.start_as_current_span("file_processing"):
                    if mime_type and mime_type.startswith("image/"):
                        parts_list.append(Part(inline_data=Blob(mime_type=mime_type, data=file_data)))
                    else:
                        try:
                            extracted_text = file_data.decode('utf-8', errors='ignore')
                            enhanced_query = f"ATTACHED_FILE: {filename}\nCONTENT:\n{extracted_text}\n\nUSER_QUERY: {query}"
                        except:
                            pass

            # 2. RAG Enrichment
            if mode.lower() == "org":
                with tracer.start_as_current_span("chromadb_retrieval"):
                    chroma_context = self.chroma_service.query_knowledge(query, api_key)
                    if chroma_context:
                        enhanced_query = f"INTERNAL_DOCS:\n{chroma_context}\n\n{enhanced_query}"

            # 3. Configure the Model
            model = LiteLlm(
                model_name=model_name,
                api_base=self.proxy_base_url,
                api_key=api_key
            )

            # 4. Get or Create Runner
            if model_name not in self.runner_cache:
                orchestrator = self._setup_agents(model)
                self.runner_cache[model_name] = InMemoryRunner(orchestrator)
            
            runner = self.runner_cache[model_name]

            # 5. Context Compression Check
            self._compress_history_if_necessary(runner, session_id, model)

            try:
                final_prompt = f"[SESSION_MODE: {mode.upper()}] {enhanced_query}"
                parts_list.append(Part.from_text(final_prompt))
                multimodal_content = Content.from_parts(parts_list)

                response = ""
                with tracer.start_as_current_span("adk_runner_execution"):
                    for event in runner.run(user_id="user", session_id=session_id, content=multimodal_content):
                        if event.final_response:
                            response += event.stringify_content()
                
                return response
            except Exception as e:
                logger.error(f"ADK Execution Error: {e}")
                return f"Vortex (Py) Connection Exception: {e}"

    def _compress_history_if_necessary(self, runner: InMemoryRunner, session_id: str, model: LiteLlm):
        try:
            session = runner.session_service.get_session(app_id="Vortex", user_id="user", session_id=session_id)
            if session and len(session.events) > self.compression_threshold:
                with tracer.start_as_current_span("context_compression"):
                    logger.info(f"Compressing context for session: {session_id}")
                    
                    history_dump = "\n".join([e.stringify_content() for e in session.events])
                    
                    summarizer = LlmAgent(name="Summarizer", model=model, instruction="Summarize history.")
                    temp_runner = InMemoryRunner(summarizer)
                    
                    summary = ""
                    for event in temp_runner.run(user_id="system", session_id="temp-sum", content=Content.from_parts([Part.from_text(f"History to summarize:\n{history_dump}")])):
                        if event.final_response:
                            summary += event.stringify_content()
                    
                    session.events.clear()
                    session.events.append(Event(author="System", content=Content.from_parts([Part.from_text(f"FOUNDATIONAL_SUMMARY: {summary}")])))
        except Exception as e:
            logger.warning(f"Compression sequence failed: {e}")

    def _setup_agents(self, model: LiteLlm) -> LlmAgent:
        code_agent = LlmAgent(
            name="CodeAgent",
            model=model,
            instruction="You are an expert Code Assistant.",
            tools=[BuiltInCodeExecutionTool(), GoogleSearchTool()]
        )

        org_assistant = LlmAgent(
            name="OrgAssistant",
            model=model,
            instruction="Internal Org Assistant."
        )

        orchestrator = LlmAgent(
            name="Orchestrator",
            model=model,
            instruction="Route queries appropriately.",
            sub_agents=[code_agent, org_assistant]
        )
        return orchestrator