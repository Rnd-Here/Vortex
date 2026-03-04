# VORTEX: Multi-Agent LLM Platform

**VORTEX** is a production-quality internal LLM chat platform designed for enterprise environments. It features a high-performance **Spring Boot** backend integrated with the **Google Agent Development Kit (ADK)** and a modern **React** frontend with a dual-tone "Electric Dark" cyberpunk aesthetic.

## Key Features

- **Electric Dark UI:** A futuristic, high-contrast interface with neon accents.
- **Smart Orchestration:** Powered by Google ADK, featuring a central Orchestrator that routes between Code and Org agents.
- **Secure by Design:** AES-256 encryption for API keys and SHA-256 for user session isolation.
- **Real-time RAG Pipeline:** Document ingestion using Apache Tika and ChromaDB.
- **Advanced Context:** Automatic summarization-based compression for long conversations.
- **Voice Dictation:** integrated Whisper-ready transcription.

---

## Deployment with Docker (Recommended)

1. **Environment Setup:**
   Configure the `.env` file in the `vortex/` root directory:
   ```env
   LITELLM_PROXY_BASE_URL=https://internal-llm-proxy.company.com
   SECRET_KEY=your-32-character-secret-key
   ```

2. **Launch the Stack:**
   From the `vortex/` directory, run:
   ```bash
   docker-compose up --build -d
   ```
   - **Frontend UI:** `http://localhost` (Port 80)
   - **Backend API:** `http://localhost:8000`
   - **Local ChromaDB:** `http://localhost:8001`

---

## Manual Development Setup

### Backend (Spring Boot + Java 17)
1. `cd backend`
2. `mvn spring-boot:run`

### Frontend (React + Vite)
1. `cd frontend`
2. `npm install`
3. `npm run dev` (Access at `http://localhost:5173`)

---

## Administrative Tasks

### Document Ingestion (RAG)
To train the **Org Assistant** on new knowledge:
1. Navigate to `http://localhost/admin/upload-documents`.
2. Upload PDF, Code, or Text documents to vectorize them into the ChromaDB knowledge base.

---
*Developed with excellence by the VORTEX Engineering Team.*
