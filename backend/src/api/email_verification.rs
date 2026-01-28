use axum::{
    extract::{State, Extension, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::AppState;

#[derive(Debug, Deserialize)]
pub struct SendVerificationRequest {
    pub email: String,
}

#[derive(Debug, Serialize)]
pub struct SendVerificationResponse {
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct VerifyEmailResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEmailAlertsRequest {
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct EmailAlertsStatusResponse {
    pub email_verified: bool,
    pub email_alerts_enabled: bool,
    pub email: String,
}

pub async fn send_verification_email(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<SendVerificationResponse>, StatusCode> {
    let user = sqlx::query_as::<_, (String, String, Option<i32>)>(
        "SELECT id, email, email_verified FROM users WHERE id = ?"
    )
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    if user.2 == Some(1) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let token = Uuid::new_v4().to_string();
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(24);

    sqlx::query("DELETE FROM email_verification_tokens WHERE user_id = ?")
        .bind(&user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete old tokens: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    sqlx::query("INSERT INTO email_verification_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)")
        .bind(Uuid::new_v4().to_string())
        .bind(&user_id)
        .bind(&token)
        .bind(expires_at.to_rfc3339())
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to insert verification token: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let api_key = state.config.mailjet_api_key.as_ref()
        .ok_or_else(|| {
            tracing::error!("Mailjet API key not configured");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let secret_key = state.config.mailjet_secret_key.as_ref()
        .ok_or_else(|| {
            tracing::error!("Mailjet secret key not configured");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let verification_url = format!(
        "{}/verify-email?token={}",
        state.config.cors_origin,
        token
    );

    let html_body = format!(
        r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }}
        .container {{ max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .header {{ background: linear-gradient(135deg, #8052ff 0%, #6941d9 100%); color: #ffffff; padding: 30px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 600; }}
        .content {{ padding: 30px; }}
        .button {{ display: inline-block; padding: 14px 28px; background-color: #8052ff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }}
        .button:hover {{ background-color: #6941d9; }}
        .footer {{ background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 Verify Your Email</h1>
        </div>
        <div class="content">
            <h2>Welcome to Multisig Monitor!</h2>
            <p>To enable email alerts for your monitored Safe wallets, please verify your email address by clicking the button below:</p>
            <div style="text-align: center;">
                <a href="{}" class="button">Verify Email Address</a>
            </div>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
                Or copy and paste this link into your browser:<br>
                <code style="background-color: #f4f4f4; padding: 8px; border-radius: 4px; display: inline-block; margin-top: 8px; word-break: break-all;">{}</code>
            </p>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
                This link will expire in 24 hours.
            </p>
        </div>
        <div class="footer">
            <p>This is an automated email from Multisig Monitor</p>
        </div>
    </div>
</body>
</html>
"#,
        verification_url, verification_url
    );

    let text_body = format!(
        "Welcome to Multisig Monitor!\n\nTo enable email alerts for your monitored Safe wallets, please verify your email address by visiting:\n\n{}\n\nThis link will expire in 24 hours.",
        verification_url
    );

    let payload = serde_json::json!({
        "Messages": [{
            "From": {
                "Email": state.config.default_from_email,
                "Name": "Multisig Monitor"
            },
            "To": [{
                "Email": user.1
            }],
            "Subject": "Verify Your Email - Multisig Monitor",
            "TextPart": text_body,
            "HTMLPart": html_body
        }]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.mailjet.com/v3.1/send")
        .basic_auth(api_key, Some(secret_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to send email: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        tracing::error!("Mailjet API error: {}", error_text);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }

    tracing::info!("Verification email sent to {}", user.1);

    Ok(Json(SendVerificationResponse {
        message: "Verification email sent".to_string(),
    }))
}

pub async fn verify_email(
    State(state): State<AppState>,
    Query(params): Query<VerifyEmailRequest>,
) -> Result<Json<VerifyEmailResponse>, StatusCode> {
    let token_record = sqlx::query_as::<_, (String, String)>(
        "SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?"
    )
    .bind(&params.token)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch token: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let expires_at = chrono::DateTime::parse_from_rfc3339(&token_record.1)
        .map_err(|e| {
            tracing::error!("Failed to parse expiration date: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if expires_at < chrono::Utc::now() {
        sqlx::query("DELETE FROM email_verification_tokens WHERE token = ?")
            .bind(&params.token)
            .execute(&state.pool)
            .await
            .ok();

        return Ok(Json(VerifyEmailResponse {
            success: false,
            message: "Verification link has expired".to_string(),
        }));
    }

    sqlx::query("UPDATE users SET email_verified = 1 WHERE id = ?")
        .bind(&token_record.0)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update user: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    sqlx::query("DELETE FROM email_verification_tokens WHERE token = ?")
        .bind(&params.token)
        .execute(&state.pool)
        .await
        .ok();

    tracing::info!("Email verified for user {}", token_record.0);

    Ok(Json(VerifyEmailResponse {
        success: true,
        message: "Email verified successfully".to_string(),
    }))
}

pub async fn get_email_alerts_status(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<EmailAlertsStatusResponse>, StatusCode> {
    let user = sqlx::query_as::<_, (String, Option<i32>, Option<i32>)>(
        "SELECT email, email_verified, email_alerts_enabled FROM users WHERE id = ?"
    )
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(EmailAlertsStatusResponse {
        email_verified: user.1 == Some(1),
        email_alerts_enabled: user.2 == Some(1),
        email: user.0,
    }))
}

pub async fn update_email_alerts(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<UpdateEmailAlertsRequest>,
) -> Result<Json<EmailAlertsStatusResponse>, StatusCode> {
    let user = sqlx::query_as::<_, (String, Option<i32>)>(
        "SELECT email, email_verified FROM users WHERE id = ?"
    )
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch user: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    if payload.enabled && user.1 != Some(1) {
        return Err(StatusCode::BAD_REQUEST);
    }

    sqlx::query("UPDATE users SET email_alerts_enabled = ? WHERE id = ?")
        .bind(payload.enabled as i32)
        .bind(&user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to update user: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(EmailAlertsStatusResponse {
        email_verified: user.1 == Some(1),
        email_alerts_enabled: payload.enabled,
        email: user.0,
    }))
}
