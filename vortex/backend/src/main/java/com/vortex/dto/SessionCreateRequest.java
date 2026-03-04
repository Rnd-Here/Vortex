package com.vortex.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor
public class SessionCreateRequest {
    private String apiKey;
    private String model;
    private String mode;
    private String initialMessage;
}