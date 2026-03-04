package com.vortex.dto;

import lombok.*;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class TranscribeResponse {
    private String text;
}