# =============================================================================
# ElastiCache Redis — small single-node cache for Truesight (session/query cache).
# Lives in the prod DATA subnets (same as RDS); reachable ONLY from the ECS
# task SG (6379). The module enables at-rest (KMS) + in-transit encryption and
# generates an auth token stored in Secrets Manager.
# =============================================================================

module "redis" {
  # Shared estate module (local path; git-source alt in ecr.tf header).
  source = "../../../iac-self-service-terraform/terraform/modules/database/redis"

  namespace = local.name_prefix # -> truesight-prod-redis

  subnet_ids         = var.data_subnet_ids
  security_group_ids = [aws_security_group.redis.id]

  node_type          = "cache.t4g.micro"
  num_cache_clusters = 1

  tags = { Service = var.app_name }
}

# The module keeps the generated auth token in Secrets Manager only; read it
# back to compose the REDIS_URL the app consumes (rediss:// = TLS, matching
# transit_encryption_enabled). depends_on defers the read until the secret
# VERSION (written inside the module) exists.
data "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id  = module.redis.auth_token_secret_arn
  depends_on = [module.redis]
}

locals {
  redis_url = "rediss://:${jsondecode(data.aws_secretsmanager_secret_version.redis_auth.secret_string).auth_token}@${module.redis.primary_endpoint}:${module.redis.port}"
}
