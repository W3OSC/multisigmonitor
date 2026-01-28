.PHONY: test test-backend test-frontend test-external-apis start stop restart logs status

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
