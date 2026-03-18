package com.vortex.service;

import com.google.adk.agents.BaseAgent;
import com.google.adk.agents.LlmAgent;
import com.google.adk.agents.RunConfig;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.sessions.Session;
import com.google.adk.events.Event;
import com.google.adk.tools.BuiltInCodeExecutionTool;
import com.google.adk.tools.GoogleSearchTool;
import com.google.adk.tools.FunctionTool;
import com.google.adk.tools.AgentTool;
import com.google.adk.tools.annotations.Schema;
import com.google.adk.models.BaseLlm;
import com.google.adk.models.langchain4j.LangChain4j;
import dev.langchain4j.model.openai.OpenAiChatModel;
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

        if (file != null && !file.isEmpty()) {
            try {
                String contentType = file.getContentType();
                if (contentType != null && contentType.startsWith("image/")) {
                    partsList.add(Part.builder().inlineData(com.google.genai.types.Blob.builder().mimeType(contentType).data(file.getBytes()).build()).build());
                } else {
                    String extractedText = tika.parseToString(file.getInputStream());
                    enhancedQuery = String.format("FILE: %s\nCONTENT:\n%s\n\nUSER: %s", 
                            file.getOriginalFilename(), extractedText, query);
                }
            } catch (Exception e) {
                log.error("File processing failed: {}", e.getMessage());
            }
        }

        OpenAiChatModel openAiModel = OpenAiChatModel.builder()
                .baseUrl(proxyBaseUrl + "/v1")
                .apiKey(apiKey)
                .modelName(modelName)
                .build();

        BaseLlm configuredModel = new LangChain4j(openAiModel);

        InMemoryRunner runner = runnerCache.computeIfAbsent(modelName, m -> new InMemoryRunner(setupAgents(configuredModel, apiKey)));

        compressHistoryIfNecessary(runner, sessionId, configuredModel);

        final StringBuilder responseBuilder = new StringBuilder();
        try {
            String finalPrompt = String.format("[MODE: %s] %s", mode.toUpperCase(), enhancedQuery);
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
                String historyDump = session.events().stream().map(Event::stringifyContent).collect(Collectors.joining("\n"));
                LlmAgent summarizer = LlmAgent.builder().name("Summarizer").model(model).instruction("Summarize history concisely.").build();
                InMemoryRunner tempRunner = new InMemoryRunner(summarizer);
                final StringBuilder summary = new StringBuilder();
                Content cmd = Content.fromParts(Part.fromText("History to summarize:\n" + historyDump));
                tempRunner.runAsync("system", "temp-sum", cmd, runConfig).blockingForEach(event -> {
                    if (event.finalResponse()) summary.append(event.stringifyContent());
                });
                session.events().clear();
                session.events().add(Event.builder().id(Event.generateEventId()).author("System").content(Content.fromParts(Part.fromText("SUMMARY: " + summary))).build());
            }
        } catch (Exception ignored) {}
    }

    private BaseAgent setupAgents(BaseLlm model, String apiKey) {
        // 1. specialized atomic experts
        LlmAgent searchExpert = LlmAgent.builder()
                .name("SearchExpert").model(model)
                .description("Searches for real-time information on the web.")
                .tools(ImmutableList.of(new GoogleSearchTool()))
                .build();

        LlmAgent codeExecutor = LlmAgent.builder()
                .name("CodeExecutionExpert").model(model)
                .description("Executes Python code to solve math or logic problems.")
                .tools(ImmutableList.of(new BuiltInCodeExecutionTool()))
                .build();

        Object ragToolProvider = new Object() {
            @Schema(description = "Searches internal docs.")
            public String search_org_docs(@Schema(name = "query") String query) {
                return chromaService.searchDocs(query, apiKey);
            }
        };

        LlmAgent ragExpert = LlmAgent.builder()
                .name("OrgKnowledgeExpert").model(model)
                .description("Accesses internal organizational documents and policies.")
                .tools(ImmutableList.of(FunctionTool.create(ragToolProvider, "search_org_docs")))
                .build();

        // 2. Managers (wrapping agents as tools)
        LlmAgent codeAssistant = LlmAgent.builder()
                .name("CodeAssistant").model(model)
                .instruction("You are a Code Expert. Delegate to specialized tools.")
                .tools(ImmutableList.of(AgentTool.create(searchExpert), AgentTool.create(codeExecutor)))
                .build();

        LlmAgent orgAssistant = LlmAgent.builder()
                .name("OrgAssistant").model(model)
                .instruction("Org Assistant. Answer ONLY using provided docs.")
                .tools(ImmutableList.of(AgentTool.create(ragExpert)))
                .build();

        // 3. Root Orchestrator
        return LlmAgent.builder()
                .name("Orchestrator").model(model)
                .instruction("Analyze [MODE]. Delegate to CodeAssistant or OrgAssistant. Reject non-org queries in ORG mode.")
                .tools(ImmutableList.of(AgentTool.create(codeAssistant), AgentTool.create(orgAssistant)))
                .build();
    }
}