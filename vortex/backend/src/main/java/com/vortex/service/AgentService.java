package com.vortex.service;

import com.google.adk.agents.BaseAgent;
import com.google.adk.agents.LlmAgent;
import com.google.adk.agents.RunConfig;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.InMemorySessionService;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentService {

    private final ChromaService chromaService;
    private final InMemorySessionService adkSessionService = new InMemorySessionService();
    private final RunConfig runConfig = RunConfig.builder().build();
    private final Tika tika = new Tika();
    
    private final ConcurrentHashMap<String, InMemoryRunner> runnerCache = new ConcurrentHashMap<>();
    private static final int COMPRESSION_THRESHOLD = 15;

    @Value("${litellm.proxy.base-url}")
    private String proxyBaseUrl;

    public String processMultimodalRequest(String mode, String modelName, String apiKey, String sessionId, String query, MultipartFile file) {
        
        // 1. Prepare Multimodal Parts
        List<Part> parts = new ArrayList<>();
        String enhancedQuery = query;

        // 2. Handle File Attachment
        if (file != null && !file.isEmpty()) {
            try {
                String contentType = file.getContentType();
                if (contentType != null && contentType.startsWith("image/")) {
                    // Send as Image Part (Multimodal)
                    parts.add(Part.fromData(contentType, file.getBytes()));
                } else {
                    // Extract Text from Document and append to prompt
                    String extractedText = tika.parseToString(file.getInputStream());
                    enhancedQuery = String.format("ATTACHED_FILE: %s\nCONTENT:\n%s\n\nUSER_QUERY: %s", 
                            file.getOriginalFilename(), extractedText, query);
                }
            } catch (Exception e) {
                log.error("File processing failed: {}", e.getMessage());
            }
        }

        // 3. RAG Enrichment
        if ("org".equalsIgnoreCase(mode)) {
            String chromaContext = chromaService.queryKnowledge(query);
            if (!chromaContext.isEmpty()) {
                enhancedQuery = "INTERNAL_DOCS:\n" + chromaContext + "\n\n" + enhancedQuery;
            }
        }

        // 4. Configure Model and Runner
        BaseLlm configuredModel = ApigeeLlm.builder()
                .modelName(modelName)
                .proxyUrl(proxyBaseUrl)
                .customHeaders(ImmutableMap.of("Authorization", "Bearer " + apiKey))
                .build();

        compressHistoryIfNecessary(sessionId, configuredModel);
        BaseAgent orchestrator = setupAgents(configuredModel);
        InMemoryRunner runner = new InMemoryRunner(orchestrator, adkSessionService);
        
        final StringBuilder responseBuilder = new StringBuilder();
        try {
            String finalPrompt = String.format("[MODE: %s] %s", mode.toUpperCase(), enhancedQuery);
            parts.add(Part.fromText(finalPrompt));
            Content multimodalContent = Content.fromParts(parts);

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

    private void compressHistoryIfNecessary(String sessionId, BaseLlm model) {
        try {
            Session session = adkSessionService.getSession("Vortex", "user", sessionId, Optional.empty()).blockingGet();
            if (session != null && session.events().size() > COMPRESSION_THRESHOLD) {
                LlmAgent summarizer = LlmAgent.builder().name("Summarizer").model(model).instruction("Summarize history.").build();
                InMemoryRunner runner = new InMemoryRunner(summarizer, adkSessionService);
                final StringBuilder summary = new StringBuilder();
                Content cmd = Content.fromParts(Part.fromText("Summarize."));
                runner.runAsync("system", sessionId, cmd, runConfig).blockingForEach(e -> { if (e.finalResponse()) summary.append(e.stringifyContent()); });
                session.events().clear();
                session.events().add(Event.builder().id(Event.generateEventId()).author("System").content(Content.fromParts(Part.fromText("SUMMARY: " + summary))).build());
            }
        } catch (Exception ignored) {}
    }

    private BaseAgent setupAgents(BaseLlm model) {
        LlmAgent codeAgent = LlmAgent.builder().name("CodeAgent").model(model).instruction("Expert Code Assistant.").tools(ImmutableList.of(new BuiltInCodeExecutionTool(), new GoogleSearchTool())).build();
        LlmAgent orgAssistant = LlmAgent.builder().name("OrgAssistant").model(model).instruction("Internal Org Assistant.").build();
        return LlmAgent.builder().name("Orchestrator").model(model).instruction("Analyze MODE and Query. Route to CodeAgent or OrgAssistant.").subAgents(codeAgent, orgAssistant).build();
    }
}