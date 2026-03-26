# Quipay Development Makefile

.PHONY: dev build stop clean seed migrate

# Start the full stack development environment
dev:
	docker compose up --build

# Build the system
build:
	docker compose build

# Stop the system
stop:
	docker compose down

# Clean volumes and orphans
clean:
	docker compose down -v --remove-orphans

# Manually trigger migrations
migrate:
	docker compose exec backend npm run migration:run

# Manually trigger seeding
seed:
	docker compose exec backend npm run seed
