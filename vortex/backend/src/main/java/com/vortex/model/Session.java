package com.vortex.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "sessions", indexes = {@Index(name = "idx_apikeyhash", columnList = "apiKeyHash")})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Session {
    @Id
    private String id; // ULID

    @Column(nullable = false)
    private String encryptedApiKey;

    @Column(nullable = false)
    private String apiKeyHash;

    private String name;
    private String model;
    @Column(columnDefinition = "TEXT")
    private String previousModels; // Comma-separated history of models used
    private String mode;
    private boolean isMock;
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Message> messages;
}