output "name_servers" {
  description = "Name servers for the managed zone"
  value       = google_dns_managed_zone.primary.name_servers
}

output "zone_name" {
  description = "DNS zone name"
  value       = google_dns_managed_zone.primary.name
}
