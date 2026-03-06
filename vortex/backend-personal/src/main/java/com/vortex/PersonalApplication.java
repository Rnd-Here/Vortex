package main.java.com.vortex;

import com.google.adk.agents.LlmAgent;
import com.google.adk.agents.RunConfig;
import com.google.adk.models.GeminiLlm;
import com.google.adk.runner.InMemoryRunner;
import com.google.adk.tools.BuiltInCodeExecutionTool;
import com.google.adk.tools.GoogleSearchTool;
import com.google.common.collect.ImmutableList;
import com.google.genai.types.Content;
import com.google.genai.types.Part;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@SpringBootApplication
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class PersonalApplication {

    private final ConcurrentHashMap<String, InMemoryRunner> sessionCache = new ConcurrentHashMap<>();

    public static void main(String[] args) {
        System.setProperty("server.port", "8003");
        SpringApplication.run(PersonalApplication.class, args);
    }

    @PostMapping("/models")
    public Map<String, List<String>> fetchModels(@RequestBody Map<String, Object> body) {
        return Map.of("models", List.of("gemini-2.0-flash", "gemini-1.5-pro"));
    }

    @PostMapping("/sessions")
    public Map<String, String> createSession(@RequestBody Map<String, String> request) {
        return Map.of(
            "id", "pers-java-" + UUID.randomUUID(),
            "name", request.getOrDefault("initial_message", "New Personal Chat"),
            "model", request.getOrDefault("model", "gemini-2.0-flash"),
            "mode", "code"
        );
    }

    @PostMapping("/transcribe")
    public Map<String, String> transcribe() {
        return Map.of("text", "Personal audio processed.");
    }

    @PostMapping("/chat")
    public Map<String, String> chat(
            @RequestParam("session_id") String sessionId,
            @RequestParam("content") String content,
            @RequestParam("api_key") String apiKey,
            @RequestParam(value = "model", defaultValue = "gemini-2.0-flash") String modelName
    ) {
        // 1. Initialize Direct Gemini Model (No Proxy)
        GeminiLlm model = GeminiLlm.builder()
                .modelName(modelName)
                .apiKey(apiKey)
                .build();

        // 2. Setup Nested Experts
        LlmAgent searchExpert = LlmAgent.builder()
                .name("SearchExpert").model(model).tools(ImmutableList.of(new GoogleSearchTool())).build();
        LlmAgent codeExecutor = LlmAgent.builder()
                .name("CodeExecutor").model(model).tools(ImmutableList.of(new BuiltInCodeExecutionTool())).build();

        LlmAgent orchestrator = LlmAgent.builder()
                .name("PersonalJavaAssistant")
                .model(model)
                .instruction("Personal Assistant. Use sub-agents for search/code.")
                .subAgents(searchExpert, codeExecutor)
                .build();

        InMemoryRunner runner = sessionCache.computeIfAbsent(sessionId, k -> new InMemoryRunner(orchestrator));
        
        final StringBuilder response = new StringBuilder();
        try {
            Content msg = Content.fromParts(Part.fromText(content));
            runner.runAsync("user", sessionId, msg, RunConfig.builder().build()).blockingForEach(e -> {
                if (e.finalResponse()) response.append(e.stringifyContent());
            });
            return Map.of("role", "assistant", "content", response.toString());
        } catch (Exception e) {
            return Map.of("role", "assistant", "content", "Java Personal Error: " + e.getMessage());
        }
    }
}