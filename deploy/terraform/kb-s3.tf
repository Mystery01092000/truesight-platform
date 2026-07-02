# =============================================================================
# Knowledge Base S3 backend — durable object + embedding storage for Argus.
#
# Stores KB artefacts (raw docs, chunks, embedding vectors, ingestion state)
# with versioning for auditability. Lifecycle expires old noncurrent versions
# after 30 days to control cost. Public access is fully blocked.
# =============================================================================

resource "aws_s3_bucket" "knowledge_base" {
  bucket = "argus-prod-kb-backend"
}

resource "aws_s3_bucket_versioning" "knowledge_base" {
  bucket = aws_s3_bucket.knowledge_base.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "knowledge_base" {
  bucket = aws_s3_bucket.knowledge_base.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "knowledge_base" {
  bucket = aws_s3_bucket.knowledge_base.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    # Empty filter = whole bucket (required by provider >= 5.x).
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "knowledge_base" {
  bucket = aws_s3_bucket.knowledge_base.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "knowledge_base_bucket" {
  statement {
    sid    = "AllowArgusEcsTaskRole"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.task.arn]
    }

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

resource "aws_s3_bucket_policy" "knowledge_base" {
  bucket = aws_s3_bucket.knowledge_base.id
  policy = data.aws_iam_policy_document.knowledge_base_bucket.json
}

# -----------------------------------------------------------------------------
# ACTIVE KB bucket — knowledge-base-iac-argus-backend (matches the app's
# KB_BUCKET_NAME default in lib/config/env.ts). The legacy argus-prod-kb-backend
# bucket above is KEPT until its objects are migrated; KB_BUCKET_NAME (ssm.tf)
# points here.
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "kb_backend" {
  bucket = "knowledge-base-iac-argus-backend"
}

resource "aws_s3_bucket_versioning" "kb_backend" {
  bucket = aws_s3_bucket.kb_backend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "kb_backend" {
  bucket = aws_s3_bucket.kb_backend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "kb_backend" {
  bucket = aws_s3_bucket.kb_backend.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    # Empty filter = whole bucket (required by provider >= 5.x).
    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "kb_backend" {
  bucket = aws_s3_bucket.kb_backend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "kb_backend_bucket" {
  statement {
    sid    = "AllowArgusEcsTaskRole"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.task.arn]
    }

    actions = [
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = [
      aws_s3_bucket.kb_backend.arn,
      "${aws_s3_bucket.kb_backend.arn}/*",
    ]
  }
}

resource "aws_s3_bucket_policy" "kb_backend" {
  bucket = aws_s3_bucket.kb_backend.id
  policy = data.aws_iam_policy_document.kb_backend_bucket.json
}

output "kb_bucket_arn" {
  description = "ARN of the ACTIVE Knowledge Base S3 bucket."
  value       = aws_s3_bucket.kb_backend.arn
}

output "kb_bucket_name" {
  description = "Name of the ACTIVE Knowledge Base S3 bucket."
  value       = aws_s3_bucket.kb_backend.id
}

output "kb_bucket_legacy_name" {
  description = "Legacy KB bucket kept until object migration completes."
  value       = aws_s3_bucket.knowledge_base.id
}
