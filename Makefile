# Quipay Development Makefile

.PHONY: help dev build stop clean seed migrate

## Show this help message
help:
	@echo ""
	@echo "  Quipay — Makefile commands"
	@echo "  ──────────────────────────────────────"
	@grep -E '^## ' Makefile | sed 's/## /  /'
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' Makefile | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'
	@echo ""

dev: ## Start the full-stack development environment (with hot-reload)
	docker compose up --build

build: ## Build all Docker images
	docker compose build

stop: ## Stop all running containers
	docker compose down

clean: ## Remove containers, volumes, and orphan images
	docker compose down -v --remove-orphans

migrate: ## Run pending database migrations
	docker compose exec backend npm run migration:run

seed: ## Seed the database with development fixtures
	docker compose exec backend npm run seed
