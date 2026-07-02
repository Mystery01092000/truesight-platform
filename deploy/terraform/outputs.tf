# =============================================================================
# Outputs — consumed by Jenkins (cwtEcsDeploy / smoke test) and operators.
# =============================================================================

output "app_url" {
  description = "Public HTTPS URL for Argus."
  value       = "https://${var.domain_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name (Route53 ALIAS target)."
  value       = aws_lb.this.dns_name
}

output "ecr_repository_url" {
  description = "ECR repo Jenkins pushes to (cwt-prod/argus)."
  value       = module.ecr.repository_urls[var.app_name]
}

output "ecs_cluster_name" {
  description = "ECS cluster name (cwtEcsDeploy target)."
  value       = module.ecs_cluster.cluster_name
}

output "ecs_service_name" {
  description = "ECS service name (cwtEcsDeploy target)."
  value       = module.ecs_service.service_name
}

output "log_group_name" {
  description = "CloudWatch log group for the Argus container."
  value       = module.ecs_service.log_group_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (host only)."
  value       = module.rds.endpoint
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN holding the RDS master credential."
  value       = module.rds.secret_arn
}

output "alarm_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications."
  value       = aws_sns_topic.alarms.arn
}

output "ssm_secret_prefix" {
  description = "SSM path prefix operators fill with real secret values."
  value       = var.ssm_prefix
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (cache invalidations after deploys)."
  value       = aws_cloudfront_distribution.argus.id
}

output "cloudfront_domain_name" {
  description = "CloudFront *.cloudfront.net domain (pre-cutover verification target)."
  value       = aws_cloudfront_distribution.argus.domain_name
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (host only)."
  value       = module.redis.primary_endpoint
}
