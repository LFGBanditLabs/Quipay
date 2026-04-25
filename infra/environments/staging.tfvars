project_id   = "quipay-staging"
region       = "us-central1"
environment  = "staging"
domain       = "staging.quipay.app"

# Database - smaller for staging
db_tier              = "db-f1-micro"
db_disk_size_gb      = 10
db_high_availability = false
db_backup_enabled    = true
db_pitr_enabled      = true
db_backup_retention_days = 7

# Cache - minimal for staging
redis_tier           = "BASIC"
redis_memory_size_gb = 1

# DNS
dns_zone_name = "quipay-staging-zone"
