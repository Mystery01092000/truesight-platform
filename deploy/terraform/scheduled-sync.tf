# =============================================================================
# Auto-refresh KB pipeline — EventBridge-scheduled estate re-sync.
#
# Every `var.sync_schedule_expression` (default 30 min) an isolated Fargate task
# (image cwt-prod/argus-sync) re-discovers the complete estate — AWS (both
# accounts, all regions), Azure (whole subscription), GitHub (org) — and writes
# INCREMENTALLY into the KB (resources upsert-by-urn + snapshot-on-change), so
# the Postgres snapshot the screens read stays fresh without a manual refresh.
#
# The sync runs in ITS OWN task (never the 256/512 web task), reusing the app's
# execution + task roles (SSM read + KMS decrypt + sts:AssumeRole argus-readonly),
# the private subnets (NAT egress), the ECS SG, and the same /cwt/prod/argus/*
# secrets. The image is built + pushed to ECR by the Jenkins pipeline.
# =============================================================================

module "scheduled_sync" {
  source = "../../../iac-self-service-terraform/terraform/modules/compute/ecs-scheduled-task"

  task_name = "sync"
  namespace = local.name_prefix # argus-prod  -> rule "argus-prod-sync"

  cluster_arn        = module.ecs_cluster.cluster_id
  subnet_ids         = var.private_subnet_ids
  security_group_ids = [aws_security_group.ecs.id]

  image_url = "${module.ecr.repository_urls["${var.app_name}-sync"]}:latest"
  cpu       = 512  # discovery is heavier than the web task; valid Fargate pair
  memory    = 1024 # with cpu 512
  command   = []   # use the image's built-in 3-CLI sync CMD (Dockerfile.sync)

  schedule_expression = var.sync_schedule_expression

  # Reuse the app roles: execution reads the SSM secrets below (+ KMS decrypt);
  # task assumes argus-readonly for cross-account discovery.
  execution_role_arn = aws_iam_role.execution.arn
  task_role_arn      = aws_iam_role.task.arn

  # Non-secret discovery config — mirrors the app's environment_variables so the
  # adapters resolve the same accounts / org / subscription.
  environment_variables = {
    AWS_REGION              = var.aws_region
    AWS_MGMT_ACCOUNT_ID     = var.management_account_id
    AWS_PROD_ACCOUNT_ID     = var.prod_account_id
    GITHUB_ORG              = var.github_org
    AZURE_RESOURCE_GROUP    = var.azure_resource_group
    AZURE_SUBSCRIPTION_NAME = var.azure_subscription_name
  }

  # Same SSM SecureStrings the app uses (DATABASE_URL, AWS_*, AWS_PROD_*, GITHUB_PAT,
  # AZURE_*). Injected by the execution role at task start; unused keys are harmless.
  secrets = {
    for k in var.app_secret_keys : k => aws_ssm_parameter.app[k].arn
  }

  tags = { Service = var.app_name }
}
