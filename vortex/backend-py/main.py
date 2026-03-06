from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
import uuid
from models import Base, Session as DBSession, Message as DBMessage
from services.security_service import SecurityService
from services.agent_service import AgentService
from services.chroma_service import ChromaService
from services.ingestion_service import IngestionService
from datetime import datetime
import litellm
from typing import Optional, List, Dict
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runner import InMemoryRunner
from google.adk.tools import BuiltInCodeExecutionTool, GoogleSearchTool
from google.genai.types import Content, Part
from tika import parser

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB Setup - Points to shared backend data directory
DB_URL = os.getenv("SPRING_DATASOURCE_URL", "sqlite:///../backend/data/chat_app.db").replace("jdbc:sqlite:", "sqlite:///")
engine = create_engine(DB_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

# Services
security_service = SecurityService()
agent_service = AgentService()
chroma_service = ChromaService()
ingestion_service = IngestionService(chroma_service)

@app.post("/api/v1/models")
async def fetch_models(request: Dict = Body(...)):
    api_key = request.get("api_key")
    proxy_url = os.getenv("LITELLM_PROXY_BASE_URL")
    try:
        response = litellm.model_list(api_base=proxy_url, api_key=api_key)
        models = [m.get("id") for m in response.get("data", [])]
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

@app.post("/api/v1/sessions")
async def create_session(request: Dict = Body(...)):
    db = SessionLocal()
    try:
        encrypted_key = security_service.encrypt(request["api_key"])
        key_hash = security_service.hash_api_key(request["api_key"])
        
        new_session = DBSession(
            encrypted_api_key=encrypted_key,
            api_key_hash=key_hash,
            name=request.get("initial_message", "New Chat")[:30],
            model=request["model"],
            mode=request["mode"]
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        
        user_msg = DBMessage(session_id=new_session.id, role="user", content=request["initial_message"])
        db.add(user_msg)
        db.commit()
        
        return {
            "id": new_session.id,
            "name": new_session.name,
            "model": new_session.model,
            "mode": new_session.mode,
            "created_at": new_session.created_at.isoformat()
        }
    finally:
        db.close()

@app.post("/api/v1/sessions/filter")
async def get_sessions(request: Dict = Body(...)):
    api_key = request.get("api_key") or request.get("apiKey")
    if not api_key: return []
    
    key_hash = security_service.hash_api_key(api_key)
    db = SessionLocal()
    try:
        sessions = db.query(DBSession).filter(DBSession.api_key_hash == key_hash).order_by(DBSession.created_at.desc()).all()
        return [{
            "id": s.id,
            "name": s.name,
            "model": s.model,
            "mode": s.mode,
            "created_at": s.created_at.isoformat()
        } for s in sessions]
    finally:
        db.close()

@app.get("/api/v1/sessions/{session_id}/messages")
async def get_messages(session_id: str):
    db = SessionLocal()
    try:
        messages = db.query(DBMessage).filter(DBMessage.session_id == session_id).order_by(DBMessage.timestamp.asc()).all()
        return [{
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp.isoformat()
        } for m in messages]
    finally:
        db.close()

@app.post("/api/v1/chat")
async def chat(
    session_id: str = Form(...),
    content: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    db = SessionLocal()
    try:
        session = db.query(DBSession).filter(DBSession.id == session_id).first()
        if not session: raise HTTPException(status_code=404, detail="Session not found")
        
        # Save user message
        user_msg_content = content + (f" [Attachment: {file.filename}]" if file else "")
        user_msg = DBMessage(session_id=session_id, role="user", content=user_msg_content)
        db.add(user_msg)
        db.commit()
        
        api_key = security_service.decrypt(session.encrypted_api_key)
        
        # Process with ADK
        file_data = await file.read() if file else None
        response_text = agent_service.process_multimodal_request(
            mode=session.mode,
            model_name=session.model,
            api_key=api_key,
            session_id=session_id,
            query=content,
            file_data=file_data,
            mime_type=file.content_type if file else None,
            filename=file.filename if file else None
        )
        
        # Save assistant message
        assistant_msg = DBMessage(session_id=session_id, role="assistant", content=response_text)
        db.add(assistant_msg)
        db.commit()
        
        return {"role": "assistant", "content": response_text}
    finally:
        db.close()

@app.patch("/api/v1/sessions/{session_id}")
async def update_session(session_id: str, body: Dict = Body(...)):
    db = SessionLocal()
    try:
        session = db.query(DBSession).filter(DBSession.id == session_id).first()
        if not session: raise HTTPException(status_code=404, detail="Session not found")
        
        if "name" in body:
            session.name = body["name"]
        elif "model" in body:
            if session.model != body["model"]:
                history = session.previous_models or ""
                session.previous_models = f"{history},{session.model}" if history else session.model
                session.model = body["model"]
        
        db.commit()
        return {"success": True}
    finally:
        db.close()

@app.delete("/api/v1/sessions/{session_id}")
async def delete_session(session_id: str):
    db = SessionLocal()
    try:
        session = db.query(DBSession).filter(DBSession.id == session_id).first()
        if session:
            db.delete(session)
            db.commit()
        return {"success": True}
    finally:
        db.close()

@app.post("/api/v1/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # Simple transcription placeholder or actual Whisper call via LiteLLM
    # Note: Requires an API key if calling a real model. 
    # For now, we'll return a placeholder to match the Java side.
    return {"text": "Audio received and processed."}

# --- Technical Demonstration Endpoints (Updated for Nested Agents) ---

@app.post("/api/v1/test/simple-agent")
async def test_simple_agent(request: Dict = Body(...)):
    api_key = request.get("api_key")
    model_name = request.get("model")
    prompt = request.get("prompt")
    proxy_url = os.getenv("LITELLM_PROXY_BASE_URL")

    model = LiteLlm(model_name=model_name, api_base=proxy_url, api_key=api_key)
    
    # Conflict Resolution: Atomic Agents
    search_expert = LlmAgent(name="SearchExpert", model=model, tools=[GoogleSearchTool()])
    code_executor = LlmAgent(name="CodeExecutionExpert", model=model, tools=[BuiltInCodeExecutionTool()])
    
    # The Tool Manager
    demo_agent = LlmAgent(
        name="DemoAgent", 
        model=model, 
        instruction="Technical demo. Delegate to SearchExpert for info or CodeExecutionExpert to run code.",
        sub_agents=[search_expert, code_executor]
    )
    
    runner = InMemoryRunner(demo_agent)
    try:
        response = ""
        for event in runner.run(user_id="test-user", session_id=str(uuid.uuid4()), content=Content.from_parts([Part.from_text(prompt)])):
            if event.final_response: response += event.stringify_content()
        return {"status": "SUCCESS", "agent_response": response}
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}

@app.post("/api/v1/test/ingest-document")
async def test_ingest(file: UploadFile = File(...), api_key: str = Form(...)):
    content = await file.read()
    await ingestion_service.ingest_document(content, file.filename, api_key, chunk_size=2000, chunk_overlap=0)
    return {"status": "SUCCESS", "message": "Knowledge indexed in Persistent Chroma Blob"}

@app.post("/api/v1/test/rag-agent")
async def test_rag_agent(request: Dict = Body(...)):
    api_key = request.get("api_key")
    model_name = request.get("model")
    query = request.get("query")
    proxy_url = os.getenv("LITELLM_PROXY_BASE_URL")

    context = chroma_service.query_knowledge(query, api_key)
    if not context:
        return {"status": "NO_CONTEXT", "message": "Document context missing."}

    model = LiteLlm(model_name=model_name, api_base=proxy_url, api_key=api_key)
    agent = LlmAgent(
        name="StrictRagAgent", 
        model=model, 
        instruction="Answer ONLY using provided context."
    )
    runner = InMemoryRunner(agent)
    
    try:
        prompt = f"CONTEXT:\n{context}\n\nQUERY: {query}"
        response = ""
        for event in runner.run(user_id="test-user", session_id=str(uuid.uuid4()), content=Content.from_parts([Part.from_text(prompt)])):
            if event.final_response: response += event.stringify_content()
        return {"status": "SUCCESS", "retrieved_context": context, "agent_response": response}
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}

# Production Ingestion
@app.post("/api/v1/admin/ingest")
async def admin_ingest(
    file: UploadFile = File(...), 
    api_key: str = Form(...),
    chunk_size: int = Form(1000),
    chunk_overlap: int = Form(200)
):
    content = await file.read()
    await ingestion_service.ingest_document(content, file.filename, api_key, chunk_size, chunk_overlap)
    return {"status": "success", "message": "Playground Knowledge Updated."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)