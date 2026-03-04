package com.vortex.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class IngestionService {

    private final LiteLlmService liteLlmService;
    private final ChromaService chromaService;
    private final Tika tika = new Tika();

    public void ingestDocument(MultipartFile file, String apiKey, int chunkSize, int chunkOverlap) throws Exception {
        log.info("Starting admin ingestion for file: {} (Size: {}, Overlap: {})", 
                file.getOriginalFilename(), chunkSize, chunkOverlap);

        // 1. Extract Text
        String content = tika.parseToString(file.getInputStream());
        
        // 2. Advanced Chunking with Overlap
        List<String> chunks = splitIntoChunks(content, chunkSize, chunkOverlap);

        // 3. Embed and Store with Metadata
        for (String chunk : chunks) {
            // block() is used here for simplicity in this prototype orchestrator
            List<Double> embedding = liteLlmService.getEmbedding(chunk, apiKey).block();
            if (embedding != null) {
                chromaService.upsert(chunk, embedding, file.getOriginalFilename());
            }
        }
        
        log.info("Successfully indexed {} chunks for: {}", chunks.size(), file.getOriginalFilename());
    }

    private List<String> splitIntoChunks(String text, int size, int overlap) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.isEmpty()) return chunks;
        
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + size, text.length());
            chunks.add(text.substring(start, end));
            start += (size - overlap);
            if (start >= text.length() || size <= overlap) break;
        }
        return chunks;
    }
}