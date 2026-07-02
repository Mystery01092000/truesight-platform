# =============================================================================
# DNS — public A/ALIAS record for argus-infraspace.centricitywealth.tech.
# The hosted zone lives in the MANAGEMENT account (664224997032), so this
# record is created through the aws.management provider. Aliases the ALB.
# =============================================================================

resource "aws_route53_record" "argus" {
  provider = aws.management

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

# CUTOVER (CloudFront): once the distribution is deployed and verified against
# its *.cloudfront.net domain, replace the alias block above with the one below
# so argus-infraspace serves through CloudFront, then enable the origin-facing
# SG rule + X-Origin-Verify listener hardening (security-groups.tf / alb.tf).
#
#   alias {
#     name                   = aws_cloudfront_distribution.argus.domain_name
#     zone_id                = aws_cloudfront_distribution.argus.hosted_zone_id # always Z2FDTNDATAQYW2
#     evaluate_target_health = false
#   }

# Origin-facing hostname CloudFront dials the ALB through. Stays on the ALB
# permanently (the wildcard *.centricitywealth.tech ALB cert covers it).
resource "aws_route53_record" "argus_origin" {
  provider = aws.management

  zone_id = var.hosted_zone_id
  name    = var.origin_domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
