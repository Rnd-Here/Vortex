from tika import parser
import logging
import litellm
import os
from typing import List
from services.chroma_service import ChromaService

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self, chroma_service: ChromaService):
        self.chroma_service = chroma_service
        self.proxy_base_url = os.getenv("LITELLM_PROXY_BASE_URL")

    async def ingest_document(self, file_content: bytes, filename: str, api_key: str, chunk_size: int = 1000, chunk_overlap: int = 200):
        logger.info(f"Ingesting: {filename}")
        
        parsed = parser.from_buffer(file_content)
        content = parsed.get("content", "").strip()
        if not content: return

        # 1. ENHANCED: Semantic Topic Extraction
        # We use the LLM to 'look' at the first 2000 chars to determine the topic
        topic = await self._determine_topic(content[:2000], api_key)
        logger.info(f"Semantic Topic Identified: {topic}")

        # 2. De-duplicate
        self.chroma_service.delete_by_filename(filename)

        # 3. Chunking
        chunks = self._split_into_chunks(content, chunk_size, chunk_overlap)
        
        # 4. Embed and Store
        for i, chunk in enumerate(chunks):
            try:
                embedding = self.chroma_service._get_embedding(chunk, api_key)
                self.chroma_service.upsert(chunk, embedding, filename, i, topic)
            except Exception as e:
                logger.error(f"Chunk {i} failed: {e}")

        logger.info(f"Indexed {len(chunks)} chunks for: {filename}")

    async def _determine_topic(self, sample_text: str, api_key: str) -> str:
        """Uses LLM to describe the content regardless of filename."""
        try:
            response = litellm.completion(
                model="gemini-1.5-flash", # Use a fast model for tagging
                messages=[{"role": "user", "content": f"Describe this document content in 5 words or less. Be descriptive. Content:\n{sample_text}"}],
                api_base=self.proxy_base_url,
                api_key=api_key
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Topic extraction failed: {e}")
            return "General Knowledge"

    def _split_into_chunks(self, text: str, size: int, overlap: int) -> List[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = min(start + size, len(text))
            chunks.append(text[start:end])
            start += (size - overlap)
            if start >= len(text) or size <= overlap: break
        return chunks