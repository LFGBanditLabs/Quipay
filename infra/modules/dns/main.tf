resource "google_dns_managed_zone" "primary" {
  name     = var.zone_name
  dns_name = "${var.domain}."
  project  = var.project_id

  dnssec_config {
    state = "on"
  }
}

resource "google_dns_record_set" "a" {
  name         = "${var.domain}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.primary.name
  project      = var.project_id

  rrdatas = [var.load_balancer_ip]
}

resource "google_dns_record_set" "www" {
  name         = "www.${var.domain}."
  type         = "CNAME"
  ttl          = 300
  managed_zone = google_dns_managed_zone.primary.name
  project      = var.project_id

  rrdatas = ["${var.domain}."]
}
