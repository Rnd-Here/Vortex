package com.vortex.repository;

import com.vortex.model.Session;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<Session, String> {
    List<Session> findByApiKeyHashOrderByCreatedAtDesc(String apiKeyHash);
}
