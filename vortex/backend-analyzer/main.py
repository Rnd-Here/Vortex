import os
import logging
import litellm
from fastapi import FastAPI, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel
from typing import List, Optional

# Enable LiteLLM Proxy
litellm.use_litellm_proxy = True

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    file_content: str
    file_path: Optional[str] = "unnamed_file"
    cursor_line: Optional[int] = 0
    api_key: str

class AnalysisResponse(BaseModel):
    suggestions: List[str]

# Global session service for analyzer
session_service = InMemorySessionService()

def setup_analyzer_agent(model_name: str):
    model = LiteLlm(model=model_name)
    
    # Specialized Agent for Logic Optimization
    logic_optimizer = Agent(
        name="LogicOptimizer",
        model=model,
        instruction=(
            "You are a Senior Code Reviewer. Analyze the provided code snippet.\n"
            "Focus on:\n"
            "1. Spotting suboptimal logic (e.g., using manual loops for operations that have built-in functions like average, sum, map).\n"
            "2. Suggesting modern language features (e.g., Python list comprehensions, Java Streams).\n"
            "3. Improving readability and performance.\n"
            "Output only a list of concise, actionable suggestions."
        )
    )
    
    return Runner(agent=logic_optimizer, app_name="VortexAnalyzer", session_service=session_service)

@app.post("/api/v1/analyze")
async def analyze_code(request: AnalysisRequest):
    # Set environment for LiteLLM Proxy
    os.environ["LITELLM_PROXY_API_KEY"] = request.api_key
    os.environ["LITELLM_PROXY_API_BASE"] = os.getenv("LITELLM_PROXY_BASE_URL", "http://localhost:4000")

    # Use a fast model for real-time analysis
    model_name = "gemini-1.5-flash"
    runner = setup_analyzer_agent(model_name)

    try:
        prompt = f"File: {request.file_path}\nContent:\n{request.file_content}\n\nCursor is around line: {request.cursor_line}"
        content = types.Content.from_parts([types.Part.from_text(prompt)])
        
        response_text = ""
        # Analysis is a one-shot turn per request
        for event in runner.run(user_id="dev", session_id="analysis-temp", content=content):
            if event.final_response:
                response_text += event.stringify_content()
        
        # Parse output into lines
        suggestions = [s.strip("- ") for s in response_text.split("\n") if s.strip()]
        return {"suggestions": suggestions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)