import streamlit as st
import requests
import os
import subprocess
import time
import socket

st.set_page_config(page_title="Vortex Technical Demo", layout="wide")

# --- AUTO-START CHROMA SERVER ---
CHROMA_PORT = 8001
CHROMA_PATH = "../chroma_data"

def is_port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def start_chroma():
    if not is_port_open(CHROMA_PORT):
        st.info(f"🚀 Initializing Persistent Chroma Engine on port {CHROMA_PORT}...")
        try:
            # Start chroma as a background process
            subprocess.Popen(
                ["chroma", "run", "--path", CHROMA_PATH, "--port", str(CHROMA_PORT)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                shell=True if os.name == 'nt' else False
            )
            time.sleep(2) # Give it a moment to boot
            st.success("✅ Chroma Engine Active and Persisting to /chroma_data")
        except Exception as e:
            st.error(f"❌ Failed to start Chroma Engine: {e}")
    else:
        st.sidebar.success(f"🔗 Chroma Engine detected on port {CHROMA_PORT}")

# Styling
st.markdown("""
    <style>
    .main {
        background-color: #0a0a0f;
        color: #e2e2e2;
    }
    .stButton>button {
        background-color: #00f2ff;
        color: #0a0a0f;
        font-weight: bold;
        border-radius: 10px;
        border: none;
    }
    .stTextInput>div>div>input {
        background-color: #12121e;
        color: white;
        border: 1px solid #1f1f2e;
    }
    .stTextArea>div>div>textarea {
        background-color: #12121e;
        color: white;
        border: 1px solid #1f1f2e;
    }
    </style>
    """, unsafe_allow_html=True)

st.title("🌪️ VORTEX: Step-by-Step Technical Proof")
start_chroma()
st.divider()

# Sidebar Settings
st.sidebar.header("📡 Global Configuration")
BACKEND_URL = st.sidebar.text_input("Backend API URL", value="http://localhost:8000/api/v1")
API_KEY = st.sidebar.text_input("LiteLLM API Key", type="password", placeholder="sk-...")
MODEL_NAME = st.sidebar.selectbox("Select Core", ["gpt-4o", "gemini-2.0-flash", "llama-3-70b"])

# Split Screen Layout
col1, col2 = st.columns(2)

# --- LEFT COLUMN: Simple Agent (Search & Code) ---
with col1:
    st.header("⚡ 1. The Simple Agent")
    st.info("Demonstrates direct connectivity, Google Search, and Code Execution.")
    
    prompt = st.text_area("Logical Query", placeholder="e.g. Search for the latest Java features and write a demo code.", height=150)
    
    if st.button("Execute Logical Core"):
        if not API_KEY:
            st.error("Please provide an API Key in the sidebar.")
        else:
            with st.spinner("Vortex Engine Computing..."):
                try:
                    payload = {
                        "api_key": API_KEY,
                        "model": MODEL_NAME,
                        "prompt": prompt
                    }
                    response = requests.post(f"{BACKEND_URL}/test/simple-agent", json=payload)
                    data = response.json()
                    
                    if data.get("status") == "SUCCESS":
                        st.subheader("Agent Response")
                        st.markdown(data["agent_response"])
                    else:
                        st.error(f"Error: {data.get('error')}")
                except Exception as e:
                    st.error(f"Connection Failed: {str(e)}")

# --- RIGHT COLUMN: Document Agent (Pure RAG) ---
with col2:
    st.header("📚 2. The Document Agent")
    st.info("Demonstrates Ingestion, Vectorization, and 'Closed-Book' RAG.")
    
    # Step 1: Ingestion
    st.subheader("Phase A: Ingestion")
    uploaded_file = st.file_uploader("Choose a document", type=["pdf", "txt", "py", "java", "md"])
    
    if st.button("Initialize Ingestion"):
        if not uploaded_file or not API_KEY:
            st.error("Missing file or API Key.")
        else:
            with st.spinner("Parsing & Vectorizing..."):
                try:
                    files = {"file": (uploaded_file.name, uploaded_file.getvalue(), uploaded_file.type)}
                    params = {"api_key": API_KEY}
                    response = requests.post(f"{BACKEND_URL}/test/ingest-document", files=files, data=params)
                    data = response.json()
                    
                    if data.get("status") == "SUCCESS":
                        st.success(data["message"])
                    else:
                        st.error(data.get("message", "Ingestion failed."))
                except Exception as e:
                    st.error(f"Ingestion Error: {str(e)}")

    st.divider()

    # Step 2: RAG Query
    st.subheader("Phase B: Semantic Retrieval")
    query = st.text_input("Ask about the document", placeholder="What are the key points in this file?")
    
    if st.button("Query Knowledge Blob"):
        if not API_KEY or not query:
            st.error("Missing query or API Key.")
        else:
            with st.spinner("Searching Local Persistent Store..."):
                try:
                    payload = {
                        "api_key": API_KEY,
                        "model": MODEL_NAME,
                        "query": query
                    }
                    response = requests.post(f"{BACKEND_URL}/test/rag-agent", json=payload)
                    data = response.json()
                    
                    if data.get("status") == "SUCCESS":
                        with st.expander("🔍 Retrieved Context (Evidence)"):
                            st.text(data["retrieved_context"])
                        st.subheader("Agent Response")
                        st.markdown(data["agent_response"])
                    elif data.get("status") == "NO_CONTEXT":
                        st.warning(data["message"])
                    else:
                        st.error(f"Error: {data.get('error')}")
                except Exception as e:
                    st.error(f"Query Failed: {str(e)}")
