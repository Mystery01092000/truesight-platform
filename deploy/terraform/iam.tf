# =============================================================================
# IAM — ECS task EXECUTION role (pulls image + injects SSM secrets at start)
# and TASK role (the running app's identity: read secrets, assume read-only
# cross-account discovery roles). Both least-privilege.
# =============================================================================

locals {
  account_id = data.aws_caller_identity.current.account_id
  ssm_arn    = "arn:aws:ssm:${var.aws_region}:${local.account_id}:parameter${var.ssm_prefix}/*"
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ---- Execution role ----------------------------------------------------------
resource "aws_iam_role" "execution" {
  name               = "${local.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = { Name = "${local.name_prefix}-ecs-execution" }
}

# Standard ECR pull + CloudWatch Logs permissions.
resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Read the SSM SecureStrings that back the container `secrets` at task start.
data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid       = "ReadArgusSsmSecrets"
    effect    = "Allow"
    actions   = ["ssm:GetParameters", "ssm:GetParameter"]
    resources = [local.ssm_arn]
  }

  statement {
    sid       = "DecryptViaSsm"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${local.name_prefix}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# ---- Task role ---------------------------------------------------------------
resource "aws_iam_role" "task" {
  name               = "${local.name_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = { Name = "${local.name_prefix}-ecs-task" }
}

data "aws_iam_policy_document" "task" {
  # Runtime read of Argus secrets.
  statement {
    sid       = "ReadArgusSsm"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = [local.ssm_arn]
  }

  # Decrypt those SecureStrings.
  statement {
    sid       = "DecryptViaSsm"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.aws_region}.amazonaws.com"]
    }
  }

  # Cross-account estate discovery — assume only the read-only Argus roles.
  statement {
    sid       = "AssumeArgusReadonly"
    effect    = "Allow"
    actions   = ["sts:AssumeRole"]
    resources = var.argus_readonly_role_arns
  }

  # Knowledge Base S3 artefacts (docs, chunks, embedding state).
  # Bucket encryption is AES256 (SSE-S3) so no extra KMS decrypt is required.
  statement {
    sid    = "KnowledgeBaseS3Access"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = [
      aws_s3_bucket.knowledge_base.arn,
      "${aws_s3_bucket.knowledge_base.arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${local.name_prefix}-task-policy"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}
