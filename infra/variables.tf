variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Primary deployment region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (staging or production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

# ── Database ──────────────────────────────────────────────────────────────────

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_size_gb" {
  description = "Database disk size in GB"
  type        = number
  default     = 10
}

variable "db_high_availability" {
  description = "Enable HA (regional) for the database"
  type        = bool
  default     = false
}

variable "db_backup_enabled" {
  description = "Enable automated daily backups"
  type        = bool
  default     = true
}

variable "db_pitr_enabled" {
  description = "Enable point-in-time recovery (WAL archiving)"
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# ── Cache ─────────────────────────────────────────────────────────────────────

variable "redis_tier" {
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
}

variable "redis_memory_size_gb" {
  description = "Redis instance memory in GB"
  type        = number
  default     = 1
}

# ── Load Balancer ─────────────────────────────────────────────────────────────

variable "domain" {
  description = "Primary domain for the application"
  type        = string
}

variable "ssl_certificate_domains" {
  description = "Domains covered by the managed SSL certificate"
  type        = list(string)
  default     = []
}

# ── DNS ───────────────────────────────────────────────────────────────────────

variable "dns_zone_name" {
  description = "Cloud DNS managed zone name"
  type        = string
  default     = "quipay-zone"
}
