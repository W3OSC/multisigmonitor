use chrono::{Duration, Utc};
use rand::Rng;
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::models::api_key::{ApiKey, ApiKeyResponse, CreateApiKeyResponse};

pub struct ApiKeyService;

impl ApiKeyService {
    pub fn generate_api_key() -> String {
        let mut rng = rand::thread_rng();
        let random_bytes: Vec<u8> = (0..32).map(|_| rng.gen()).collect();
        format!("msk_{}", bs58::encode(random_bytes).into_string())
    }

    pub fn hash_key(key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    pub fn get_key_prefix(key: &str) -> String {
        if key.len() < 15 {
            return key.to_string();
        }
        format!("{}...{}", &key[..11], &key[key.len()-4..])
    }

    pub async fn create_api_key(
        pool: &SqlitePool,
        user_id: &str,
        name: &str,
    ) -> Result<CreateApiKeyResponse, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        let key = Self::generate_api_key();
        let key_hash = Self::hash_key(&key);
        let key_prefix = Self::get_key_prefix(&key);
        let created_at = Utc::now().to_rfc3339();
        let expires_at = (Utc::now() + Duration::days(180)).to_rfc3339();

        sqlx::query(
            "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, created_at, expires_at, is_revoked)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0)"
        )
        .bind(&id)
        .bind(user_id)
        .bind(name)
        .bind(&key_hash)
        .bind(&key_prefix)
        .bind(&created_at)
        .bind(&expires_at)
        .execute(pool)
        .await?;

        Ok(CreateApiKeyResponse {
            id,
            name: name.to_string(),
            key,
            key_prefix,
            created_at,
            expires_at,
        })
    }

    pub async fn get_user_api_keys(
        pool: &SqlitePool,
        user_id: &str,
    ) -> Result<Vec<ApiKeyResponse>, sqlx::Error> {
        let keys = sqlx::query_as::<_, ApiKey>(
            "SELECT id, user_id, name, key_hash, key_prefix, created_at, expires_at, last_used_at, is_revoked FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
        )
        .bind(user_id)
        .fetch_all(pool)
        .await?;

        Ok(keys.into_iter().map(|k| k.into()).collect())
    }

    pub async fn revoke_api_key(
        pool: &SqlitePool,
        user_id: &str,
        key_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE api_keys SET is_revoked = 1 WHERE id = ? AND user_id = ?"
        )
        .bind(key_id)
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn verify_api_key(
        pool: &SqlitePool,
        key: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let key_hash = Self::hash_key(key);
        
        let result = sqlx::query_as::<_, ApiKey>(
            "SELECT id, user_id, name, key_hash, key_prefix, created_at, expires_at, last_used_at, is_revoked FROM api_keys WHERE key_hash = ? AND is_revoked = 0"
        )
        .bind(&key_hash)
        .fetch_optional(pool)
        .await?;

        if let Some(api_key) = result {
            let expires_at = chrono::DateTime::parse_from_rfc3339(&api_key.expires_at)
                .map_err(|e| sqlx::Error::Decode(Box::new(e)))?;
            
            if expires_at.with_timezone(&Utc) < Utc::now() {
                return Ok(None);
            }

            sqlx::query(
                "UPDATE api_keys SET last_used_at = ? WHERE id = ?"
            )
            .bind(Utc::now().to_rfc3339())
            .bind(&api_key.id)
            .execute(pool)
            .await?;

            Ok(Some(api_key.user_id))
        } else {
            Ok(None)
        }
    }
}
