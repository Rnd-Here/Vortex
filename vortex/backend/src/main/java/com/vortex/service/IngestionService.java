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
        String filename = file.getOriginalFilename();
        log.info("Starting intelligent ingestion for file: {}", filename);

        // 1. Extract Text
        String content = tika.parseToString(file.getInputStream());
        if (content == null || content.trim().isEmpty()) return;

        // 2. Determine Semantic Topic (AI-powered metadata)
        String sample = content.substring(0, Math.min(content.length(), 2000));
        String topic = liteLlmService.getCompletion(
                "Describe this document in 5 words or less: " + sample, apiKey).block();
        log.info("Semantic Topic Identified: {}", topic);

        // 3. De-duplicate: Clean existing records for this file
        chromaService.deleteByFilename(filename);

        // 4. Advanced Chunking
        List<String> chunks = splitIntoChunks(content, chunkSize, chunkOverlap);

        // 5. Embed and Store with Topic Metadata
        for (int i = 0; i < chunks.size(); i++) {
            String chunk = chunks.get(i);
            List<Double> embedding = liteLlmService.getEmbedding(chunk, apiKey).block();
            if (embedding != null) {
                chromaService.upsert(chunk, embedding, filename, i, topic);
            }
        }
        
        log.info("Successfully indexed {} chunks for: {} (Topic: {})", chunks.size(), filename, topic);
    }

    private List<String> splitIntoChunks(String text, int size, int overlap) {
        List<String> chunks = new ArrayList<>();
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