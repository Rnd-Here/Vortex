package com.vortex.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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
     * Ingests a chunk of text and its embedding into ChromaDB.
     * The data is persisted in the local 'vortex/chroma_data' folder by the server.
     */
    public void upsert(String text, List<Double> embedding, String filename) {
        try {
            log.info("Indexing chunk into Persistent Chroma Store: {}", filename);
            String id = UUID.randomUUID().toString();

            webClient.post()
                .uri(chromaUrl + "/api/v1/collections/" + getCollectionId() + "/upsert")
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
            log.error("ChromaDB Persistence Error: {}", e.getMessage());
        }
    }

    /**
     * Performs semantic search to retrieve context for the Org Assistant.
     */
    public String queryKnowledge(String query, String apiKey) {
        try {
            log.info("Searching persistent knowledge for: {}", query);

            List<Double> queryEmbedding = liteLlmService.getEmbedding(query, apiKey).block();
            if (queryEmbedding == null) return "";

            Map<String, Object> response = webClient.post()
                .uri(chromaUrl + "/api/v1/collections/" + getCollectionId() + "/query")
                .bodyValue(Map.of(
                    "query_embeddings", List.of(queryEmbedding),
                    "n_results", 3,
                    "include", List.of("documents")
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

            if (response == null || !response.containsKey("documents")) return "";

            List<List<String>> documents = (List<List<String>>) response.get("documents");
            return documents.stream()
                    .flatMap(List::stream)
                    .collect(Collectors.joining("\n---\n"));

        } catch (Exception e) {
            log.error("Knowledge Retrieval Error: {}", e.getMessage());
            return "";
        }
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