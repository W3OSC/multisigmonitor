# Multisig Monitor Backend

Rust backend using Axum and SQLite for the multisig monitor application.

## Structure

```
backend/
├── src/
│   ├── main.rs              # Server entry point
│   ├── lib.rs               # Module exports
│   ├── api/                 # API endpoints
│   │   ├── mod.rs           # API router
│   │   ├── auth.rs          # Authentication endpoints
│   │   ├── monitors.rs      # Monitor CRUD endpoints
│   │   └── notifications.rs # Notification endpoints
│   ├── middleware/          # Middleware components
│   │   ├── mod.rs
│   │   └── auth.rs          # Auth middleware
│   ├── models/              # Data models
│   │   ├── mod.rs
│   │   ├── user.rs          # User model
│   │   └── monitor.rs       # Monitor model
│   └── services/            # Business logic
│       ├── mod.rs
│       └── auth.rs          # Auth service with OAuth providers
├── migrations/              # SQLite migrations
│   └── 001_initial_schema.sql
├── .env.example            # Environment variables template
└── Cargo.toml              # Dependencies

```

## Setup

1. Create secrets directory and environment file:
```bash
mkdir -p ../secrets
cp .env.example ../secrets/.env.backend.local
```

2. Edit `../secrets/.env.backend.local` with your configuration

3. Build and run:
```bash
cargo build
cargo run
```

## Features

- **Authentication**: Google, GitHub, and Ethereum wallet support
- **JWT**: Token-based authentication with HTTP-only cookies
- **CORS**: Configurable cross-origin support
- **Rate Limiting**: Configurable request throttling
- **SQLite**: Local database with migrations
- **Nonce Store**: In-memory Ethereum signature nonce management

## Environment Variables

See `.env.example` for all required configuration.
