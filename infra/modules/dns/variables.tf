variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "zone_name" {
  description = "DNS managed zone name"
  type        = string
}

variable "domain" {
  description = "Primary domain"
  type        = string
}

variable "load_balancer_ip" {
  description = "IP address of the load balancer"
  type        = string
}
