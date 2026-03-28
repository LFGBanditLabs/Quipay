output "connection_name" {
  description = "Cloud SQL instance connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.postgres.connection_name
}

output "private_ip" {
  description = "Private IP address of the database"
  value       = google_sql_database_instance.postgres.private_ip_address
  sensitive   = true
}

output "instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.postgres.name
}
