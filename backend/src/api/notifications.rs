use axum::{http::StatusCode, response::IntoResponse, Json};

pub async fn list_notifications() -> Result<Json<()>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

pub async fn mark_as_read() -> Result<Json<()>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}
