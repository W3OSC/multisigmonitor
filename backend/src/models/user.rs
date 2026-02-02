use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: String,
    pub email: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub google_id: Option<String>,
    pub github_id: Option<String>,
    pub ethereum_address: Option<String>,
    pub email_verified: Option<i32>,
    pub email_alerts_enabled: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserResponse {
    pub id: String,
    pub email: String,
    pub username: String,
    pub google_id: Option<String>,
    pub github_id: Option<String>,
    pub ethereum_address: Option<String>,
    pub email_verified: bool,
    pub email_alerts_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            email: user.email,
            username: user.username,
            google_id: user.google_id,
            email_verified: user.email_verified == Some(1),
            email_alerts_enabled: user.email_alerts_enabled == Some(1),
            github_id: user.github_id,
            ethereum_address: user.ethereum_address,
            created_at: user.created_at,
            updated_at: user.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub username: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct GoogleAuthRequest {
    pub redirect_uri: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct GoogleCallbackRequest {
    pub code: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct GitHubCallbackRequest {
    pub code: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct EthereumNonceRequest {
    pub address: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct EthereumNonceResponse {
    pub nonce: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct EthereumVerifyRequest {
    pub message: String,
    pub signature: String,
}
