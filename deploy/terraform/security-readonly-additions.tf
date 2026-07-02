# =============================================================================
# Security / vulnerability scanner — read-only permission additions.
#
# The Argus security scanner (lib/integrations/*/vuln.ts) reads posture findings
# from three AWS services using the SAME read-only credentials the discovery
# adapters already use. These are LIST/GET/DESCRIBE operations only — the scanner
# never mutates cloud state.
#
#   inspector2:ListFindings             — software vulnerabilities (EC2/ECS/ECR/lambda)
#   securityhub:GetFindings             — security best-practice / config findings
#   ecr:DescribeImageScanFindings       — container image scan results
#   ecr:DescribeImages / Repositories   — enumerate scanned images (best-effort)
#
# This policy is attached to the ECS TASK role (the running app's identity) so
# same-account direct-credential scans (management + prod) are covered. The same
# actions MUST also be granted on the cross-account `argus-readonly` role wherever
# it is defined (iac-self-service-terraform) for assume-role discovery targets.
# =============================================================================

data "aws_iam_policy_document" "security_readonly" {
  statement {
    sid       = "Inspector2ListFindings"
    effect    = "Allow"
    actions   = ["inspector2:ListFindings", "inspector2:ListFindingDetails"]
    resources = ["*"]
  }

  statement {
    sid       = "SecurityHubGetFindings"
    effect    = "Allow"
    actions   = ["securityhub:GetFindings", "securityhub:ListEnabledProductsForImport"]
    resources = ["*"]
  }

  statement {
    sid    = "EcrImageScanFindings"
    effect = "Allow"
    actions = [
      "ecr:DescribeImageScanFindings",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:ListImages",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "security_readonly" {
  name        = "${local.name_prefix}-security-readonly"
  description = "Read-only access to Inspector2, Security Hub and ECR image scan findings for the Argus security scanner."
  policy      = data.aws_iam_policy_document.security_readonly.json
  tags        = { Name = "${local.name_prefix}-security-readonly" }
}

# Attach to the running app's task identity (same-account direct-credential scans).
resource "aws_iam_role_policy_attachment" "task_security_readonly" {
  role       = aws_iam_role.task.name
  policy_arn = aws_iam_policy.security_readonly.arn
}
