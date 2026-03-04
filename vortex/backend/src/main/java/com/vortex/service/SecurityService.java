package com.vortex.service;

import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Service
public class SecurityService {

    @Value("${secret.key}")
    private String secretKey;

    private static final String ALGORITHM = "AES";

    public String encrypt(String data) throws Exception {
        SecretKeySpec skeySpec = new SecretKeySpec(secretKey.substring(0, 16).getBytes(StandardCharsets.UTF_8), ALGORITHM);
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, skeySpec);
        byte[] encrypted = cipher.doFinal(data.getBytes());
        return Base64.getEncoder().encodeToString(encrypted);
    }

    public String decrypt(String encryptedData) throws Exception {
        SecretKeySpec skeySpec = new SecretKeySpec(secretKey.substring(0, 16).getBytes(StandardCharsets.UTF_8), ALGORITHM);
        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, skeySpec);
        byte[] original = cipher.doFinal(Base64.getDecoder().decode(encryptedData));
        return new String(original);
    }

    public String hashApiKey(String apiKey) {
        return DigestUtils.sha256Hex(apiKey);
    }
}