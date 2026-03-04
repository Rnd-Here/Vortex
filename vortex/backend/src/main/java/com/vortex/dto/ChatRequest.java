package com.vortex.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class ChatRequest {
    private String sessionId;
    private String content;
}