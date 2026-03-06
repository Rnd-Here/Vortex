package com.vortex.service;

import com.vortex.dto.ModelListResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class LiteLlmService {

    private final WebClient webClient;

    @Value("${litellm.proxy.base-url}")
    private String baseUrl;

    public LiteLlmService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public Mono<ModelListResponse> fetchAvailableModels(String apiKey) {
        return webClient.get()
                .uri(baseUrl + "/v1/models")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .retrieve()
                .onStatus(HttpStatusCode::is4xxClientError, response ->
                    Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API Key")))
                .bodyToMono(Map.class)
                .map(response -> {
                    List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
                    List<String> models = data.stream()
                            .map(m -> (String) m.get("id"))
                            .collect(Collectors.toList());
                    return ModelListResponse.builder().models(models).build();
                });
    }

    /**
     * Calls the LiteLLM Proxy to get embeddings for a text chunk.
     */
    public Mono<List<Double>> getEmbedding(String text, String apiKey) {
        return webClient.post()
                .uri(baseUrl + "/v1/embeddings")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .bodyValue(Map.of(
                    "input", text,
                    "model", "text-embedding-3-small"
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    List<Map<String, Object>> data = (List<Map<String, Object>>) response.get("data");
                    return (List<Double>) data.get(0).get("embedding");
                });
    }

    /**
     * Calls the LiteLLM Proxy for a chat completion (used for metadata enrichment).
     */
    public Mono<String> getCompletion(String prompt, String apiKey) {
        return webClient.post()
                .uri(baseUrl + "/v1/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .bodyValue(Map.of(
                    "model", "gemini-1.5-flash",
                    "messages", List.of(Map.of("role", "user", "content", prompt))
                ))
                .retrieve()
                .bodyToMono(Map.class)
                .map(response -> {
                    List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
                    Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
                    return (String) message.get("content");
                });
    }
}