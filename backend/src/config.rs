use std::env;
use std::net::IpAddr;
use std::str::FromStr;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub cors_origin: String,
    pub host: IpAddr,
    pub port: u16,
    pub rate_limit_per_second: u32,
    pub worker_concurrency: usize,
    pub google_client_id: String,
    pub google_client_secret: String,
    pub google_redirect_uri: String,
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_redirect_uri: String,
    pub chainalysis_api_key: Option<String>,
    pub infura_api_key: String,
    pub default_from_email: String,
    pub resend_api_key: Option<String>,
    pub cookie_domain: Option<String>,
    pub cookie_secure: bool,
}

#[derive(Debug)]
pub enum ConfigError {
    MissingVariable(String),
    InvalidValue { var: String, error: String },
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::MissingVariable(var) => {
                write!(f, "Required environment variable '{}' is not set", var)
            }
            ConfigError::InvalidValue { var, error } => {
                write!(f, "Invalid value for '{}': {}", var, error)
            }
        }
    }
}

impl std::error::Error for ConfigError {}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let env_file = if cfg!(debug_assertions) {
            "../secrets/.env.backend.local"
        } else {
            "../secrets/.env.backend.prod"
        };

        dotenvy::from_filename(env_file).map_err(|e| ConfigError::InvalidValue {
            var: "ENV_FILE".to_string(),
            error: format!("Failed to load {}: {}", env_file, e),
        })?;

        let database_url = Self::require_var("DATABASE_URL")?;
        let jwt_secret = Self::require_var("JWT_SECRET")?;
        let cors_origin = Self::require_var("CORS_ORIGIN")?;
        
        let host = Self::require_var("HOST")
            .and_then(|v| {
                IpAddr::from_str(&v).map_err(|e| ConfigError::InvalidValue {
                    var: "HOST".to_string(),
                    error: e.to_string(),
                })
            })?;

        let port = Self::require_var("PORT")
            .and_then(|v| {
                v.parse::<u16>().map_err(|e| ConfigError::InvalidValue {
                    var: "PORT".to_string(),
                    error: e.to_string(),
                })
            })?;

        let rate_limit_per_second = Self::require_var("RATE_LIMIT_PER_SECOND")
            .and_then(|v| {
                v.parse::<u32>().map_err(|e| ConfigError::InvalidValue {
                    var: "RATE_LIMIT_PER_SECOND".to_string(),
                    error: e.to_string(),
                })
            })?;

        let worker_concurrency = Self::require_var("WORKER_CONCURRENCY")
            .and_then(|v| {
                v.parse::<usize>().map_err(|e| ConfigError::InvalidValue {
                    var: "WORKER_CONCURRENCY".to_string(),
                    error: e.to_string(),
                })
            })?;

        let google_client_id = Self::require_var("GOOGLE_CLIENT_ID")?;
        let google_client_secret = Self::require_var("GOOGLE_CLIENT_SECRET")?;
        let google_redirect_uri = Self::require_var("GOOGLE_REDIRECT_URI")?;
        
        let github_client_id = Self::require_var("GITHUB_CLIENT_ID")?;
        let github_client_secret = Self::require_var("GITHUB_CLIENT_SECRET")?;
        let github_redirect_uri = Self::require_var("GITHUB_REDIRECT_URI")?;

        let infura_api_key = Self::require_var("INFURA_API_KEY")?;
        let default_from_email = Self::require_var("DEFAULT_FROM_EMAIL")?;

        let chainalysis_api_key = env::var("CHAINALYSIS_API_KEY").ok();
        let resend_api_key = env::var("RESEND_API_KEY").ok();
        let cookie_domain = env::var("COOKIE_DOMAIN").ok();
        
        let cookie_secure = env::var("COOKIE_SECURE")
            .unwrap_or_else(|_| "true".to_string())
            .parse::<bool>()
            .unwrap_or(true);

        Ok(Self {
            database_url,
            jwt_secret,
            cors_origin,
            host,
            port,
            rate_limit_per_second,
            worker_concurrency,
            google_client_id,
            google_client_secret,
            google_redirect_uri,
            github_client_id,
            github_client_secret,
            github_redirect_uri,
            chainalysis_api_key,
            infura_api_key,
            default_from_email,
            resend_api_key,
            cookie_domain,
            cookie_secure,
        })
    }

    fn require_var(name: &str) -> Result<String, ConfigError> {
        env::var(name).map_err(|_| ConfigError::MissingVariable(name.to_string()))
    }
}
