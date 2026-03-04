package com.vortex.dto;

import lombok.*;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class ModelListResponse {
    private List<String> models;
}