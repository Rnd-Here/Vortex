package com.vortex.controller;

import com.vortex.dto.*;
import com.vortex.service.ChatService;
import com.vortex.service.FileService;
import com.vortex.service.LiteLlmService;
import com.vortex.service.IngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ChatController {

    private final ChatService chatService;
    private final LiteLlmService liteLlmService;
    private final FileService fileService;
    private final IngestionService ingestionService;

    @PostMapping("/models")
    public Mono<ModelListResponse> fetchModels(@RequestBody ModelFetchRequest request) {
        return liteLlmService.fetchAvailableModels(request.getApiKey());
    }

    @PostMapping("/sessions")
    public SessionResponse createSession(@RequestBody SessionCreateRequest request) throws Exception {
        return chatService.createSession(request);
    }

    @PostMapping("/sessions/filter")
    public List<SessionResponse> getSessions(@RequestBody Map<String, String> body) {
        String apiKey = body.get("api_key");
        if (apiKey == null) apiKey = body.get("apiKey"); 
        return apiKey != null ? chatService.getSessions(apiKey) : List.of();
    }

    @GetMapping("/sessions/{sessionId}/messages")
    public List<MessageResponse> getMessageHistory(@PathVariable String sessionId) {
        return chatService.getMessageHistory(sessionId);
    }

    /**
     * Multimodal Chat Endpoint
     * Handles Text and optional File/Image in a single request.
     */
    @PostMapping("/chat")
    public ChatResponse chat(
            @RequestParam("session_id") String sessionId,
            @RequestParam("content") String content,
            @RequestParam(value = "file", required = false) MultipartFile file
    ) throws Exception {
        return chatService.processMultimodalChat(sessionId, content, file);
    }

    @PatchMapping("/sessions/{sessionId}")
    public Map<String, Boolean> updateSession(@PathVariable String sessionId, @RequestBody Map<String, String> body) {
        if (body.containsKey("name")) {
            chatService.renameSession(sessionId, body.get("name"));
        } else if (body.containsKey("model")) {
            chatService.updateModel(sessionId, body.get("model"));
        }
        return Map.of("success", true);
    }

    @DeleteMapping("/sessions/{sessionId}")
    public Map<String, Boolean> deleteSession(@PathVariable String sessionId) {
        chatService.deleteSession(sessionId);
        return Map.of("success", true);
    }

    @PostMapping("/transcribe")
    public TranscribeResponse transcribe(@RequestParam("file") MultipartFile file) {
        return fileService.transcribe(file);
    }

    @PostMapping("/ingest")
    public Map<String, String> ingestKnowledge(@RequestParam("file") MultipartFile file, @RequestParam("api_key") String apiKey) throws Exception {
        ingestionService.ingestDocument(file, apiKey, 1000, 200);
        return Map.of("status", "success", "message", "Document ingested and vectorized.");
    }
}