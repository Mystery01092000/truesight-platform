# =============================================================================
# Knowledge Base SSM parameters — non-secret config + placeholder secret.
#
# OPENAI_API_KEY is a SecureString placeholder; real value is set out-of-band.
# KB_BUCKET_NAME and KB_EMBEDDING_MODEL are plain String config values.
# =============================================================================

resource "aws_ssm_parameter" "openai_api_key" {
  name        = "${var.ssm_prefix}/OPENAI_API_KEY"
  type        = "SecureString"
  value       = "PLACEHOLDER_FILL_OUT_OF_BAND"
  description = "OpenAI API key for KB embeddings. Real value set out-of-band."
  tags        = { Name = "${var.ssm_prefix}/OPENAI_API_KEY", Service = var.app_name }

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "kb_bucket_name" {
  name        = "${var.ssm_prefix}/KB_BUCKET_NAME"
  type        = "String"
  value       = aws_s3_bucket.kb_backend.id
  description = "S3 bucket used by the Truesight Knowledge Base backend."
  tags        = { Name = "${var.ssm_prefix}/KB_BUCKET_NAME", Service = var.app_name }
}

# Terraform OWNS this value (composed from the redis module + its auth token);
# no ignore_changes — rotation happens by re-applying the module.
resource "aws_ssm_parameter" "redis_url" {
  name        = "${var.ssm_prefix}/REDIS_URL"
  type        = "SecureString"
  value       = local.redis_url
  description = "Full rediss:// connection URL (auth token embedded) for the Truesight cache."
  tags        = { Name = "${var.ssm_prefix}/REDIS_URL", Service = var.app_name }
}

resource "aws_ssm_parameter" "kb_embedding_model" {
  name        = "${var.ssm_prefix}/KB_EMBEDDING_MODEL"
  type        = "String"
  value       = "text-embedding-3-small"
  description = "OpenAI embedding model used for KB vectorisation."
  tags        = { Name = "${var.ssm_prefix}/KB_EMBEDDING_MODEL", Service = var.app_name }
}
