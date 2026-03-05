# VORTEX: Multi-Agent LLM Platform

**VORTEX** is a production-quality internal AI platform featuring dual-engine orchestration (Java/Python), secure RAG, and a cyberpunk-themed interface.

## 📡 VORTEX Port Map

| Component | Port | Description |
| :--- | :--- | :--- |
| **Java Backend** | `8000` | Enterprise Core (Spring Boot + ADK Java) |
| **Python Backend** | `8002` | Agile Core (FastAPI + ADK Python) |
| **React Frontend** | `80` / `5173` | Main Chat Terminal |
| **ChromaDB Engine** | `8001` | Shared Persistent Knowledge Store |
| **Streamlit UI** | `8501` | Technical Demo / Proof UI |

---

## 🏗️ Architectural Highlights

### Multi-Engine Interoperability
VORTEX supports two interchangeable backend engines. Both engines share:
- **Shared History:** A single SQLite database (`backend/data/chat_app.db`) stores all sessions.
- **Shared Knowledge:** A single ChromaDB instance (Port 8001) persists vectors to the `vortex/chroma_data` blob.
- **Toggle Support:** Switch engines via the UI Settings or Initial Setup screen.

### Deterministic Context Compression
- Automatic history condensation once a 15-event threshold is reached.
- Manual transcript extraction followed by isolated summarization preserves 100% context while saving 90% of tokens.

---

## 🚀 Deployment (Production)

For production, the complete stack is managed via Docker Compose:
```bash
# 1. Setup .env in project root
# 2. Launch Stack
docker-compose up --build -d
```
- **Frontend:** `http://localhost` (Port 80)

---

## 🛠️ Manual Development Setup

If you prefer to run components individually for development:

### 1. Java Backend (Enterprise)
```bash
cd vortex/backend
mvn spring-boot:run
```

### 2. Python Backend (Agile)
```bash
cd vortex/backend-py
pip install -r requirements.txt
python main.py
```

### 3. React Frontend
```bash
cd vortex/frontend
npm install
npm run dev
```
*Access at http://localhost:5173*

---

## 🧪 Technical Demonstration (Internal Testing)

The **Technical Proof UI** is designed for step-by-step verification of logic.

### Quick Start (Demo)
1. **Ensure a Backend is running** (Java or Python from above).
2. **Launch Demo UI:**
   ```bash
   cd vortex/test-ui
   pip install -r requirements.txt
   streamlit run demo_app.py
   ```
- **Note:** The Demo UI automatically manages the Chroma engine on port 8001.

---

## 🛠️ Configuration Details

### Database Persistence
- **Path:** `vortex/backend/data/chat_app.db` (Shared by both backends).
- **Driver:** SQLite (Zero-config, automatically initialized).

### Knowledge Blob (RAG)
- **Path:** `vortex/chroma_data/`
- **Compatibility:** 100% Python/Java interchangeable format.

---
*Developed with excellence by the VORTEX Engineering Team.*
