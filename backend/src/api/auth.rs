use axum::{
    extract::State,
    http::{StatusCode, header::{SET_COOKIE, HeaderMap}},
    response::IntoResponse,
    Json,
    Extension,
};
use uuid::Uuid;
use cookie::{Cookie, SameSite};
use time::Duration;

use crate::{
    models::user::{User, AuthResponse, UserResponse, GoogleAuthRequest, GoogleCallbackRequest, GitHubCallbackRequest, EthereumNonceRequest, EthereumNonceResponse, EthereumVerifyRequest},
    services::AuthService,
    api::AppState,
};

fn build_access_cookie<'a>(token: &'a str, state: &AppState) -> Cookie<'a> {
    let mut cookie = Cookie::build(("token", token))
        .path("/")
        .max_age(Duration::days(1))
        .same_site(SameSite::Lax)
        .http_only(true);
    if state.config.cookie_secure {
        cookie = cookie.secure(true);
    }
    if let Some(domain) = &state.config.cookie_domain {
        cookie = cookie.domain(domain.clone());
    }
    cookie.build()
}

fn build_refresh_cookie<'a>(token: &'a str, state: &AppState) -> Cookie<'a> {
    let mut cookie = Cookie::build(("refresh_token", token))
        .path("/api/auth")
        .max_age(Duration::days(30))
        .same_site(SameSite::Strict)
        .http_only(true);
    if state.config.cookie_secure {
        cookie = cookie.secure(true);
    }
    if let Some(domain) = &state.config.cookie_domain {
        cookie = cookie.domain(domain.clone());
    }
    cookie.build()
}

fn build_clearing_cookie(name: &str, path: &str, state: &AppState) -> Cookie<'static> {
    let mut cookie = Cookie::build((name.to_string(), String::new()))
        .path(path.to_string())
        .max_age(Duration::ZERO)
        .same_site(SameSite::Lax)
        .http_only(true);
    if state.config.cookie_secure {
        cookie = cookie.secure(true);
    }
    if let Some(domain) = &state.config.cookie_domain {
        cookie = cookie.domain(domain.clone());
    }
    cookie.build()
}

fn extract_refresh_token_from_cookie(headers: &HeaderMap) -> Option<String> {
    use cookie::Cookie;
    headers
        .get("cookie")
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .filter_map(|s| Cookie::parse(s.trim()).ok())
                .find(|c| c.name() == "refresh_token")
                .map(|c| c.value().to_string())
        })
}

pub async fn google_auth(
    State(state): State<AppState>,
    Json(_payload): Json<GoogleAuthRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=email%20profile",
        state.config.google_client_id, state.config.google_redirect_uri
    );

    Ok(Json(serde_json::json!({ "url": auth_url })))
}

pub async fn google_callback(
    State(state): State<AppState>,
    Json(payload): Json<GoogleCallbackRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let redirect_uri = payload.redirect_uri.as_deref().unwrap_or(&state.config.google_redirect_uri);
    let access_token = AuthService::exchange_google_code(
        &payload.code,
        redirect_uri,
        &state.config.google_client_id,
        &state.config.google_client_secret,
    )
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
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = if let Some(mut user) = existing_user {
        if user.google_id.is_none() {
            sqlx::query("UPDATE users SET google_id = ? WHERE id = ?")
                .bind(&user_info.sub)
                .bind(&user.id)
                .execute(&state.pool)
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
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let token = AuthService::generate_token(&user.id, &user.email, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_token = AuthService::issue_refresh_token(&state.pool, &user.id, &Uuid::new_v4().to_string())
        .await
        .map_err(|e| {
            tracing::error!("Failed to issue refresh token: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, build_access_cookie(&token, &state).to_string().parse().unwrap());
    headers.append(SET_COOKIE, build_refresh_cookie(&refresh_token, &state).to_string().parse().unwrap());

    Ok((headers, Json(AuthResponse {
        token: token.clone(),
        user: user.into(),
    })))
}

pub async fn github_callback(
    State(state): State<AppState>,
    Json(payload): Json<GitHubCallbackRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let redirect_uri = payload.redirect_uri.as_deref().unwrap_or(&state.config.github_redirect_uri);
    let access_token = AuthService::exchange_github_code(
        &payload.code,
        redirect_uri,
        &state.config.github_client_id,
        &state.config.github_client_secret,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to exchange GitHub code: {}", e);
        StatusCode::UNAUTHORIZED
    })?;

    let (user_info, primary_email) = AuthService::get_github_user_info(&access_token)
        .await
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let github_id_str = user_info.id.to_string();

    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = ? OR (github_id IS NOT NULL AND github_id = ?)"
    )
    .bind(&primary_email)
    .bind(&github_id_str)
    .fetch_optional(&state.pool)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user = if let Some(mut user) = existing_user {
        if user.github_id.is_none() {
            sqlx::query("UPDATE users SET github_id = ? WHERE id = ?")
                .bind(&github_id_str)
                .bind(&user.id)
                .execute(&state.pool)
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
        .execute(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let token = AuthService::generate_token(&user.id, &user.email, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_token = AuthService::issue_refresh_token(&state.pool, &user.id, &Uuid::new_v4().to_string())
        .await
        .map_err(|e| {
            tracing::error!("Failed to issue refresh token: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, build_access_cookie(&token, &state).to_string().parse().unwrap());
    headers.append(SET_COOKIE, build_refresh_cookie(&refresh_token, &state).to_string().parse().unwrap());

    Ok((headers, Json(AuthResponse {
        token: token.clone(),
        user: user.into(),
    })))
}

pub async fn ethereum_nonce(
    State(state): State<AppState>,
    Json(payload): Json<EthereumNonceRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let address = payload.address.trim_start_matches("0x").to_lowercase();
    let nonce = AuthService::generate_nonce();
    
    tracing::info!("Storing nonce for address: {}", address);
    state.nonce_store.store_nonce(&address, nonce.clone()).await;

    Ok(Json(EthereumNonceResponse { nonce }))
}

pub async fn ethereum_verify(
    State(state): State<AppState>,
    Json(payload): Json<EthereumVerifyRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    tracing::info!("Ethereum verify request received");

    let claimed_address = {
        use siwe::Message;
        let siwe_message: Message = payload.message.parse().map_err(|e| {
            tracing::error!("Failed to parse SIWE message: {}", e);
            StatusCode::BAD_REQUEST
        })?;
        hex::encode(siwe_message.address).to_lowercase()
    };

    let stored_nonce = state.nonce_store.get_nonce(&claimed_address).await
        .ok_or_else(|| {
            tracing::error!("Nonce not found for address: {}", claimed_address);
            StatusCode::UNAUTHORIZED
        })?;

    let address = AuthService::verify_ethereum_signature(&payload.message, &payload.signature, &stored_nonce)
        .map_err(|e| {
            tracing::error!("Failed to verify Ethereum signature: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    let address_lower = address.to_lowercase();
    state.nonce_store.remove_nonce(&address_lower).await;
    tracing::info!("Recovered and verified address: {}", address_lower);

    let existing_user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE ethereum_address = ?"
    )
    .bind(&address_lower)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to query user by ethereum_address: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let user = if let Some(user) = existing_user {
        user
    } else {
        let user_id = Uuid::new_v4().to_string();
        let username = format!("{}...{}", &address_lower[0..6], &address_lower[address_lower.len()-4..]);
        let email = format!("eth-{}@wallet.invalid", address_lower);

        sqlx::query(
            "INSERT INTO users (id, email, ethereum_address, username) VALUES (?, ?, ?, ?)"
        )
        .bind(&user_id)
        .bind(&email)
        .bind(&address_lower)
        .bind(&username)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert new ethereum user: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
            .bind(&user_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch newly created user: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
    };

    let token = AuthService::generate_token(&user.id, &user.email, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let refresh_token = AuthService::issue_refresh_token(&state.pool, &user.id, &Uuid::new_v4().to_string())
        .await
        .map_err(|e| {
            tracing::error!("Failed to issue refresh token: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, build_access_cookie(&token, &state).to_string().parse().unwrap());
    headers.append(SET_COOKIE, build_refresh_cookie(&refresh_token, &state).to_string().parse().unwrap());

    Ok((headers, Json(AuthResponse {
        token: token.clone(),
        user: user.into(),
    })))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    if let Some(raw_token) = extract_refresh_token_from_cookie(&headers) {
        if let Err(e) = AuthService::revoke_refresh_token(&state.pool, &raw_token).await {
            tracing::warn!("Failed to revoke refresh token on logout: {}", e);
        }
    }

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(SET_COOKIE, build_clearing_cookie("token", "/", &state).to_string().parse().unwrap());
    resp_headers.append(SET_COOKIE, build_clearing_cookie("refresh_token", "/api/auth", &state).to_string().parse().unwrap());

    Ok((resp_headers, Json(serde_json::json!({ "success": true }))))
}

pub async fn refresh_token(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, StatusCode> {
    let raw_token = extract_refresh_token_from_cookie(&headers)
        .ok_or_else(|| {
            tracing::debug!("No refresh_token cookie present");
            StatusCode::UNAUTHORIZED
        })?;

    let (user_id, new_refresh_raw) = AuthService::rotate_refresh_token(&state.pool, &raw_token)
        .await
        .map_err(|e| {
            tracing::warn!("Refresh token rotation failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let access_token = AuthService::generate_token(&user.id, &user.email, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(SET_COOKIE, build_access_cookie(&access_token, &state).to_string().parse().unwrap());
    resp_headers.append(SET_COOKIE, build_refresh_cookie(&new_refresh_raw, &state).to_string().parse().unwrap());

    Ok((resp_headers, Json(UserResponse::from(user))))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    Ok(Json(UserResponse::from(user)))
}
