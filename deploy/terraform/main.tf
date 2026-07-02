# =============================================================================
# Argus | Cloud governance platform — PRODUCTION deployment
# Next.js 16 (standalone) on ECS Fargate, fronted by a dedicated ALB, backed by
# a small RDS PostgreSQL instance, all inside the EXISTING prod VPC.
#
# Account (default provider) : 404063516552  (assume OrganizationAccountAccessRole)
# Account (management alias)  : 664224997032  (Route53 zone owner)
# Region                      : ap-south-1
#
# SAFETY: This code REFERENCES existing shared infrastructure (VPC, subnets,
# ACM cert, Route53 zone) via read-only data sources and NEVER mutates it.
# Backend state is isolated under argus/prod/*.
# =============================================================================

terraform {
  # State bucket + lock table are the canonical estate backend.
  backend "s3" {
    bucket         = "terraform-iac-data"
    key            = "argus/prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "keystone-terraform-locks"
    encrypt        = true
  }
}

# -----------------------------------------------------------------------------
# Default provider — PROD workload account (404063516552).
# The pipeline's base identity (a management-account principal) assumes
# OrganizationAccountAccessRole into prod. Every resource is stamped with the
# mandated default_tags.
# -----------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  assume_role {
    role_arn     = "arn:aws:iam::${var.prod_account_id}:role/${var.assume_role_name}"
    session_name = "terraform-argus-prod"
  }

  default_tags {
    tags = {
      Owner       = "rishabh"
      Team        = "infra-services"
      Project     = "argus"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# us-east-1 provider — CloudFront viewer certificates MUST live in us-east-1.
# Same prod-account assume_role as the default provider, different region.
# -----------------------------------------------------------------------------
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  assume_role {
    role_arn     = "arn:aws:iam::${var.prod_account_id}:role/${var.assume_role_name}"
    session_name = "terraform-argus-prod-cf"
  }

  default_tags {
    tags = {
      Owner       = "rishabh"
      Team        = "infra-services"
      Project     = "argus"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Management provider — Route53 hosted zone lives in the management account
# (664224997032). The pipeline's base credentials already reside in this
# account, so this aliased provider uses them directly (no assume_role).
#
# NOTE (confirm before apply): if your runner's base identity is NOT in
# 664224997032, set var.management_role_arn and re-enable the assume_role
# block below so this provider can reach the zone cross-account.
# -----------------------------------------------------------------------------
provider "aws" {
  alias  = "management"
  region = var.aws_region

  # dynamic assume-role: only engaged when var.management_role_arn is non-empty.
  dynamic "assume_role" {
    for_each = var.management_role_arn == "" ? [] : [1]
    content {
      role_arn     = var.management_role_arn
      session_name = "terraform-argus-dns"
    }
  }

  default_tags {
    tags = {
      Owner       = "rishabh"
      Team        = "infra-services"
      Project     = "argus"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# -----------------------------------------------------------------------------
# Shared local values.
# -----------------------------------------------------------------------------
locals {
  name_prefix = "${var.app_name}-${var.environment}" # argus-prod

  # Name tags only (functional tags come from provider default_tags).
  name_tag = { Name = local.name_prefix }
}
