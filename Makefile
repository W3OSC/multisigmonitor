.PHONY: setup test test-backend test-frontend test-external-apis start stop restart logs status

setup:
	@echo "Setting up multisigmonitor for local development..."
	@command -v cargo >/dev/null 2>&1 || { echo "Error: Rust is not installed. Please install from https://rustup.rs"; exit 1; }
	@command -v node >/dev/null 2>&1 || { echo "Error: Node.js is not installed. Please install Node.js"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "Error: npm is not installed. Please install npm"; exit 1; }
	@command -v pm2 >/dev/null 2>&1 || { echo "Installing PM2..."; npm install -g pm2; }
	@echo "Creating secrets directory structure..."
	@mkdir -p secrets
	@if [ ! -f secrets/.env.backend.local ]; then \
		echo "Creating secrets/.env.backend.local template..."; \
		echo "DATABASE_URL=sqlite:data/multisig_monitor.db" > secrets/.env.backend.local; \
		echo "JWT_SECRET=your-jwt-secret-here-please-change-this" >> secrets/.env.backend.local; \
		echo "CORS_ORIGIN=http://localhost:5173" >> secrets/.env.backend.local; \
		echo "HOST=127.0.0.1" >> secrets/.env.backend.local; \
		echo "PORT=7110" >> secrets/.env.backend.local; \
		echo "RATE_LIMIT_PER_SECOND=10" >> secrets/.env.backend.local; \
		echo "WORKER_CONCURRENCY=4" >> secrets/.env.backend.local; \
		echo "GOOGLE_CLIENT_ID=your-google-client-id" >> secrets/.env.backend.local; \
		echo "GOOGLE_CLIENT_SECRET=your-google-client-secret" >> secrets/.env.backend.local; \
		echo "GOOGLE_REDIRECT_URI=http://localhost:7110/api/auth/google/callback" >> secrets/.env.backend.local; \
		echo "GITHUB_CLIENT_ID=your-github-client-id" >> secrets/.env.backend.local; \
		echo "GITHUB_CLIENT_SECRET=your-github-client-secret" >> secrets/.env.backend.local; \
		echo "GITHUB_REDIRECT_URI=http://localhost:7110/api/auth/github/callback" >> secrets/.env.backend.local; \
		echo "INFURA_API_KEY=your-infura-api-key" >> secrets/.env.backend.local; \
		echo "TELEGRAM_BOT_TOKEN=your-telegram-bot-token-optional" >> secrets/.env.backend.local; \
		echo "CHAINALYSIS_API_KEY=your-chainalysis-api-key-optional" >> secrets/.env.backend.local; \
		echo "COOKIE_DOMAIN=localhost" >> secrets/.env.backend.local; \
		echo "COOKIE_SECURE=false" >> secrets/.env.backend.local; \
		echo "WARNING: Please update secrets/.env.backend.local with your actual values"; \
	else \
		echo "secrets/.env.backend.local already exists, skipping..."; \
	fi
	@if [ ! -f secrets/.env.frontend.local ]; then \
		echo "Creating secrets/.env.frontend.local template..."; \
		echo "VITE_API_URL=http://localhost:7110" > secrets/.env.frontend.local; \
		echo "secrets/.env.frontend.local created"; \
	else \
		echo "secrets/.env.frontend.local already exists, skipping..."; \
	fi
	@echo "Creating backend data directory..."
	@mkdir -p backend/data
	@echo "Installing backend dependencies and running migrations..."
	@cd backend && cargo build
	@cd backend && cargo sqlx database create || true
	@cd backend && cargo sqlx migrate run
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo ""
	@echo "✓ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Update secrets/.env.backend.local with your configuration"
	@echo "  2. Run 'make start' to start all services"
	@echo "  3. Access the application at http://localhost:5173"
	@echo ""

test: test-backend test-frontend test-external-apis

test-backend:
	@echo "Running backend tests..."
	@cd backend && cargo test --lib

test-frontend:
	@echo "Running frontend tests..."
	@cd frontend && npm test -- --run

test-external-apis:
	@echo "Testing external API integrations..."
	@cd backend && cargo test --test external_api_tests -- --nocapture

start:
	@echo "Starting multisigmonitor on http://localhost:7110"
	@pm2 start ecosystem.local.config.js

stop:
	@echo "Stopping all services..."
	@pm2 stop ecosystem.local.config.js

restart:
	@echo "Restarting all services..."
	@pm2 restart ecosystem.local.config.js

logs:
	@pm2 logs

status:
	@pm2 status
