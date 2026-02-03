use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect},
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use super::AppState;

#[derive(Debug, Deserialize)]
pub struct OAuthStartQuery {
    #[serde(rename = "monitorId")]
    pub monitor_id: String,
}

#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    pub state: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct StateData {
    #[serde(rename = "monitorId")]
    monitor_id: String,
}

#[derive(Debug, Deserialize)]
struct DiscordTokenResponse {
    webhook: DiscordWebhook,
}

#[derive(Debug, Deserialize)]
struct DiscordWebhook {
    url: String,
    #[serde(default)]
    #[allow(dead_code)]
    guild_id: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    channel_id: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    name: Option<String>,
}

pub async fn discord_oauth_start(
    Query(query): Query<OAuthStartQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let client_id = std::env::var("DISCORD_CLIENT_ID")
        .map_err(|_| {
            tracing::error!("DISCORD_CLIENT_ID not set");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let redirect_uri = std::env::var("DISCORD_REDIRECT_URI")
        .map_err(|_| {
            tracing::error!("DISCORD_REDIRECT_URI not set");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let state_data = StateData {
        monitor_id: query.monitor_id,
    };
    
    let state_json = serde_json::to_string(&state_data)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let state = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, state_json.as_bytes());

    let discord_url = format!(
        "https://discord.com/oauth2/authorize?client_id={}&scope=webhook.incoming&redirect_uri={}&response_type=code&state={}",
        client_id,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&state)
    );

    Ok(Redirect::temporary(&discord_url))
}

pub async fn discord_oauth_callback(
    State(state): State<AppState>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<impl IntoResponse, StatusCode> {
    let state_json = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, query.state.as_bytes())
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let state_str = String::from_utf8(state_json)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    
    let state_data: StateData = serde_json::from_str(&state_str)
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let client_id = std::env::var("DISCORD_CLIENT_ID")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let client_secret = std::env::var("DISCORD_CLIENT_SECRET")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let redirect_uri = std::env::var("DISCORD_REDIRECT_URI")
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let client = reqwest::Client::new();
    let token_response = client
        .post("https://discord.com/api/oauth2/token")
        .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&[
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("grant_type", "authorization_code"),
            ("code", &query.code),
            ("redirect_uri", &redirect_uri),
        ])
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to exchange Discord code: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let token_data: DiscordTokenResponse = token_response.json().await
        .map_err(|e| {
            tracing::error!("Failed to parse Discord token response: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    update_monitor_with_discord_webhook(
        &state.pool,
        &state_data.monitor_id,
        &token_data.webhook,
    ).await?;

    let redirect_html = r#"
    <!DOCTYPE html>
    <html>
    <head><title>Discord Connected</title></head>
    <body>
        <h1>Discord Connected Successfully!</h1>
        <p>You can close this window now.</p>
        <script>
            if (window.opener) {
                window.opener.postMessage('discord-webhook-success', '*');
                setTimeout(() => window.close(), 1000);
            }
        </script>
    </body>
    </html>
    "#;

    Ok((
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/html")],
        redirect_html,
    ))
}

async fn update_monitor_with_discord_webhook(
    pool: &SqlitePool,
    monitor_id: &str,
    webhook: &DiscordWebhook,
) -> Result<(), StatusCode> {
    let monitor: (String,) = sqlx::query_as(
        "SELECT settings FROM monitors WHERE id = ?"
    )
    .bind(monitor_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch monitor: {}", e);
        StatusCode::NOT_FOUND
    })?;

    let mut settings: serde_json::Value = serde_json::from_str(&monitor.0)
        .unwrap_or_else(|_| serde_json::json!({}));

    if !settings["notifications"].is_array() {
        settings["notifications"] = serde_json::json!([]);
    }

    let notifications = settings["notifications"].as_array_mut().unwrap();
    
    let discord_config = serde_json::json!({
        "method": "discord",
        "enabled": true,
        "webhookUrl": webhook.url,
        "serverName": webhook.guild_id.as_deref().unwrap_or("Unknown Server"),
        "channelName": webhook.name.as_deref().unwrap_or("Unknown Channel"),
    });

    if let Some(idx) = notifications.iter().position(|n| n["method"] == "discord") {
        notifications[idx] = discord_config;
    } else {
        notifications.push(discord_config);
    }

    settings["notify"] = serde_json::json!(true);

    let settings_json = serde_json::to_string(&settings)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query("UPDATE monitors SET settings = ?, updated_at = ? WHERE id = ?")
        .bind(&settings_json)
        .bind(&now)
        .bind(monitor_id)
        .execute(pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update monitor: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(())
}
