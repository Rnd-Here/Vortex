import requests
import os
import uuid
import litellm
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class ChromaService:
    def __init__(self):
        self.chroma_url = os.getenv("CHROMA_URL", "http://localhost:8001")
        self.collection_name = os.getenv("CHROMA_COLLECTION_NAME", "org_knowledge")
        self.proxy_base_url = os.getenv("LITELLM_PROXY_BASE_URL", "https://internal-llm-proxy.company.com")

    def _get_embedding(self, text: str, api_key: str) -> List[float]:
        response = litellm.embedding(
            model="text-embedding-3-small",
            input=[text],
            api_base=self.proxy_base_url,
            api_key=api_key
        )
        return response['data'][0]['embedding']

    def delete_by_filename(self, filename: str):
        collection_id = self._get_or_create_collection()
        if not collection_id: return
        payload = {"where": {"source": filename}}
        try:
            requests.post(f"{self.chroma_url}/api/v1/collections/{collection_id}/delete", json=payload)
        except Exception as e:
            logger.error(f"Failed to purge {filename}: {e}")

    def upsert(self, text: str, embedding: List[float], filename: str, chunk_index: int, topic: str):
        collection_id = self._get_or_create_collection()
        if not collection_id: return

        payload = {
            "ids": [f"{filename}_{chunk_index}"],
            "embeddings": [embedding],
            "metadatas": [{
                "source": filename,
                "topic": topic, # ENHANCED: Semantic Topic
                "ingested_at": datetime.now().isoformat(),
                "chunk": chunk_index
            }],
            "documents": [text]
        }
        requests.post(f"{self.chroma_url}/api/v1/collections/{collection_id}/upsert", json=payload)

    def search_docs(self, query: str, api_key: str, filename_filter: Optional[str] = None) -> str:
        try:
            embedding = self._get_embedding(query, api_key)
            collection_id = self._get_or_create_collection()
            
            payload = {
                "query_embeddings": [embedding],
                "n_results": 4,
                "include": ["documents", "metadatas"]
            }
            
            if filename_filter:
                payload["where"] = {"source": filename_filter}

            response = requests.post(f"{self.chroma_url}/api/v1/collections/{collection_id}/query", json=payload).json()
            
            if "documents" in response and response["documents"]:
                results = []
                for i in range(len(response["documents"][0])):
                    doc = response["documents"][0][i]
                    meta = response["metadatas"][0][i]
                    # Show the Intelligent Topic in the search results
                    results.append(f"[File: {meta['source']} | Topic: {meta['topic']}]\n{doc}")
                return "\n---\n".join(results)
            return "No matching documentation found."
        except Exception as e:
            return f"Search Error: {str(e)}"

    def _get_or_create_collection(self) -> str:
        try:
            res = requests.get(f"{self.chroma_url}/api/v1/collections/{self.collection_name}").json()
            if "id" in res: return res["id"]
        except: pass
        try:
            res = requests.post(f"{self.chroma_url}/api/v1/collections", json={"name": self.collection_name}).json()
            return res.get("id")
        except: return None