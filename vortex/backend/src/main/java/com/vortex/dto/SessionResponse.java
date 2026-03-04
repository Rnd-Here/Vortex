package com.vortex.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class SessionResponse {
    private String id;
    private String name;
    private String model;
    private String mode;
    private boolean isMock;
    private LocalDateTime createdAt;
}