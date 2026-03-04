package com.vortex.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
public class ChromaService {

    private final WebClient webClient;

    @Value("${chroma.url}")
    private String chromaUrl;

    @Value("${chroma.collection-name}")
    private String collectionName;

    public ChromaService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public void upsert(String text, List<Double> embedding, String filename) {
        try {
            log.info("Ingesting chunk into ChromaDB: {}", filename);
            
            // Generate a unique ID for the chunk
            String id = UUID.randomUUID().toString();

            webClient.post()
                .uri(chromaUrl + "/api/v1/collections/" + collectionName + "/upsert")
                .bodyValue(Map.of(
                    "ids", List.of(id),
                    "embeddings", List.of(embedding),
                    "metadatas", List.of(Map.of("source", filename)),
                    "documents", List.of(text)
                ))
                .retrieve()
                .toBodilessEntity()
                .block();
                
        } catch (Exception e) {
            log.error("ChromaDB Upsert Error: {}", e.getMessage());
        }
    }

    public String queryKnowledge(String query) {
        // Logic to query ChromaDB would go here
        // For the prototype, we log the search
        log.info("Searching ChromaDB for knowledge relevant to: {}", query);
        return ""; 
    }
}