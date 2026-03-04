package com.vortex.service;

import com.vortex.dto.TranscribeResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Service
@Slf4j
public class FileService {

    public TranscribeResponse transcribe(MultipartFile file) {
        log.info("Processing transcription for: {}", file.getOriginalFilename());
        // Placeholder for LiteLLM Whisper API integration
        return TranscribeResponse.builder()
                .text("")
                .build();
    }

    public Map<String, Object> parseAndUpload(MultipartFile file, String sessionId) {
        log.info("Parsing file for session: {}, file: {}", sessionId, file.getOriginalFilename());
        
        // In a real implementation, you would use Tika or a similar library 
        // to extract text here. Removing all mock strings.
        
        return Map.of(
                "filename", file.getOriginalFilename(),
                "status", "uploaded",
                "parsed_content", ""
        );
    }
}