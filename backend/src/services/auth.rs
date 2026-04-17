use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use sqlx::{SqlitePool, Row};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct GoogleUserInfo {
    pub sub: String,
    pub email: String,
    pub name: Option<String>,
    pub given_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubUserInfo {
    pub id: u64,
    pub email: Option<String>,
    pub login: String,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GitHubEmail {
    pub email: String,
    pub primary: bool,
    pub verified: bool,
}

#[derive(Clone)]
pub struct NonceStore {
    store: Arc<Mutex<HashMap<String, (String, std::time::Instant)>>>,
}

impl NonceStore {
    pub fn new() -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn store_nonce(&self, address: &str, nonce: String) {
        let mut store = self.store.lock().await;
        store.insert(address.to_string(), (nonce, std::time::Instant::now()));
    }

    pub async fn get_nonce(&self, address: &str) -> Option<String> {
        let store = self.store.lock().await;
        store.get(address).map(|(nonce, _)| nonce.clone())
    }

    pub async fn remove_nonce(&self, address: &str) {
        let mut store = self.store.lock().await;
        store.remove(address);
    }

    pub async fn cleanup_expired(&self) {
        let mut store = self.store.lock().await;
        let now = std::time::Instant::now();
        store.retain(|_, (_, timestamp)| {
            now.duration_since(*timestamp).as_secs() < 600
        });
    }
}

pub struct AuthService;

impl AuthService {
    pub fn hash_password(password: &str) -> Result<String, bcrypt::BcryptError> {
        hash(password, DEFAULT_COST)
    }

    pub fn verify_password(password: &str, hash: &str) -> Result<bool, bcrypt::BcryptError> {
        verify(password, hash)
    }

    pub fn generate_token(user_id: &str, email: &str, jwt_secret: &str) -> Result<String, jsonwebtoken::errors::Error> {
        let expiration = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::days(1))
            .expect("valid timestamp")
            .timestamp() as usize;

        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            exp: expiration,
        };

        encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret.as_bytes()))
    }

    pub fn verify_token(token: &str, jwt_secret: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(jwt_secret.as_bytes()),
            &Validation::default(),
        )?;

        Ok(token_data.claims)
    }

    pub async fn verify_google_token(token: &str) -> Result<GoogleUserInfo, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let response = client
            .get("https://www.googleapis.com/oauth2/v3/userinfo")
            .bearer_auth(token)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err("Invalid Google token".into());
        }

        let user_info: GoogleUserInfo = response.json().await?;
        Ok(user_info)
    }

    pub async fn exchange_google_code(code: &str, redirect_uri: &str, client_id: &str, client_secret: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let params = [
            ("code", code),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri),
            ("grant_type", "authorization_code"),
        ];

        let response = client
            .post("https://oauth2.googleapis.com/token")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body = response.text().await.unwrap_or_else(|_| "Unable to read error body".to_string());
            tracing::error!("Google token exchange failed with status {}: {}", status, error_body);
            return Err(format!("Failed to exchange Google code: {} - {}", status, error_body).into());
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
        }

        let token_response: TokenResponse = response.json().await?;
        Ok(token_response.access_token)
    }

    pub async fn exchange_github_code(code: &str, redirect_uri: &str, client_id: &str, client_secret: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let params = [
            ("code", code),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri),
        ];

        let response = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .form(&params)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err("Failed to exchange GitHub code".into());
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
        }

        let token_response: TokenResponse = response.json().await?;
        Ok(token_response.access_token)
    }

    pub async fn get_github_user_info(token: &str) -> Result<(GitHubUserInfo, String), Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        
        let user_response = client
            .get("https://api.github.com/user")
            .bearer_auth(token)
            .header("User-Agent", "multisigmonitor")
            .send()
            .await?;

        if !user_response.status().is_success() {
            return Err("Failed to get GitHub user info".into());
        }

        let user_info: GitHubUserInfo = user_response.json().await?;

        let email = if let Some(email) = user_info.email.clone() {
            email
        } else {
            let emails_response = client
                .get("https://api.github.com/user/emails")
                .bearer_auth(token)
                .header("User-Agent", "multisigmonitor")
                .send()
                .await?;

            if !emails_response.status().is_success() {
                return Err("Failed to get GitHub user emails".into());
            }

            let emails: Vec<GitHubEmail> = emails_response.json().await?;
            emails
                .iter()
                .find(|e| e.primary && e.verified)
                .map(|e| e.email.clone())
                .ok_or("No verified primary email found")?
        };

        Ok((user_info, email))
    }

    pub fn generate_nonce() -> String {
        Uuid::new_v4().to_string()
    }

    fn hash_token(token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub async fn issue_refresh_token(
        pool: &SqlitePool,
        user_id: &str,
        family_id: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        let raw_token = Uuid::new_v4().to_string();
        let token_hash = Self::hash_token(&raw_token);
        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now();
        let expires_at = (now + chrono::Duration::days(30)).to_rfc3339();
        let created_at = now.to_rfc3339();

        sqlx::query(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(user_id)
        .bind(&token_hash)
        .bind(family_id)
        .bind(&expires_at)
        .bind(&created_at)
        .execute(pool)
        .await?;

        Ok(raw_token)
    }

    pub async fn rotate_refresh_token(
        pool: &SqlitePool,
        raw_token: &str,
    ) -> Result<(String, String), Box<dyn std::error::Error + Send + Sync>> {
        let token_hash = Self::hash_token(raw_token);
        let now = chrono::Utc::now();
        let now_str = now.to_rfc3339();

        let mut tx = pool.begin().await?;

        let row = sqlx::query(
            "SELECT id, user_id, family_id, revoked, expires_at FROM refresh_tokens WHERE token_hash = ?"
        )
        .bind(&token_hash)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or("Refresh token not found")?;

        let revoked: i64 = row.get("revoked");
        let family_id: String = row.get("family_id");
        let user_id: String = row.get("user_id");
        let expires_at: String = row.get("expires_at");
        let token_id: String = row.get("id");

        if revoked != 0 {
            sqlx::query("UPDATE refresh_tokens SET revoked = 1 WHERE family_id = ?")
                .bind(&family_id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            return Err("Refresh token reuse detected - session revoked".into());
        }

        if expires_at < now_str {
            tx.rollback().await?;
            return Err("Refresh token expired".into());
        }

        sqlx::query("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?")
            .bind(&token_id)
            .execute(&mut *tx)
            .await?;

        let new_raw_token = Uuid::new_v4().to_string();
        let new_token_hash = Self::hash_token(&new_raw_token);
        let new_id = Uuid::new_v4().to_string();
        let new_expires_at = (now + chrono::Duration::days(30)).to_rfc3339();

        sqlx::query(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&new_id)
        .bind(&user_id)
        .bind(&new_token_hash)
        .bind(&family_id)
        .bind(&new_expires_at)
        .bind(&now_str)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok((user_id, new_raw_token))
    }

    pub async fn revoke_refresh_token(
        pool: &SqlitePool,
        raw_token: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let token_hash = Self::hash_token(raw_token);
        sqlx::query("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?")
            .bind(&token_hash)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub async fn cleanup_expired_refresh_tokens(
        pool: &SqlitePool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query("DELETE FROM refresh_tokens WHERE expires_at < ? OR revoked = 1")
            .bind(&now)
            .execute(pool)
            .await?;
        Ok(())
    }

    pub fn verify_ethereum_signature(
        message: &str,
        signature: &str,
        expected_nonce: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        use siwe::Message;

        tracing::info!("Parsing SIWE message...");
        let siwe_message: Message = message.parse()
            .map_err(|e| {
                tracing::error!("Failed to parse SIWE message: {}", e);
                e
            })?;

        if siwe_message.nonce != expected_nonce {
            tracing::error!("SIWE nonce mismatch for address: {}", hex::encode(siwe_message.address));
            return Err("SIWE nonce mismatch".into());
        }

        if let Some(ref exp) = siwe_message.expiration_time {
            if exp.as_ref() <= &time::OffsetDateTime::now_utc() {
                tracing::error!("SIWE message expired");
                return Err("SIWE message expired".into());
            }
        }

        tracing::info!("Decoding signature hex...");
        let sig_bytes: [u8; 65] = hex::decode(signature.trim_start_matches("0x"))
            .map_err(|e| {
                tracing::error!("Invalid signature hex: {}", e);
                "Invalid signature hex"
            })?
            .try_into()
            .map_err(|_| {
                tracing::error!("Signature must be 65 bytes");
                "Signature must be 65 bytes"
            })?;

        tracing::info!("Verifying EIP-191 signature...");
        siwe_message.verify_eip191(&sig_bytes)
            .map_err(|e| {
                tracing::error!("Signature verification failed: {}", e);
                e
            })?;

        let recovered_address = hex::encode(siwe_message.address);

        tracing::info!("Successfully verified signature, recovered address: {}", recovered_address);
        Ok(recovered_address)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_nonce() {
        let nonce1 = AuthService::generate_nonce();
        let nonce2 = AuthService::generate_nonce();
        
        assert!(!nonce1.is_empty(), "Nonce should not be empty");
        assert!(!nonce2.is_empty(), "Nonce should not be empty");
        assert_ne!(nonce1, nonce2, "Each nonce should be unique");
        assert!(Uuid::parse_str(&nonce1).is_ok(), "Nonce should be valid UUID");
    }

    #[tokio::test]
    async fn test_nonce_store() {
        let store = NonceStore::new();
        let address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
        let nonce = "test-nonce-123";

        store.store_nonce(address, nonce.to_string()).await;
        
        let retrieved = store.get_nonce(address).await;
        assert_eq!(retrieved, Some(nonce.to_string()), "Should retrieve stored nonce");

        store.remove_nonce(address).await;
        let removed = store.get_nonce(address).await;
        assert_eq!(removed, None, "Nonce should be removed");
    }
}
