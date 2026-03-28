variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "tier" {
  description = "Cloud SQL machine tier"
  type        = string
}

variable "disk_size_gb" {
  description = "Disk size in GB"
  type        = number
}

variable "high_availability" {
  description = "Enable regional HA"
  type        = bool
}

variable "backup_enabled" {
  description = "Enable automated backups"
  type        = bool
}

variable "pitr_enabled" {
  description = "Enable point-in-time recovery"
  type        = bool
}

variable "backup_retention_days" {
  description = "Backup retention count"
  type        = number
}
