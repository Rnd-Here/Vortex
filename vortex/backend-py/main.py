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
from google.adk import Agent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.tools import GoogleSearch, FunctionTool
from google.adk.code_executors import BuiltInCodeExecutor
from google.genai import types

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB Setup - Consolidated Shared Storage
DB_URL = os.getenv("SPRING_DATASOURCE_URL", "sqlite:///app/data/chat_app.db").replace("jdbc:sqlite:", "sqlite:///")
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
            name=request.get("initial_message", "New Session")[:30],
            model=request["model"]
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
        
        # Process with Unified Autonomous Orchestrator
        file_data = await file.read() if file else None
        response_text = agent_service.process_multimodal_request(
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
    return {"text": "Autonomous audio processed."}

# Ingestion Endpoints (RAG Tool populator)
@app.post("/api/v1/admin/ingest")
async def admin_ingest(
    file: UploadFile = File(...), 
    api_key: str = Form(...),
    chunk_size: int = Form(1000),
    chunk_overlap: int = Form(200)
):
    content = await file.read()
    await ingestion_service.ingest_document(content, file.filename, api_key, chunk_size, chunk_overlap)
    return {"status": "success", "message": "Knowledge Index Updated."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)