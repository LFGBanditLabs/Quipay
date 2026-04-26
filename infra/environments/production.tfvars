project_id   = "quipay-production"
region       = "us-central1"
environment  = "production"
domain       = "quipay.app"

# Database - production grade
db_tier              = "db-custom-2-7680"
db_disk_size_gb      = 50
db_high_availability = true
db_backup_enabled    = true
db_pitr_enabled      = true
db_backup_retention_days = 30

# Cache - HA for production
redis_tier           = "STANDARD_HA"
redis_memory_size_gb = 2

# DNS
dns_zone_name           = "quipay-zone"
ssl_certificate_domains = ["quipay.app", "www.quipay.app"]
