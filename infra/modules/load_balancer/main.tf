resource "google_compute_global_address" "default" {
  name    = "quipay-${var.environment}-lb-ip"
  project = var.project_id
}

resource "google_compute_managed_ssl_certificate" "default" {
  name    = "quipay-${var.environment}-cert"
  project = var.project_id

  managed {
    domains = var.ssl_domains
  }
}

resource "google_compute_backend_service" "default" {
  name        = "quipay-${var.environment}-backend"
  project     = var.project_id
  protocol    = "HTTP"
  port_name   = "http"
  timeout_sec = 30

  health_checks = [google_compute_health_check.default.id]

  log_config {
    enable = true
  }
}

resource "google_compute_health_check" "default" {
  name    = "quipay-${var.environment}-hc"
  project = var.project_id

  http_health_check {
    port         = 80
    request_path = "/health"
  }

  check_interval_sec  = 10
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3
}

resource "google_compute_url_map" "default" {
  name            = "quipay-${var.environment}-urlmap"
  project         = var.project_id
  default_service = google_compute_backend_service.default.id
}

resource "google_compute_target_https_proxy" "default" {
  name             = "quipay-${var.environment}-https-proxy"
  project          = var.project_id
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

resource "google_compute_global_forwarding_rule" "https" {
  name        = "quipay-${var.environment}-https-rule"
  project     = var.project_id
  ip_address  = google_compute_global_address.default.address
  ip_protocol = "TCP"
  port_range  = "443"
  target      = google_compute_target_https_proxy.default.id
}

# HTTP to HTTPS redirect
resource "google_compute_url_map" "http_redirect" {
  name    = "quipay-${var.environment}-http-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect = true
    strip_query    = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "quipay-${var.environment}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name        = "quipay-${var.environment}-http-rule"
  project     = var.project_id
  ip_address  = google_compute_global_address.default.address
  ip_protocol = "TCP"
  port_range  = "80"
  target      = google_compute_target_http_proxy.redirect.id
}
