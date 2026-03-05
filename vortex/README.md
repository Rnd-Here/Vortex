# VORTEX: Multi-Agent LLM Platform

**VORTEX** is a production-quality internal LLM chat platform designed for enterprise environments. It features a high-performance **Spring Boot** backend integrated with the **Google Agent Development Kit (ADK)** and a modern **React** frontend with a dual-tone "Electric Dark" cyberpunk aesthetic.

## Key Features

- **Electric Dark UI:** A futuristic, high-contrast interface with neon accents.
- **Smart Orchestration:** Powered by Google ADK, featuring a central Orchestrator that routes between Code and Org agents.
- **Secure by Design:** AES-256 encryption for API keys and SHA-256 for user session isolation.
- **Real-time RAG Pipeline:** Document ingestion using Apache Tika and ChromaDB.
- **Deterministic Context Compression:** Automatic history condensation once a 15-event threshold is reached.
- **Voice Dictation:** Integrated Whisper-ready transcription logic.

---

## Architectural Highlights

### Explicit Context Compression
VORTEX implements a "Foundational Summary" architecture to manage long-running conversations without exceeding LLM context limits:
1. **Manual Extraction:** When history hits the threshold, the system manually joins all previous messages into a single transcript.
2. **Isolated Summarization:** A fresh, stateless "Summarizer" agent receives this transcript as direct prompt input.
3. **Foundation Establishment:** The original history is cleared and replaced with a concise 3-sentence summary.
4. **Result:** The LLM maintains full contextual awareness while processing 90% fewer tokens, ensuring high speed and low cost.

### Multimodal Staging Flow
Unlike traditional "upload-and-wait" systems, VORTEX uses a staging model:
- Users stage images or documents in the UI (visible thumbnails/chips).
- On "Send", text and binary data are bundled into a single `Multipart` payload.
- The backend performs just-in-time extraction or direct multimodal forwarding to the LLM.

---

## Deployment with Docker (Production Ready)

For production environments, the complete stack is managed via Docker Compose. This ensures all services (Frontend, Backend, and ChromaDB) are correctly networked and persistent.

1. **Environment Setup:**
   Configure the `.env` file in the `vortex/` root directory:
   ```env
   LITELLM_PROXY_BASE_URL=https://internal-llm-proxy.company.com
   SECRET_KEY=your-32-character-secret-key
   ```

2. **Launch the Stack:**
   ```bash
   docker-compose up --build -d
   ```
   - **Frontend UI:** `http://localhost` (Port 80)
   - **Backend API:** `http://localhost:8000`
   - **Persistence:** All vectors are stored in the local `vortex/chroma_data` volume mapping.

---

## Technical Demonstration (Internal Testing)

For internal testing and logical verification, VORTEX provides a standalone **Streamlit-based Technical Proof UI**. This UI is designed to work with a locally running backend.

### One-Click Demo Engine
The Demo UI is self-contained. When launched, it **automatically initializes and manages the ChromaDB engine** on port 8001, saving data to your local project directory.

1. **Launch Backend:** Ensure your Spring Boot backend is running locally (`mvn spring-boot:run`).
2. **Setup Demo UI:**
   ```bash
   cd vortex/test-ui
   pip install -r requirements.txt
   streamlit run demo_app.py
   ```
3. **Verification Flow:**
   - **Simple Agent:** Verify Google Search and Code Execution tool usage.
   - **Document Agent:** Upload a file to generate the "Knowledge Blob" and test "Closed-Book" RAG retrieval.

### The "Knowledge Blob" Portability
The `vortex/chroma_data` folder generated during testing is a self-contained "Blob". It can be zipped and moved to any machine, and is 100% compatible with Python-based Chroma clients or the production Docker stack.

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
