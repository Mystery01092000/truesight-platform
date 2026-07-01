# =============================================================================
# Read-only lookups of EXISTING shared infrastructure.
#
# The prod VPC + subnets are referenced by ID (the canonical, proven pattern in
# environments/nr-platform-prod) rather than terraform_remote_state, because the
# networking state key is owned by a different root module — data sources keep
# this stack decoupled and guarantee we only ever READ, never plan changes to,
# the shared network. Swap to a `terraform_remote_state` block here if/when the
# networking outputs are published under a stable state key.
# =============================================================================

data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# Existing prod VPC — asserts presence; never modified.
data "aws_vpc" "prod" {
  id = var.vpc_id
}

# Regional wildcard cert (*.centricitywealth.tech) for the HTTPS listener.
data "aws_acm_certificate" "wildcard" {
  domain      = var.acm_domain
  statuses    = ["ISSUED"]
  most_recent = true
}
