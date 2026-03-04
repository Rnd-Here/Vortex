package com.vortex.controller;

import com.vortex.service.IngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AdminController {

    private final IngestionService ingestionService;

    /**
     * Admin-only endpoint for high-control RAG ingestion.
     */
    @PostMapping("/ingest")
    public Map<String, String> ingestKnowledge(
            @RequestParam("file") MultipartFile file,
            @RequestParam("api_key") String apiKey,
            @RequestParam(value = "chunk_size", defaultValue = "1000") int chunkSize,
            @RequestParam(value = "chunk_overlap", defaultValue = "200") int chunkOverlap,
            @RequestParam(value = "temperature", defaultValue = "0.0") float temperature // Used for initial summarization if needed
    ) throws Exception {
        
        ingestionService.ingestDocument(file, apiKey, chunkSize, chunkOverlap);
        
        return Map.of(
                "status", "success", 
                "message", "Playground Knowledge Updated.",
                "file", file.getOriginalFilename()
        );
    }
}