terraform {
  backend "gcs" {
    bucket = "quipay-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Database (PostgreSQL via Cloud SQL) ───────────────────────────────────────

module "database" {
  source = "./modules/database"

  project_id            = var.project_id
  region                = var.region
  environment           = var.environment
  tier                  = var.db_tier
  disk_size_gb          = var.db_disk_size_gb
  high_availability     = var.db_high_availability
  backup_enabled        = var.db_backup_enabled
  pitr_enabled          = var.db_pitr_enabled
  backup_retention_days = var.db_backup_retention_days
}

# ── Cache (Redis via Memorystore) ─────────────────────────────────────────────

module "cache" {
  source = "./modules/cache"

  project_id     = var.project_id
  region         = var.region
  environment    = var.environment
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
}

# ── Load Balancer ─────────────────────────────────────────────────────────────

module "load_balancer" {
  source = "./modules/load_balancer"

  project_id  = var.project_id
  environment = var.environment
  domain      = var.domain
  ssl_domains = length(var.ssl_certificate_domains) > 0 ? var.ssl_certificate_domains : [var.domain]
}

# ── DNS ───────────────────────────────────────────────────────────────────────

module "dns" {
  source = "./modules/dns"

  project_id       = var.project_id
  zone_name        = var.dns_zone_name
  domain           = var.domain
  load_balancer_ip = module.load_balancer.external_ip
}
