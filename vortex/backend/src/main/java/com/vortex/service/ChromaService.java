package com.vortex.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.time.LocalDateTime;

@Service
@Slf4j
public class ChromaService {

    private final WebClient webClient;
    private final LiteLlmService liteLlmService;

    @Value("${chroma.url}")
    private String chromaUrl;

    @Value("${chroma.collection-name}")
    private String collectionName;

    public ChromaService(WebClient.Builder webClientBuilder, LiteLlmService liteLlmService) {
        this.webClient = webClientBuilder.build();
        this.liteLlmService = liteLlmService;
    }

    /**
     * Purges existing records for a file to prevent duplicates.
     */
    public void deleteByFilename(String filename) {
        try {
            String collectionId = getCollectionId();
            webClient.post()
                .uri(chromaUrl + "/api/v1/collections/" + collectionId + "/delete")
                .bodyValue(Map.of("where", Map.of("source", filename)))
                .retrieve()
                .toBodilessEntity()
                .block();
            log.info("Purged existing records for: {}", filename);
        } catch (Exception e) {
            log.error("Purge error for {}: {}", filename, e.getMessage());
        }
    }

    /**
     * Ingests a chunk with semantic metadata.
     */
    public void upsert(String text, List<Double> embedding, String filename, int index, String topic) {
        try {
            String id = filename + "_" + index;
            webClient.post()
                .uri(chromaUrl + "/api/v1/collections/" + getCollectionId() + "/upsert")
                .bodyValue(Map.of(
                    "ids", List.of(id),
                    "embeddings", List.of(embedding),
                    "metadatas", List.of(Map.of(
                        "source", filename,
                        "topic", topic,
                        "chunk", index,
                        "ingested_at", LocalDateTime.now().toString()
                    )),
                    "documents", List.of(text)
                ))
                .retrieve()
                .toBodilessEntity()
                .block();
        } catch (Exception e) {
            log.error("Upsert Error: {}", e.getMessage());
        }
    }

    /**
     * Semantic Search method designed for Agent Tool usage.
     */
    public String searchDocs(String query, String apiKey) {
        try {
            log.info("Agent triggered search: {}", query);
            List<Double> embedding = liteLlmService.getEmbedding(query, apiKey).block();
            if (embedding == null) return "Error: Embedding failed.";

            Map<String, Object> response = webClient.post()
                .uri(chromaUrl + "/api/v1/collections/" + getCollectionId() + "/query")
                .bodyValue(Map.of(
                    "query_embeddings", List.of(embedding),
                    "n_results", 4,
                    "include", List.of("documents", "metadatas")
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

            if (response == null || !response.containsKey("documents")) return "No relevant info found.";

            List<List<String>> documents = (List<List<String>>) response.get("documents");
            List<List<Map<String, Object>>> metadatas = (List<List<Map<String, Object>>>) response.get("metadatas");

            StringBuilder result = new StringBuilder();
            for (int i = 0; i < documents.get(0).size(); i++) {
                Map<String, Object> meta = metadatas.get(0).get(i);
                result.append(String.format("[File: %s | Topic: %s]\n%s\n---\n", 
                        meta.get("source"), meta.get("topic"), documents.get(0).get(i)));
            }
            return result.toString();

        } catch (Exception e) {
            return "Knowledge Retrieval Error: " + e.getMessage();
        }
    }

    /**
     * Legacy method for production pre-injection (now secondary to searchDocs).
     */
    public String queryKnowledge(String query, String apiKey) {
        return searchDocs(query, apiKey);
    }

    private String getCollectionId() {
        try {
            Map res = webClient.get().uri(chromaUrl + "/api/v1/collections/" + collectionName).retrieve().bodyToMono(Map.class).block();
            if (res != null && res.containsKey("id")) return (String) res.get("id");
        } catch (Exception e) {
            Map createRes = webClient.post().uri(chromaUrl + "/api/v1/collections").bodyValue(Map.of("name", collectionName)).retrieve().bodyToMono(Map.class).block();
            if (createRes != null) return (String) createRes.get("id");
        }
        return "";
    }
}