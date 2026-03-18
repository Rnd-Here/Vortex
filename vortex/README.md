# VORTEX: Unified AI Agent Platform

**VORTEX** is a consolidated, high-performance AI platform featuring a unified Python LiteLLM core, a standalone Code Intelligence Engine (CIE), and an integrated VS Code Extension ecosystem.

## 📡 Port Map

| Component | Port | Description |
| :--- | :--- | :--- |
| **VORTEX Core API** | `8002` | Unified Multi-Agent Engine (LiteLLM Proxy) |
| **VORTEX Analyzer** | `8005` | Real-time Code Intelligence Engine (CIE) |
| **React Frontend** | `80` / `5173` | Unified Chat Terminal & Admin Suite |
| **ChromaDB Engine** | `8001` | Persistent Knowledge Store |
| **Streamlit UI** | `8501` | Technical Demo & Logic Proof UI |

---

## 🏗️ Re-vamped Architecture

### Single-Core Python Engine
VORTEX has been consolidated into a single, high-speed Python core (`backend-py`).
- **Native LiteLLM Integration:** Direct connectivity to LiteLLM Proxy via standard environment variables.
- **Agentic RAG:** Dynamically triggered organizational knowledge search with semantic topic tagging.
- **Multi-Agent Orchestration:** Hierarchical "Agent as Tool" pattern for complex reasoning.

### Code Intelligence Engine (CIE)
A dedicated service (`backend-analyzer`) for real-time developer assistance.
- **Logic Optimization:** Automatically detects suboptimal code patterns (e.g., redundant loops) and suggests modern, built-in alternatives.
- **Real-time API:** Designed for integration with IDE extensions via a high-performance `/analyze` endpoint.

### VS Code Extension
Turn your IDE into an agentic workstation.
- **Secure Handshake:** Managed token refreshes for 1-hour session constraints.
- **Ghost Text Analysis:** Real-time feedback powered by the VORTEX Analyzer.
- **Filesystem Access:** Direct creation and refactoring of project files by AI agents.

---

## 🚀 Quick Start (Production)

```bash
# 1. Configure .env in root
# 2. Launch
docker-compose up --build -d
```
- **Frontend:** `http://localhost` (Port 80)
- **API:** `http://localhost:8002`

---

## 🛠️ Manual Development Setup

### 1. Unified Core
```bash
cd vortex/backend-py
pip install -r requirements.txt
python main.py
```

### 2. Code Analyzer
```bash
cd vortex/backend-analyzer
pip install -r requirements.txt
python main.py
```

### 3. VS Code Extension
```bash
cd vortex/vortex-extension
npm install
npm run compile
# Press F5 in VS Code to launch
```

---

## 📦 Data Management

- **Database:** `vortex/backend-py/data/chat_app.db` (SQLite).
- **Knowledge Blob:** `vortex/chroma_data/` (Persistent Vector Store).
- **Security:** SHA-256 session isolation and AES-encrypted key management.

---
*Developed with excellence by the VORTEX Engineering Team.*
