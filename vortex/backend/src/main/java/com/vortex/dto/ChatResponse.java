package com.vortex.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ChatResponse {
    private String role;
    private String content;
}