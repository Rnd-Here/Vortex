from tika import parser
import logging
from typing import List
from services.chroma_service import Chroma_Service_Type # Placeholder for type hint
from services.chroma_service import ChromaService

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self, chroma_service: ChromaService):
        self.chroma_service = chroma_service

    async def ingest_document(self, file_content: bytes, filename: str, api_key: str, chunk_size: int = 1000, chunk_overlap: int = 200):
        logger.info(f"Starting Python ingestion for file: {filename}")
        
        # 1. Extract Text using Tika
        # Note: Tika needs a server or it starts its own jar. 
        # For simplicity in this demo, we assume the user has internet or tika is ready.
        parsed = parser.from_buffer(file_content)
        content = parsed.get("content", "")
        
        if not content:
            logger.warning(f"No content extracted from {filename}")
            return

        # 2. Chunking logic
        chunks = self._split_into_chunks(content, chunk_size, chunk_overlap)
        
        # 3. Embed and Store
        for chunk in chunks:
            try:
                # Get embedding via ChromaService's internal helper
                embedding = self.chroma_service._get_embedding(chunk, api_key)
                self.chroma_service.upsert(chunk, embedding, filename)
            except Exception as e:
                logger.error(f"Failed to embed/store chunk: {e}")

        logger.info(f"Successfully indexed {len(chunks)} chunks for: {filename}")

    def _split_into_chunks(self, text: str, size: int, overlap: int) -> List[str]:
        chunks = []
        if not text:
            return chunks
            
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + size, text_len)
            chunks.append(text[start:end])
            start += (size - overlap)
            if start >= text_len or size <= overlap:
                break
        return chunks