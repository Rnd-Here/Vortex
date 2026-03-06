from fastapi import FastAPI, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.agents import LlmAgent
from google.adk.models.gemini import Gemini
from google.adk.runner import InMemoryRunner
from google.adk.tools import BuiltInCodeExecutionTool, GoogleSearchTool
from google.genai.types import Content, Part
import uuid
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for personal use (stateless)
session_cache = {}

@app.post("/api/v1/models")
async def fetch_models(request: Dict = Body(...)):
    # Standard Gemini models
    return {"models": ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"]}

@app.post("/api/v1/sessions")
async def create_session(request: Dict = Body(...)):
    # Stateless session creation for personal backend
    return {
        "id": f"pers-{uuid.uuid4()}",
        "name": request.get("initial_message", "New Personal Chat")[:30],
        "model": request["model"],
        "mode": "code",
        "created_at": "now"
    }

@app.post("/api/v1/chat")
async def chat(
    session_id: str = Form(...),
    content: str = Form(...),
    model_name: str = Form("gemini-2.0-flash"),
    api_key: str = Form(...)
):
    # 1. Initialize Direct Gemini Model
    model = Gemini(model_name=model_name, api_key=api_key)

    # 2. Setup Nested "Agent as Tool" pattern
    search_expert = LlmAgent(name="SearchExpert", model=model, tools=[GoogleSearchTool()])
    code_executor = LlmAgent(name="CodeExecutionExpert", model=model, tools=[BuiltInCodeExecutionTool()])
    
    orchestrator = LlmAgent(
        name="PersonalCodeAssistant", 
        model=model,
        instruction="You are a personal coding assistant. Use SearchExpert for info and CodeExecutionExpert to run code.",
        sub_agents=[search_expert, code_executor]
    )

    runner = session_cache.get(session_id)
    if not runner:
        runner = InMemoryRunner(orchestrator)
        session_cache[session_id] = runner

    try:
        response = ""
        user_content = Content.from_parts([Part.from_text(content)])
        for event in runner.run(user_id="user", session_id=session_id, content=user_content):
            if event.final_response:
                response += event.stringify_content()
        
        return {"role": "assistant", "content": response}
    except Exception as e:
        return {"role": "assistant", "content": f"Personal Engine Error: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)