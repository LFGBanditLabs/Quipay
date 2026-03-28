resource "google_redis_instance" "cache" {
  name           = "quipay-${var.environment}-redis"
  tier           = var.tier
  memory_size_gb = var.memory_size_gb
  region         = var.region
  project        = var.project_id

  redis_version = "REDIS_7_2"

  authorized_network = "projects/${var.project_id}/global/networks/default"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }
}
