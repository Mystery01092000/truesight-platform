# =============================================================================
# Truesight | Production deployment IaC — provider + Terraform version pins
# -----------------------------------------------------------------------------
# Pinned so every environment (local + Jenkins) resolves identical provider
# versions. The .terraform.lock.hcl produced from these constraints is committed
# (see .gitignore) for reproducible, drift-free plans.
# =============================================================================

terraform {
  required_version = ">= 1.5.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Used transitively by database/rds-postgres (random_password for the
    # RDS master credential). Declared here so it is locked at the root.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}
