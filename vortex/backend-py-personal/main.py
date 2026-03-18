from fastapi import FastAPI, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk import Agent, AgentTool
from google.adk.models.gemini import Gemini
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import GoogleSearch
from google.adk.code_executors import BuiltInCodeExecutor
from google.genai import types
import uuid
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared session service for personal backend
session_service = InMemorySessionService()
runners = {}

@app.post("/api/v1/models")
async def fetch_models(request: Dict = Body(...)):
    return {"models": ["gemini-2.0-flash", "gemini-1.5-pro"]}

@app.post("/api/v1/sessions")
async def create_session(request: Dict = Body(...)):
    return {
        "id": f"pers-{uuid.uuid4()}",
        "name": request.get("initial_message", "New Personal Chat")[:30],
        "model": request["model"],
        "mode": "code",
        "created_at": "now"
    }

@app.post("/api/v1/transcribe")
async def transcribe():
    return {"text": "Personal audio processed."}

@app.post("/api/v1/chat")
async def chat(
    session_id: str = Form(...),
    content: str = Form(...),
    model_name: str = Form("gemini-2.0-flash"),
    api_key: str = Form(...)
):
    model = Gemini(model_name=model_name, api_key=api_key)

    if model_name not in runners:
        # Specialized Experts
        search_expert = Agent(name="SearchExpert", model=model, tools=[GoogleSearch()])
        code_executor = Agent(name="CodeExecutionExpert", model=model, code_executor=BuiltInCodeExecutor())
        
        # Root Assistant
        orchestrator = Agent(
            name="PersonalAssistant", 
            model=model,
            instruction="Personal Code Assistant. Delegate to search/code tools.",
            tools=[AgentTool(agent=search_expert), AgentTool(agent=code_executor)]
        )
        runners[model_name] = Runner(agent=orchestrator, app_name="VortexPersonal", session_service=session_service)

    runner = runners[model_name]
    try:
        response = ""
        user_content = types.Content.from_parts([types.Part.from_text(content)])
        for event in runner.run(user_id="user", session_id=session_id, content=user_content):
            if event.final_response:
                response += event.stringify_content()
        return {"role": "assistant", "content": response}
    except Exception as e:
        return {"role": "assistant", "content": f"Personal Engine Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)