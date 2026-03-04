package com.vortex.dto;

import lombok.*;
import java.time.LocalDateTime;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class MessageResponse {
    private Long id;
    private String role;
    private String content;
    private LocalDateTime timestamp;
}