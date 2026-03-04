package com.vortex.service;

import com.vortex.dto.*;
import com.vortex.model.Session;
import com.vortex.repository.SessionRepository;
import com.vortex.repository.MessageRepository;
import com.github.f4b6a3.ulid.UlidCreator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final SessionRepository sessionRepository;
    private final MessageRepository messageRepository;
    private final SecurityService securityService;
    private final AgentService agentService;

    @Transactional
    public SessionResponse createSession(SessionCreateRequest request) throws Exception {
        String id = UlidCreator.getUlid().toString();
        String encryptedKey = securityService.encrypt(request.getApiKey());
        String keyHash = securityService.hashApiKey(request.getApiKey());
        String name = generateName(request.getInitialMessage());

        Session session = Session.builder()
                .id(id)
                .encryptedApiKey(encryptedKey)
                .apiKeyHash(keyHash)
                .name(name)
                .model(request.getModel())
                .mode(request.getMode())
                .createdAt(LocalDateTime.now())
                .messages(new ArrayList<>())
                .build();

        sessionRepository.save(session);

        com.vortex.model.Message userMsg = com.vortex.model.Message.builder()
                .session(session)
                .role("user")
                .content(request.getInitialMessage())
                .timestamp(LocalDateTime.now())
                .build();
        messageRepository.save(userMsg);

        return mapToResponse(session);
    }

    @Transactional
    public ChatResponse processMultimodalChat(String sessionId, String content, MultipartFile file) throws Exception {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        // 1. Save Text Message to DB
        com.vortex.model.Message userMsg = com.vortex.model.Message.builder()
                .session(session)
                .role("user")
                .content(content + (file != null ? " [Attachment: " + file.getOriginalFilename() + "]" : ""))
                .timestamp(LocalDateTime.now())
                .build();
        messageRepository.save(userMsg);

        String apiKey = securityService.decrypt(session.getEncryptedApiKey());
        
        // 2. Process with ADK Agent (Multimodal)
        String assistantContent = agentService.processMultimodalRequest(
                session.getMode(),
                session.getModel(),
                apiKey,
                session.getId(),
                content,
                file
        );

        // 3. Save Assistant response
        com.vortex.model.Message assistantMsg = com.vortex.model.Message.builder()
                .session(session)
                .role("assistant")
                .content(assistantContent)
                .timestamp(LocalDateTime.now())
                .build();
        messageRepository.save(assistantMsg);
        
        return ChatResponse.builder()
                .role("assistant")
                .content(assistantContent)
                .build();
    }

    public List<SessionResponse> getSessions(String apiKey) {
        String keyHash = securityService.hashApiKey(apiKey);
        return sessionRepository.findByApiKeyHashOrderByCreatedAtDesc(keyHash)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<MessageResponse> getMessageHistory(String sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        
        return session.getMessages().stream()
                .map(m -> MessageResponse.builder()
                        .id(m.getId())
                        .role(m.getRole())
                        .content(m.getContent())
                        .timestamp(m.getTimestamp())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional
    public void renameSession(String sessionId, String newName) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setName(newName);
        sessionRepository.save(session);
    }

    @Transactional
    public void deleteSession(String sessionId) {
        sessionRepository.deleteById(sessionId);
    }

    @Transactional
    public void updateModel(String sessionId, String newModel) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setModel(newModel);
        sessionRepository.save(session);
    }

    private String generateName(String initialMessage) {
        if (initialMessage == null || initialMessage.isEmpty()) return "New Chat";
        String[] words = initialMessage.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(words.length, 3); i++) sb.append(words[i]).append(" ");
        String name = sb.toString().trim();
        return name.length() > 30 ? name.substring(0, 27) + "..." : name;
    }

    private SessionResponse mapToResponse(Session session) {
        return SessionResponse.builder()
                .id(session.getId())
                .name(session.getName())
                .model(session.getModel())
                .mode(session.getMode())
                .isMock(session.isMock())
                .createdAt(session.getCreatedAt())
                .build();
    }
}