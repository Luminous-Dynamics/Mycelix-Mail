//! Cryptographic services for end-to-end encryption
//!
//! Uses X25519 for key exchange and ChaCha20-Poly1305 for message encryption.
//! This ensures messages are encrypted on the client side before being stored
//! on the DHT, providing true end-to-end privacy.

use base64::{
    engine::general_purpose::{STANDARD as BASE64, STANDARD_NO_PAD},
    Engine as _,
};
use chacha20poly1305::{
    aead::{Aead, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use rand::RngCore;
use sha2::{Digest, Sha256};
use x25519_dalek::{EphemeralSecret, PublicKey, StaticSecret};

use crate::error::{AppError, AppResult};

/// Encrypted message envelope
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EncryptedEnvelope {
    /// Ephemeral public key used for this message (32 bytes, base64)
    pub ephemeral_pubkey: String,
    /// Nonce used for encryption (12 bytes, base64)
    pub nonce: String,
    /// Encrypted ciphertext (base64)
    pub ciphertext: String,
}

/// Key pair for encryption operations
pub struct KeyPair {
    pub secret: StaticSecret,
    pub public: PublicKey,
}

impl KeyPair {
    /// Generate a new random key pair
    pub fn generate() -> Self {
        let secret = StaticSecret::random_from_rng(OsRng);
        let public = PublicKey::from(&secret);
        Self { secret, public }
    }

    /// Create from existing secret bytes
    pub fn from_secret_bytes(bytes: [u8; 32]) -> Self {
        let secret = StaticSecret::from(bytes);
        let public = PublicKey::from(&secret);
        Self { secret, public }
    }

    /// Get public key as bytes
    pub fn public_bytes(&self) -> [u8; 32] {
        self.public.to_bytes()
    }
}

/// Encrypt a message for a recipient
///
/// Uses X25519 ECDH to derive a shared secret, then encrypts with ChaCha20-Poly1305.
/// The ephemeral public key and nonce are included in the envelope for decryption.
pub fn encrypt_for_recipient(
    plaintext: &[u8],
    recipient_pubkey: &[u8; 32],
) -> AppResult<EncryptedEnvelope> {
    // Generate ephemeral key pair for this message
    let ephemeral_secret = EphemeralSecret::random_from_rng(OsRng);
    let ephemeral_public = PublicKey::from(&ephemeral_secret);

    // Derive shared secret via ECDH
    let recipient_key = PublicKey::from(*recipient_pubkey);
    let shared_secret = ephemeral_secret.diffie_hellman(&recipient_key);

    // Derive encryption key from shared secret using SHA-256
    let mut hasher = Sha256::new();
    hasher.update(shared_secret.as_bytes());
    let key_bytes: [u8; 32] = hasher.finalize().into();

    // Create cipher and generate random nonce
    let cipher = ChaCha20Poly1305::new_from_slice(&key_bytes)
        .map_err(|e| AppError::EncryptionError(format!("Failed to create cipher: {}", e)))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::EncryptionError(format!("Encryption failed: {}", e)))?;

    Ok(EncryptedEnvelope {
        ephemeral_pubkey: BASE64.encode(ephemeral_public.as_bytes()),
        nonce: BASE64.encode(nonce_bytes),
        ciphertext: BASE64.encode(ciphertext),
    })
}

/// Decrypt a message using recipient's secret key
pub fn decrypt_envelope(
    envelope: &EncryptedEnvelope,
    recipient_secret: &StaticSecret,
) -> AppResult<Vec<u8>> {
    // Decode ephemeral public key
    let ephemeral_bytes = BASE64
        .decode(&envelope.ephemeral_pubkey)
        .map_err(|_| AppError::EncryptionError("Invalid ephemeral pubkey".to_string()))?;

    if ephemeral_bytes.len() != 32 {
        return Err(AppError::EncryptionError(
            "Invalid ephemeral pubkey length".to_string(),
        ));
    }

    let mut ephemeral_arr = [0u8; 32];
    ephemeral_arr.copy_from_slice(&ephemeral_bytes);
    let ephemeral_pubkey = PublicKey::from(ephemeral_arr);

    // Derive shared secret
    let shared_secret = recipient_secret.diffie_hellman(&ephemeral_pubkey);

    // Derive encryption key
    let mut hasher = Sha256::new();
    hasher.update(shared_secret.as_bytes());
    let key_bytes: [u8; 32] = hasher.finalize().into();

    // Create cipher
    let cipher = ChaCha20Poly1305::new_from_slice(&key_bytes)
        .map_err(|e| AppError::EncryptionError(format!("Failed to create cipher: {}", e)))?;

    // Decode nonce
    let nonce_bytes = BASE64
        .decode(&envelope.nonce)
        .map_err(|_| AppError::EncryptionError("Invalid nonce".to_string()))?;

    if nonce_bytes.len() != 12 {
        return Err(AppError::EncryptionError(
            "Invalid nonce length".to_string(),
        ));
    }

    let nonce = Nonce::from_slice(&nonce_bytes);

    // Decode ciphertext
    let ciphertext = BASE64
        .decode(&envelope.ciphertext)
        .map_err(|_| AppError::EncryptionError("Invalid ciphertext".to_string()))?;

    // Decrypt
    cipher
        .decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| AppError::EncryptionError(format!("Decryption failed: {}", e)))
}

/// Simple symmetric encryption (for local storage, session data, etc.)
pub fn encrypt_symmetric(plaintext: &[u8], key: &[u8; 32]) -> AppResult<(Vec<u8>, [u8; 12])> {
    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| AppError::EncryptionError(format!("Failed to create cipher: {}", e)))?;

    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| AppError::EncryptionError(format!("Encryption failed: {}", e)))?;

    Ok((ciphertext, nonce_bytes))
}

/// Simple symmetric decryption
pub fn decrypt_symmetric(
    ciphertext: &[u8],
    nonce: &[u8; 12],
    key: &[u8; 32],
) -> AppResult<Vec<u8>> {
    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|e| AppError::EncryptionError(format!("Failed to create cipher: {}", e)))?;

    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::EncryptionError(format!("Decryption failed: {}", e)))
}

/// Derive a key from a password using Argon2
pub fn derive_key_from_password(password: &str, salt: &[u8]) -> AppResult<[u8; 32]> {
    use argon2::{password_hash::SaltString, Argon2, PasswordHasher};

    // Create salt string (must be valid base64)
    let salt_b64 = STANDARD_NO_PAD.encode(salt);
    let salt_string = SaltString::from_b64(&salt_b64)
        .map_err(|e| AppError::EncryptionError(format!("Invalid salt: {}", e)))?;

    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| AppError::EncryptionError(format!("Key derivation failed: {}", e)))?;

    // Extract 32 bytes from hash output
    let hash_bytes = hash.hash.ok_or_else(|| {
        AppError::EncryptionError("Failed to get hash output".to_string())
    })?;

    let mut key = [0u8; 32];
    key.copy_from_slice(&hash_bytes.as_bytes()[..32]);
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let plaintext = b"Hello, Mycelix!";

        // Generate recipient key pair
        let recipient = KeyPair::generate();

        // Encrypt for recipient
        let envelope = encrypt_for_recipient(plaintext, &recipient.public_bytes()).unwrap();

        // Decrypt with recipient's secret
        let decrypted = decrypt_envelope(&envelope, &recipient.secret).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_symmetric_roundtrip() {
        let plaintext = b"Secret message";
        let key = [42u8; 32];

        let (ciphertext, nonce) = encrypt_symmetric(plaintext, &key).unwrap();
        let decrypted = decrypt_symmetric(&ciphertext, &nonce, &key).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_wrong_key_fails() {
        let plaintext = b"Hello";

        let recipient1 = KeyPair::generate();
        let recipient2 = KeyPair::generate();

        // Encrypt for recipient1
        let envelope = encrypt_for_recipient(plaintext, &recipient1.public_bytes()).unwrap();

        // Try to decrypt with recipient2's key - should fail
        let result = decrypt_envelope(&envelope, &recipient2.secret);
        assert!(result.is_err());
    }
}
