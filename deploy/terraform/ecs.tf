# =============================================================================
# ECS — dedicated Fargate cluster + the Argus service.
# Cluster name resolves to `argus-prod-cluster` (module names it
# "<namespace>-cluster") — intentionally SEPARATE from the shared
# cwt-prod-cluster to isolate Argus.
# =============================================================================

module "ecs_cluster" {
  # Shared estate module (local path; git-source alt in ecr.tf header).
  source = "../../../iac-self-service-terraform/terraform/modules/compute/ecs-cluster"

  namespace = local.name_prefix # -> argus-prod-cluster
  tags      = { Service = var.app_name }
}

# -----------------------------------------------------------------------------
# SSM SecureString placeholders — real values filled OUT-OF-BAND.
# ignore_changes[value] means Terraform never overwrites rotated secrets.
# -----------------------------------------------------------------------------
resource "aws_ssm_parameter" "app" {
  for_each = toset(var.app_secret_keys)

  name        = "${var.ssm_prefix}/${each.key}"
  type        = "SecureString"
  value       = "PLACEHOLDER_FILL_OUT_OF_BAND"
  description = "Argus prod runtime secret (${each.key}). Real value set out-of-band."
  tags        = { Name = "${var.ssm_prefix}/${each.key}", Service = var.app_name }

  lifecycle {
    ignore_changes = [value]
  }
}

# -----------------------------------------------------------------------------
# Argus Fargate service (256 CPU / 512 MiB, desired 1 / max 2).
# -----------------------------------------------------------------------------
module "ecs_service" {
  # Shared estate module (local path; git-source alt in ecr.tf header).
  # NOTE: uses the `dev`-branch module which carries the `enable_execute_command`
  # toggle (to DISABLE ECS Exec in prod). `main` still hardcodes it true — promote
  # the module to main and re-pin before switching to a main git source.
  source = "../../../iac-self-service-terraform/terraform/modules/compute/ecs-service"

  service_name = var.app_name      # argus
  namespace    = local.name_prefix # argus-prod
  cluster_id   = module.ecs_cluster.cluster_id

  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.ecs.id]
  target_group_arn   = aws_lb_target_group.this.arn

  image_url = "${module.ecr.repository_urls[var.app_name]}:${var.image_tag}"

  cpu                       = var.task_cpu
  memory                    = var.task_memory
  port                      = var.container_port
  health_check_path         = var.health_check_path
  health_check_cmd          = ["NONE"] # rely on ALB target-group health check
  health_check_grace_period = 120

  desired_count = var.desired_count
  min_count     = var.min_count
  max_count     = var.max_count
  use_spot      = false

  execution_role_arn     = aws_iam_role.execution.arn
  task_role_arn          = aws_iam_role.task.arn
  enable_execute_command = false

  environment_variables = {
    NODE_ENV                = "production"
    PORT                    = tostring(var.container_port)
    HOSTNAME                = "0.0.0.0"
    NEXT_TELEMETRY_DISABLED = "1"
    AWS_REGION              = var.aws_region
    NEXT_PUBLIC_APP_URL     = "https://${var.domain_name}"
    DATABASE_HOST           = module.rds.endpoint
    DATABASE_PORT           = "5432"
    DATABASE_NAME           = var.db_name
    DATABASE_SSL            = "true"
  }

  # Runtime secrets pulled from SSM by the execution role at task start.
  secrets = {
    for k in var.app_secret_keys : k => aws_ssm_parameter.app[k].arn
  }

  tags = { Service = var.app_name }

  # The load balancer target must be attached to a live listener first.
  depends_on = [aws_lb_listener.https]
}
