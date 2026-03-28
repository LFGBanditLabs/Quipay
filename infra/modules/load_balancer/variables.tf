variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain" {
  description = "Primary domain"
  type        = string
}

variable "ssl_domains" {
  description = "Domains for the SSL certificate"
  type        = list(string)
}
