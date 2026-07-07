# =============================================================================
# Truesight | Production deployment — input variables
# All defaults are the GROUND-TRUTH prod values (verified against the live
# estate). Override via a *.tfvars file only for exceptional cases.
# =============================================================================

# ---- Accounts / region -------------------------------------------------------
variable "aws_region" {
  description = "AWS region for all Truesight resources."
  type        = string
  default     = "ap-south-1"
}

variable "prod_account_id" {
  description = "Prod workload account ID (default provider assumes into it)."
  type        = string
  default     = "404063516552"
}

variable "management_account_id" {
  description = "Management account ID that owns the Route53 hosted zone."
  type        = string
  default     = "664224997032"
}

variable "assume_role_name" {
  description = "Role assumed by the default provider in the prod account."
  type        = string
  default     = "OrganizationAccountAccessRole"
}

variable "management_role_arn" {
  description = <<-EOT
    Optional role ARN assumed by the `aws.management` provider to manage the
    Route53 record cross-account. Leave empty ("") when the pipeline's base
    credentials already live in the management account (664224997032).
  EOT
  type        = string
  default     = ""
}

# ---- Naming ------------------------------------------------------------------
variable "app_name" {
  description = "Short application name used in resource names."
  type        = string
  default     = "truesight"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "prod"
}

variable "ecr_namespace" {
  description = "ECR registry namespace. Repo becomes <namespace>/<app_name> (arcane-prod/truesight) — matches the Jenkins cwtDockerBuildPush target."
  type        = string
  default     = "arcane-prod"
}

# ---- Existing networking (READ-ONLY — never modified) ------------------------
variable "vpc_id" {
  description = "Existing prod VPC ID (arcane-prod, 10.20.0.0/16)."
  type        = string
  default     = "vpc-00cf281ecbac12e72"
}

variable "public_subnet_ids" {
  description = "Existing prod PUBLIC subnets (1a, 1b) — ALB placement."
  type        = list(string)
  default = [
    "subnet-0755bb216f0454367", # ap-south-1a
    "subnet-01a6d952317a99d59", # ap-south-1b
  ]
}

variable "private_subnet_ids" {
  description = "Existing prod PRIVATE subnets (1a, 1b) — ECS task ENIs."
  type        = list(string)
  default = [
    "subnet-0b199be7f41906b15", # ap-south-1a
    "subnet-0b84803ae7165294a", # ap-south-1b
  ]
}

variable "data_subnet_ids" {
  description = "Existing prod DATA subnets (1a, 1b) — RDS subnet group."
  type        = list(string)
  default = [
    "subnet-018ff35618d00a263", # ap-south-1a
    "subnet-0ab07191aecdb0e04", # ap-south-1b
  ]
}

# ---- DNS / TLS ---------------------------------------------------------------
variable "domain_name" {
  description = "Public FQDN served by Truesight."
  type        = string
  default     = "truesight.arcane.tech"
}

variable "hosted_zone_id" {
  description = "Route53 public hosted zone (arcane.tech) in the management account."
  type        = string
  default     = "Z08590081H9KT0BUGB1O9"
}

variable "acm_domain" {
  description = "Regional ACM certificate domain to look up for the HTTPS listener."
  type        = string
  default     = "*.arcane.tech"
}

variable "origin_domain_name" {
  description = "Origin-facing FQDN CloudFront uses to reach the ALB (covered by the wildcard ALB cert)."
  type        = string
  default     = "truesight-origin.arcane.tech"
}

# ---- Container / ECS ---------------------------------------------------------
variable "container_port" {
  description = "Port the Next.js standalone server listens on."
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "ALB target-group + smoke-test health path."
  type        = string
  default     = "/api/health"
}

variable "task_cpu" {
  description = "Fargate task CPU units (1024 = 1 vCPU)."
  type        = number
  default     = 1024
}

variable "task_memory" {
  description = "Fargate task memory (MiB)."
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Desired running task count."
  type        = number
  default     = 2
}

variable "min_count" {
  description = "Autoscaling minimum task count."
  type        = number
  default     = 2
}

variable "max_count" {
  description = "Autoscaling maximum task count."
  type        = number
  default     = 4
}

variable "image_tag" {
  description = "Container image tag the service runs. CI (Jenkins) pushes and rolls this forward; Terraform only bootstraps."
  type        = string
  default     = "latest"
}

# ---- Database ----------------------------------------------------------------
variable "db_instance_class" {
  description = "RDS instance class (Graviton, cost-optimised)."
  type        = string
  default     = "db.t4g.small"
}

variable "db_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "truesight"
}

variable "db_allocated_storage" {
  description = "Initial RDS storage (GB)."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "RDS storage autoscaling ceiling (GB)."
  type        = number
  default     = 50
}

# ---- Secrets -----------------------------------------------------------------
variable "app_secret_keys" {
  description = <<-EOT
    Runtime secret names injected into the task from SSM SecureStrings at
    /arcane/prod/truesight/<KEY>. Created as PLACEHOLDERs with ignore_changes on value;
    real values are filled out-of-band, never committed.
  EOT
  type        = list(string)
  default = [
    "DATABASE_URL",
    "SESSION_SECRET",
    "ADMIN_EMAIL",
    # NOTE: ADMIN_NAME is intentionally NOT here. It is read only at seed time
    # (db/seed.ts, scripts/seed.mjs) to set the super-admin's display name — the web
    # runtime and the scheduled sync never read it. Injecting it into the task-def
    # would force a needless new revision, and its SSM param already exists out-of-band.
    "ADMIN_PASSWORD_HASH",
    "GITHUB_PAT",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    # Direct prod-account read keys — resolveAccountCredentials() uses these for
    # the prod account (direct-prod mode); without them prod discovery falls back
    # to AssumeRole truesight-readonly@prod, which the base principal cannot assume.
    "AWS_PROD_ACCESS_KEY_ID",
    "AWS_PROD_SECRET_ACCESS_KEY",
    "AWS_READONLY_ROLE_ARN",
    "AZURE_CLIENT_ID",
    "AZURE_CLIENT_SECRET",
    "AZURE_TENANT_ID",
    "AZURE_SUBSCRIPTION_ID",
    # Azure AD SSO app registration (distinct from the estate SP above).
    "AZURE_SSO_TENANT_ID",
    "AZURE_SSO_CLIENT_ID",
    "AZURE_SSO_CLIENT_SECRET",
  ]
}

variable "ssm_prefix" {
  description = "SSM parameter path prefix for Truesight secrets."
  type        = string
  default     = "/arcane/prod/truesight"
}

variable "truesight_readonly_role_arns" {
  description = "Cross-account read-only roles the task may assume for estate discovery."
  type        = list(string)
  default     = ["arn:aws:iam::*:role/truesight-readonly"]
}

# ---- Discovery config (non-secret) -------------------------------------------
variable "github_org" {
  description = "GitHub org discovered for the GitHub insights pillar."
  type        = string
  default     = "arcane"
}

variable "azure_resource_group" {
  description = "Azure resource group scanned by the estate explorer."
  type        = string
  default     = "rg-arcane-prod"
}

variable "azure_subscription_name" {
  description = "Azure subscription display name (resolved to a GUID at runtime)."
  type        = string
  default     = "Arcane-Prod"
}

# ---- Auto-refresh sync schedule ----------------------------------------------
variable "sync_schedule_expression" {
  description = <<-EOT
    EventBridge schedule for the estate auto-refresh (the truesight-prod-sync Fargate
    task re-discovers AWS + Azure + GitHub into the KB, incrementally). Tunable:
    `rate(10 minutes)` for freshest, `cron(0/30 8-20 ? * MON-FRI *)` for business
    hours. Default balances freshness vs GitHub/Azure API limits and cost.
  EOT
  type        = string
  default     = "rate(30 minutes)"
}

# ---- Knowledge Base ingestion schedule ---------------------------------------
variable "kb_ingest_schedule_expression" {
  description = "EventBridge schedule for the Knowledge Base ingestion Fargate task."
  type        = string
  default     = "rate(10 minutes)"
}

# ---- Monitoring --------------------------------------------------------------
variable "alarm_email" {
  description = "Optional email subscribed to the alarm SNS topic. Empty = no subscription."
  type        = string
  default     = ""
}

variable "alarm_cpu_threshold" {
  description = "ECS/RDS CPU utilisation alarm threshold (%)."
  type        = number
  default     = 80
}

variable "alarm_memory_threshold" {
  description = "ECS memory utilisation alarm threshold (%)."
  type        = number
  default     = 80
}

variable "alarm_5xx_threshold" {
  description = "ALB 5xx count threshold over the evaluation window."
  type        = number
  default     = 10
}

variable "alarm_evaluation_periods" {
  description = "Consecutive periods breached before an alarm fires."
  type        = number
  default     = 2
}

variable "rds_free_storage_bytes_threshold" {
  description = "RDS free storage low-water mark (bytes). Default 2 GiB."
  type        = number
  default     = 2147483648
}

variable "enable_readonly_cost_grant" {
  description = <<-EOT
    Attach the Cost Explorer read policy to the shared truesight-readonly discovery
    role. The role is provisioned per-account by iac-self-service-terraform and
    does not exist in this account yet — enable once it does.
  EOT
  type        = bool
  default     = false
}

variable "kb_embedding_provider" {
  description = "Active KB embedding provider (openai | bedrock). Bedrock-first: the KB launched with Titan v2 embeddings (no OpenAI corpus ever existed to migrate)."
  type        = string
  default     = "bedrock"
}
