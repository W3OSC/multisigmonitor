use axum::{
    extract::State,
    http::{StatusCode, header::{SET_COOKIE, HeaderMap}},
    response::IntoResponse,
    Json,
    Extension,
};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    models::user::{User, AuthResponse, UserResponse, GoogleAuthRequest, GoogleCallbackRequest, GitHubCallbackRequest, EthereumNonceRequest, EthereumNonceResponse, EthereumVerifyRequest},
    services::{AuthService, NonceStore},
};

type AppState = (SqlitePool, NonceStore);

pub async fn google_auth(
    State((_, _)): State<AppState>,
    Json(payload): Json<GoogleAuthRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client_id = std::env::var("GOOGLE_CLIENT_ID")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let redirect_uri = std::env::var("GOOGLE_REDIRECT_URI")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=email%20profile",
        client_id, redirect_uri
    );

    Ok(Json(serde_json::json!({ "url": auth_url })))
}

pub async fn google_callback(
    State((pool, _)): State<AppState>,
    Json(payload): Json<GoogleCallbackRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let redirect_uri = std::env::var("GOOGLE_REDIRECT_URI")
        .map_err(|e| {
            tracing::error!("Failed to get GOOGLE_REDIRECT_URI: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let access_token = AuthService::exchange_google_code(&payload.code, &redirect_uri)
        .await
        .map_err(|e| {
            tracing::error!("Failed to exchange Google code: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    let user_info = AuthService::verify_google_token(&access_token)
        .await
        .map_err(|e| {
            tracing::error!("Failed to verify Google token: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = ? OR (google_id IS NOT NULL AND google_id = ?)"
    )
    .bind(&user_info.email)
    .bind(&user_info.sub)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = if let Some(mut user) = existing_user {
        if user.google_id.is_none() {
            sqlx::query("UPDATE users SET google_id = ? WHERE id = ?")
                .bind(&user_info.sub)
                .bind(&user.id)
                .execute(&pool)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            user.google_id = Some(user_info.sub);
        }
        user
    } else {
        let user_id = Uuid::new_v4().to_string();
        let username = user_info.email.split('@').next().unwrap_or("user").to_string();

        sqlx::query(
            "INSERT INTO users (id, email, google_id, username) VALUES (?, ?, ?, ?)"
        )
        .bind(&user_id)
        .bind(&user_info.email)
        .bind(&user_info.sub)
        .bind(&username)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let token = AuthService::generate_token(&user.id, &user.email)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = format!("token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800", token);
    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, cookie.parse().unwrap());

    Ok((headers, Json(AuthResponse {
        token: token.clone(),
        user: user.into(),
    })))
}

pub async fn github_callback(
    State((pool, _)): State<AppState>,
    Json(payload): Json<GitHubCallbackRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let redirect_uri = std::env::var("GITHUB_REDIRECT_URI")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let access_token = AuthService::exchange_github_code(&payload.code, &redirect_uri)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let (user_info, primary_email) = AuthService::get_github_user_info(&access_token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let github_id_str = user_info.id.to_string();

    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = ? OR (github_id IS NOT NULL AND github_id = ?)"
    )
    .bind(&primary_email)
    .bind(&github_id_str)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = if let Some(mut user) = existing_user {
        if user.github_id.is_none() {
            sqlx::query("UPDATE users SET github_id = ? WHERE id = ?")
                .bind(&github_id_str)
                .bind(&user.id)
                .execute(&pool)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            user.github_id = Some(github_id_str);
        }
        user
    } else {
        let user_id = Uuid::new_v4().to_string();
        let username = user_info.login;

        sqlx::query(
            "INSERT INTO users (id, email, github_id, username) VALUES (?, ?, ?, ?)"
        )
        .bind(&user_id)
        .bind(&primary_email)
        .bind(&github_id_str)
        .bind(&username)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let token = AuthService::generate_token(&user.id, &user.email)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = format!("token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800", token);
    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, cookie.parse().unwrap());

    Ok((headers, Json(AuthResponse {
        token: token.clone(),
        user: user.into(),
    })))
}

pub async fn ethereum_nonce(
    State((_, nonce_store)): State<AppState>,
    Json(payload): Json<EthereumNonceRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let address = payload.address.trim_start_matches("0x").to_lowercase();
    let nonce = AuthService::generate_nonce();
    
    tracing::info!("Storing nonce for address: {}", address);
    nonce_store.store_nonce(&address, nonce.clone()).await;

    Ok(Json(EthereumNonceResponse { nonce }))
}

pub async fn ethereum_verify(
    State((pool, nonce_store)): State<AppState>,
    Json(payload): Json<EthereumVerifyRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    tracing::info!("Ethereum verify request received");
    tracing::debug!("Message: {}", payload.message);
    tracing::debug!("Signature: {}", payload.signature);
    
    let address = AuthService::verify_ethereum_signature(&payload.message, &payload.signature)
        .map_err(|e| {
            tracing::error!("Failed to verify Ethereum signature: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    let address_lower = address.to_lowercase();
    tracing::info!("Recovered address: {}", address_lower);
    
    let stored_nonce = nonce_store.get_nonce(&address_lower).await
        .ok_or_else(|| {
            tracing::error!("Nonce not found for address: {}", address_lower);
            StatusCode::UNAUTHORIZED
        })?;
    
    tracing::info!("Nonce found: {}", stored_nonce);

    nonce_store.remove_nonce(&address_lower).await;

    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE ethereum_address = ?"
    )
    .bind(&address_lower)
    .fetch_optional(&pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = if let Some(user) = existing_user {
        user
    } else {
        let user_id = Uuid::new_v4().to_string();
        let username = format!("{}...{}", &address_lower[0..6], &address_lower[address_lower.len()-4..]);
        let email = format!("{}@ethereum.local", address_lower);

        sqlx::query(
            "INSERT INTO users (id, email, ethereum_address, username) VALUES (?, ?, ?, ?)"
        )
        .bind(&user_id)
        .bind(&email)
        .bind(&address_lower)
        .bind(&username)
        .execute(&pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(&pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let token = AuthService::generate_token(&user.id, &user.email)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cookie = format!("token={}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800", token);
    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, cookie.parse().unwrap());

    Ok((headers, Json(AuthResponse {
        token: token.clone(),
        user: user.into(),
    })))
}

pub async fn logout() -> Result<impl IntoResponse, StatusCode> {
    let cookie = "token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, cookie.parse().unwrap());

    Ok((headers, Json(serde_json::json!({ "success": true }))))
}

pub async fn me(
    Extension(user_id): Extension<String>,
    Extension(pool): Extension<SqlitePool>,
) -> Result<impl IntoResponse, StatusCode> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(UserResponse::from(user)))
}
