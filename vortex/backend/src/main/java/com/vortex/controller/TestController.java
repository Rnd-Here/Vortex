package com.vortex.controller;

import com.google.adk.agents.LlmAgent;
import com.google.adk.agents.RunConfig;
import com.google.adk.models.ApigeeLlm;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.tools.BuiltInCodeExecutionTool;
import com.google.adk.tools.GoogleSearchTool;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import com.vortex.service.LiteLlmService;
import com.vortex.service.ChromaService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/test")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class TestController {

    private final LiteLlmService liteLlmService;
    private final ChromaService chromaService;
    private final Tika tika = new Tika();

    @Value("${litellm.proxy.base-url}")
    private String proxyBaseUrl;

    @PostMapping("/simple-agent")
    public Map<String, String> testSimpleAgent(@RequestBody Map<String, String> request) {
        String apiKey = request.get("api_key");
        String modelName = request.get("model");
        String prompt = request.get("prompt");

        ApigeeLlm model = ApigeeLlm.builder()
                .modelName(modelName)
                .proxyUrl(proxyBaseUrl)
                .customHeaders(ImmutableMap.of("Authorization", "Bearer " + apiKey))
                .build();

        LlmAgent simpleAgent = LlmAgent.builder()
                .name("DemoAgent")
                .model(model)
                .instruction("Technical demo agent using Search and Code Execution.")
                .tools(ImmutableList.of(new BuiltInCodeExecutionTool(), new GoogleSearchTool()))
                .build();

        InMemoryRunner runner = new InMemoryRunner(simpleAgent);
        final StringBuilder result = new StringBuilder();
        try {
            runner.runAsync("test-user", "test-" + UUID.randomUUID(), Content.fromParts(Part.fromText(prompt)), RunConfig.builder().build())
                    .blockingForEach(event -> { if (event.finalResponse()) result.append(event.stringifyContent()); });
            return Map.of("status", "SUCCESS", "agent_response", result.toString());
        } catch (Exception e) {
            return Map.of("status", "FAILED", "error", e.getMessage());
        }
    }

    /**
     * Ingestion Proof: Uses Chroma server to write data to localプロジェクト mount folder.
     */
    @PostMapping("/ingest-document")
    public Map<String, String> testIngest(@RequestParam("file") MultipartFile file, @RequestParam("api_key") String apiKey) throws Exception {
        String content = tika.parseToString(file.getInputStream());
        String chunk = content.substring(0, Math.min(content.length(), 2000));
        
        List<Double> embedding = liteLlmService.getEmbedding(chunk, apiKey).block();
        if (embedding != null) {
            chromaService.upsert(chunk, embedding, file.getOriginalFilename());
            return Map.of("status", "SUCCESS", "message", "Knowledge indexed in Persistent Chroma Blob (vortex/chroma_data)");
        }
        return Map.of("status", "FAILED", "message", "Embedding failed.");
    }

    /**
     * Retrieval Proof: Query the Persistent Blob using a strict RAG Agent.
     */
    @PostMapping("/rag-agent")
    public Map<String, String> testRagAgent(@RequestBody Map<String, String> request) {
        String apiKey = request.get("api_key");
        String modelName = request.get("model");
        String query = request.get("query");

        // Search the persistent collection
        String context = chromaService.queryKnowledge(query, apiKey);

        if (context.isEmpty()) {
            return Map.of("status", "NO_CONTEXT", "message", "Document context missing.");
        }

        ApigeeLlm model = ApigeeLlm.builder()
                .modelName(modelName)
                .proxyUrl(proxyBaseUrl)
                .customHeaders(ImmutableMap.of("Authorization", "Bearer " + apiKey))
                .build();

        // NO TOOLS allowed for strict RAG proof
        LlmAgent ragAgent = LlmAgent.builder()
                .name("StrictRagAgent")
                .model(model)
                .instruction("Answer ONLY using the provided context. If not found, say you don't have details.")
                .build();

        InMemoryRunner runner = new InMemoryRunner(ragAgent);
        final StringBuilder result = new StringBuilder();
        try {
            String prompt = String.format("CONTEXT:\n%s\n\nQUERY: %s", context, query);
            runner.runAsync("test-user", "test-rag-" + UUID.randomUUID(), Content.fromParts(Part.fromText(prompt)), RunConfig.builder().build())
                    .blockingForEach(event -> { if (event.finalResponse()) result.append(event.stringifyContent()); });
            
            return Map.of("status", "SUCCESS", "retrieved_context", context, "agent_response", result.toString());
        } catch (Exception e) {
            return Map.of("status", "FAILED", "error", e.getMessage());
        }
    }
}