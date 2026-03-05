package com.vortex.service;

import com.google.adk.agents.BaseAgent;
import com.google.adk.agents.LlmAgent;
import com.google.adk.agents.RunConfig;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.Session;
import com.google.adk.events.Event;
import com.google.adk.tools.BuiltInCodeExecutionTool;
import com.google.adk.tools.GoogleSearchTool;
import com.google.adk.models.BaseLlm;
import com.google.adk.models.ApigeeLlm;
import com.google.common.collect.ImmutableList;
import com.google.common.collect.ImmutableMap;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentService {

    private final ChromaService chromaService;
    private final RunConfig runConfig = RunConfig.builder().build();
    private final Tika tika = new Tika();
    
    private final ConcurrentHashMap<String, InMemoryRunner> runnerCache = new ConcurrentHashMap<>();
    private static final int COMPRESSION_THRESHOLD = 15;

    @Value("${litellm.proxy.base-url}")
    private String proxyBaseUrl;

    public String processMultimodalRequest(String mode, String modelName, String apiKey, String sessionId, String query, MultipartFile file) {
        
        List<Part> partsList = new ArrayList<>();
        String enhancedQuery = query;

        // 1. Handle File Attachment
        if (file != null && !file.isEmpty()) {
            try {
                String contentType = file.getContentType();
                if (contentType != null && contentType.startsWith("image/")) {
                    partsList.add(Part.builder().inlineData(com.google.genai.types.Blob.builder().mimeType(contentType).data(file.getBytes()).build()).build());
                } else {
                    String extractedText = tika.parseToString(file.getInputStream());
                    enhancedQuery = String.format("ATTACHED_FILE: %s\nCONTENT:\n%s\n\nUSER_QUERY: %s", 
                            file.getOriginalFilename(), extractedText, query);
                }
            } catch (Exception e) {
                log.error("File processing failed: {}", e.getMessage());
            }
        }

        // 2. RAG Enrichment (Org Mode only)
        if ("org".equalsIgnoreCase(mode)) {
            String chromaContext = chromaService.queryKnowledge(query, apiKey);
            if (!chromaContext.isEmpty()) {
                enhancedQuery = "INTERNAL_DOCS:\n" + chromaContext + "\n\n" + enhancedQuery;
            }
        }

        // 3. Configure the Model
        BaseLlm configuredModel = ApigeeLlm.builder()
                .modelName(modelName)
                .proxyUrl(proxyBaseUrl)
                .customHeaders(ImmutableMap.of("Authorization", "Bearer " + apiKey))
                .build();

        // 4. Get or Create Runner
        InMemoryRunner runner = runnerCache.computeIfAbsent(modelName, m -> new InMemoryRunner(setupAgents(configuredModel)));

        // 5. Context Compression Check
        compressHistoryIfNecessary(runner, sessionId, configuredModel);

        final StringBuilder responseBuilder = new StringBuilder();
        try {
            String finalPrompt = String.format("[SESSION_MODE: %s] %s", mode.toUpperCase(), enhancedQuery);
            partsList.add(Part.fromText(finalPrompt));
            Content multimodalContent = Content.fromParts(partsList.toArray(new Part[0]));

            runner.runAsync("user", sessionId, multimodalContent, runConfig).blockingForEach(event -> {
                if (event.finalResponse()) {
                    responseBuilder.append(event.stringifyContent());
                }
            });
        } catch (Exception e) {
            log.error("ADK Execution Error: {}", e.getMessage());
            return "Vortex Connection Exception: " + e.getMessage();
        }

        return responseBuilder.toString();
    }

    private void compressHistoryIfNecessary(InMemoryRunner runner, String sessionId, BaseLlm model) {
        try {
            Session session = runner.sessionService().getSession("Vortex", "user", sessionId, Optional.empty()).blockingGet();
            if (session != null && session.events().size() > COMPRESSION_THRESHOLD) {
                log.info("Triggering Context Compression for Session: {}", sessionId);
                
                // Extract historical text
                String historyDump = session.events().stream()
                        .map(Event::stringifyContent)
                        .collect(Collectors.joining("\n"));

                LlmAgent summarizer = LlmAgent.builder().name("Summarizer").model(model).instruction("Summarize the following conversation history into a concise 3-sentence foundation.").build();
                InMemoryRunner tempRunner = new InMemoryRunner(summarizer);
                final StringBuilder summary = new StringBuilder();
                Content cmd = Content.fromParts(Part.fromText("History to summarize:\n" + historyDump));
                
                tempRunner.runAsync("system", "temp-sum", cmd, runConfig).blockingForEach(event -> {
                    if (event.finalResponse()) summary.append(event.stringifyContent());
                });

                // Replace history with the summary
                session.events().clear();
                session.events().add(Event.builder()
                        .id(Event.generateEventId())
                        .author("System")
                        .content(Content.fromParts(Part.fromText("FOUNDATIONAL_SUMMARY: " + summary)))
                        .build());
                log.info("Compression complete. New foundation established.");
            }
        } catch (Exception e) {
            log.warn("Compression sequence failed: {}", e.getMessage());
        }
    }

    private BaseAgent setupAgents(BaseLlm model) {
        LlmAgent codeAgent = LlmAgent.builder()
                .name("CodeAgent")
                .model(model)
                .instruction("You are an expert Code Assistant. Use your tools to verify logic and search for documentation.")
                .tools(ImmutableList.of(new BuiltInCodeExecutionTool(), new GoogleSearchTool()))
                .build();

        LlmAgent orgAssistant = LlmAgent.builder()
                .name("OrgAssistant")
                .model(model)
                .instruction("Internal Org Assistant. Answer ONLY using provided docs. If missing, say 'I don't have details on this can you check with mentors.'")
                .build();

        return LlmAgent.builder()
                .name("Orchestrator")
                .model(model)
                .instruction("Analyze [SESSION_MODE].\n" +
                             "1. CODE: Route to CodeAgent.\n" +
                             "2. ORG: If organizational query, route to OrgAssistant. Else, respond that you are an org agent.")
                .subAgents(codeAgent, orgAssistant)
                .build();
    }
}