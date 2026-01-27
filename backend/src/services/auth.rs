use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, decode, Header, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
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
            .checked_add_signed(chrono::Duration::days(7))
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

    pub fn verify_ethereum_signature(
        message: &str,
        signature: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        use siwe::Message;

        tracing::info!("Parsing SIWE message...");
        let siwe_message: Message = message.parse()
            .map_err(|e| {
                tracing::error!("Failed to parse SIWE message: {}", e);
                e
            })?;
        
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
