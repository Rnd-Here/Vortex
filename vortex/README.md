# VORTEX: Multi-Agent LLM Platform

**VORTEX** is a production-quality internal AI platform featuring quad-engine orchestration (Java/Python), Agentic RAG, and a futuristic "Electric Dark" cyberpunk interface. It is designed for both secure organizational use and high-performance personal coding assistance.

## 📡 VORTEX Port Map

| Component | Port | Description |
| :--- | :--- | :--- |
| **Java Enterprise** | `8000` | Enterprise Core (Spring Boot + Proxy Support) |
| **Python Agile** | `8002` | Agile Core (FastAPI + Asynchronous ADK) |
| **Java Personal** | `8003` | Direct-to-Google Core (Personal Edition) |
| **Python Personal** | `8004` | Direct-to-Google Core (Lightweight Edition) |
| **React Frontend** | `80` / `5173` | Unified Chat Terminal & Admin Suite |
| **ChromaDB Engine** | `8001` | Shared Persistent Knowledge Store |
| **Streamlit UI** | `8501` | Technical Demo & Logic Proof UI |

---

## 🏗️ Architectural Highlights

### Quad-Engine Interoperability
VORTEX supports four interchangeable backend engines. You can toggle between them via the **Engine Selector** in the UI.
- **Enterprise Modes (Proxy):** Connect through corporate proxies with strict isolation.
- **Personal Modes (Direct):** Direct high-speed connection to Google Gemini API.
- **Shared Data:** All engines share the same session database (`chat_app.db`) and knowledge blob.

### Agentic RAG (Advanced Retrieval)
Unlike standard RAG, VORTEX implements **Agentic RAG**:
- **Search as a Tool:** Agents dynamically decide when to search the knowledge base.
- **Semantic Tagging:** Ingested documents are automatically analyzed by AI to generate intelligent `topic` metadata, rendering ambiguous filenames irrelevant.
- **Iterative Search:** Agents can refine searches based on uncovered details during conversation.

### "Agent as Tool" Pattern (Conflict Resolution)
To comply with ADK constraints, VORTEX uses a nested hierarchy:
- **Orchestrator** delegates to **Specialist Managers**.
- Managers control atomic experts like **SearchExpert** and **CodeExecutionExpert**.
- This prevents tool conflicts and ensures 100% reliability for complex tasks.

---

## 🚀 Deployment (Production)

The production stack defaults to the Java Enterprise engine:
```bash
# 1. Configure .env in root
# 2. Launch
docker-compose up --build -d
```
- **Frontend:** `http://localhost` (Port 80)
- **Backend:** Accessible at `8000` (Java) and `8002` (Python).

---

## 🧪 Technical Demonstration (Internal Testing)

The **Technical Proof UI** is used for step-by-step logic verification.

### Quick Start (Demo)
1. **Launch a Backend Engine:**
   - Java: `cd backend && mvn spring-boot:run`
   - Python: `cd backend-py && python main.py`
2. **Launch Demo UI:**
   ```bash
   cd vortex/test-ui
   pip install -r requirements.txt
   streamlit run demo_app.py
   ```
- **Feature:** Use the sidebar to toggle between Java and Python backends during the demo.

---

## 🛠️ Manual Development Setup

### Python Backends (Agile/Personal)
```bash
pip install -r requirements.txt
python main.py
```

### Java Backends (Enterprise/Personal)
```bash
mvn spring-boot:run
```

### React Frontend
```bash
npm install && npm run dev
```

---

## 📦 Data Management

- **Database:** `vortex/backend/data/chat_app.db` (Shared SQLite).
- **Knowledge Blob:** `vortex/chroma_data/` (Portable Vector Store).
- **Security:** AES-256 encrypted API keys and SHA-256 session isolation.

---
*Developed with excellence by the VORTEX Engineering Team.*
