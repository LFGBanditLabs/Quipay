output "host" {
  description = "Redis instance host"
  value       = google_redis_instance.cache.host
}

output "port" {
  description = "Redis instance port"
  value       = google_redis_instance.cache.port
}

output "instance_name" {
  description = "Redis instance name"
  value       = google_redis_instance.cache.name
}
