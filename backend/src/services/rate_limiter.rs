use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct UserRateLimiter {
    store: Arc<Mutex<HashMap<String, VecDeque<Instant>>>>,
    max_requests: usize,
    window: Duration,
}

impl UserRateLimiter {
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            store: Arc::new(Mutex::new(HashMap::new())),
            max_requests,
            window: Duration::from_secs(window_secs),
        }
    }

    pub async fn check_and_increment(&self, user_id: &str) -> bool {
        let mut store = self.store.lock().await;
        let now = Instant::now();
        let window = self.window;

        let requests = store.entry(user_id.to_string()).or_insert_with(VecDeque::new);

        requests.retain(|t| now.duration_since(*t) < window);

        if requests.len() >= self.max_requests {
            return false;
        }

        requests.push_back(now);
        true
    }

    pub async fn cleanup(&self) {
        let mut store = self.store.lock().await;
        let now = Instant::now();
        let window = self.window;
        store.retain(|_, requests| {
            requests.retain(|t| now.duration_since(*t) < window);
            !requests.is_empty()
        });
    }
}
