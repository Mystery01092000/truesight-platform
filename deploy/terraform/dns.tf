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
