# =============================================================================
# Cost Explorer read permissions for the argus-readonly discovery role.
#
# The `argus-readonly` role (created by the iac-self-service-terraform repo and
# assumed by the Argus task role for cross-account estate discovery) is granted
# AWS-managed ViewOnlyAccess. That policy does NOT cover Cost Explorer, so the
# cost/FinOps pillar needs an explicit, least-privilege grant of the read-only
# `ce:*` actions Argus calls:
#
#   - ce:GetCostAndUsage   — GetCostAndUsageCommand (spend grouped by service/tag)
#   - ce:GetDimensionValues — enumerate service/linked-account dimensions
#   - ce:GetTags            — enumerate cost-allocation tags (e.g. "Project")
#
# Cost Explorer is a global service, so the resources are "*" (there is no
# resource-level ARN for cost data) and the grant is identical in every account.
# This is purely additive: ViewOnlyAccess continues to power the rest of discovery.
# =============================================================================

# Read-only lookup of the existing discovery role — never creates or mutates it.
data "aws_iam_role" "argus_readonly" {
  name = "argus-readonly"
}

data "aws_iam_policy_document" "argus_readonly_cost" {
  statement {
    sid       = "CostExplorerRead"
    effect    = "Allow"
    actions   = [
      "ce:GetCostAndUsage",
      "ce:GetDimensionValues",
      "ce:GetTags",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "argus_readonly_cost" {
  # Inline (not a managed policy attachment) so the grant is self-contained in this
  # module and removed cleanly if this file is ever dropped — no orphaned policies.
  name   = "argus-readonly-cost-read"
  role   = data.aws_iam_role.argus_readonly.id
  policy = data.aws_iam_policy_document.argus_readonly_cost.json
}
