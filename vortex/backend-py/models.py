from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime
import ulid

Base = declarative_base()

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(ulid.new()))
    encrypted_api_key = Column(String, nullable=False)
    api_key_hash = Column(String, nullable=False)
    name = Column(String)
    model = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")
    
    __table_args__ = (Index('idx_apikeyhash', 'api_key_hash'),)

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(String, primary_key=True, default=lambda: str(ulid.new()))
    session_id = Column(String, ForeignKey("sessions.id"))
    role = Column(String) # user, assistant, system
    content = Column(Text)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("Session", back_populates="messages")