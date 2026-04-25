output "database_connection_name" {
  description = "Cloud SQL instance connection name"
  value       = module.database.connection_name
}

output "database_ip" {
  description = "Database private IP address"
  value       = module.database.private_ip
  sensitive   = true
}

output "redis_host" {
  description = "Redis instance host"
  value       = module.cache.host
}

output "redis_port" {
  description = "Redis instance port"
  value       = module.cache.port
}

output "load_balancer_ip" {
  description = "External IP of the load balancer"
  value       = module.load_balancer.external_ip
}

output "dns_name_servers" {
  description = "Name servers for the DNS zone"
  value       = module.dns.name_servers
}
