# =============================================================================
# CloudFront — CDN in front of the Argus ALB (single custom origin, adapted
# from environments/nr-platform-prod). Next.js on ECS is the only origin:
#   /_next/static/*        -> immutable, 1-year cache (content-hashed files)
#   /favicon.ico /images/* -> 1-day cache
#   everything else        -> no cache, all methods, full viewer passthrough
# The X-Origin-Verify header lets the ALB reject traffic that bypasses
# CloudFront once the (currently commented) listener rule is enabled.
# =============================================================================

# Secret CloudFront stamps on every origin request; the ALB listener-rule
# hardening (alb.tf, commented until DNS cutover) matches on it.
resource "random_password" "origin_verify" {
  length  = 32
  special = false
}

# -----------------------------------------------------------------------------
# Cache policies
# -----------------------------------------------------------------------------

# Immutable content-hashed Next.js build assets — 1 year, no cookies/queries.
resource "aws_cloudfront_cache_policy" "static_immutable" {
  name        = "${local.name_prefix}-static-immutable"
  comment     = "1-year cache for content-hashed /_next/static assets"
  default_ttl = 31536000
  max_ttl     = 31536000
  min_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Semi-static public assets (favicon, /images) — 1 day.
resource "aws_cloudfront_cache_policy" "assets_1d" {
  name        = "${local.name_prefix}-assets-1d"
  comment     = "1-day cache for favicon and public images"
  default_ttl = 86400
  max_ttl     = 86400
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Dynamic SSR/API traffic — never cached. AWS-managed policies: a custom
# TTL-0 policy cannot enable gzip/brotli flags (API rejects it), and the
# managed pair is the canonical dynamic-passthrough configuration.
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Forward the complete viewer request (headers/cookies/queries) to the ALB —
# required for Next.js auth cookies, Host-based routing and API routes.
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# -----------------------------------------------------------------------------
# Distribution
# -----------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "argus" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} CDN (Next.js on ECS via ${var.origin_domain_name})"
  price_class         = "PriceClass_200"
  http_version        = "http2and3"
  wait_for_deployment = true

  aliases = [var.domain_name]

  origin {
    domain_name = var.origin_domain_name
    origin_id   = "alb-argus"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 60
      origin_keepalive_timeout = 60
    }

    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_verify.result
    }
  }

  # Default — SSR pages + API routes: no cache, all methods, full passthrough.
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-argus"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # Content-hashed Next.js build output — immutable.
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-argus"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.static_immutable.id
  }

  ordered_cache_behavior {
    path_pattern           = "/favicon.ico"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-argus"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.assets_1d.id
  }

  ordered_cache_behavior {
    path_pattern           = "/images/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-argus"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.assets_1d.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cloudfront.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = { Name = "${local.name_prefix}-cdn" }
}
