import requests
import os
import uuid
import litellm
from typing import List, Dict, Any

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

    def upsert(self, text: str, embedding: List[float], filename: str):
        collection_id = self._get_or_create_collection()
        if not collection_id:
            return

        payload = {
            "ids": [str(uuid.uuid4())],
            "embeddings": [embedding],
            "metadatas": [{"source": filename}],
            "documents": [text]
        }
        
        requests.post(f"{self.chroma_url}/api/v1/collections/{collection_id}/upsert", json=payload)

    def query_knowledge(self, query: str, api_key: str) -> str:
        embedding = self._get_embedding(query, api_key)
        collection_id = self._get_or_create_collection()
        if not collection_id:
            return ""

        payload = {
            "query_embeddings": [embedding],
            "n_results": 3,
            "include": ["documents"]
        }
        
        response = requests.post(f"{self.chroma_url}/api/v1/collections/{collection_id}/query", json=payload).json()
        
        if "documents" in response and response["documents"]:
            # Flatten results
            docs = [doc for sublist in response["documents"] for doc in sublist]
            return "\n---\n".join(docs)
        return ""

    def _get_or_create_collection(self) -> str:
        try:
            res = requests.get(f"{self.chroma_url}/api/v1/collections/{self.collection_name}").json()
            if "id" in res:
                return res["id"]
        except:
            pass
            
        try:
            res = requests.post(f"{self.chroma_url}/api/v1/collections", json={"name": self.collection_name}).json()
            return res.get("id")
        except:
            return None