# =============================================================================
# ECR — container registry for the Argus image.
# Repo: cwt-prod/argus  (matches Jenkins `cwtDockerBuildPush` target).
# Module enforces scan_on_push=true, keep last 10 tagged images, expire
# untagged after 7 days.
# =============================================================================

module "ecr" {
  # Shared estate module. Consumed via local path within the infra-workspace
  # monorepo (sibling repo iac-self-service-terraform @ dev / commit 841eddd) —
  # the same relative-path pattern environments/nr-platform-prod uses.
  # For standalone CI of this repo, swap to the pinned git source:
  #   git::https://github.com/centricitywealthtech/iac-self-service-terraform.git//terraform/modules/compute/ecr?ref=main
  source = "../../../iac-self-service-terraform/terraform/modules/compute/ecr"

  namespace = var.ecr_namespace # cwt-prod
  services  = [var.app_name]    # -> cwt-prod/argus

  # MUTABLE so the rolling `latest` tag can be re-pushed; immutable sha-<git>
  # tags are what deployments actually pin.
  image_tag_mutability = "MUTABLE"
  max_image_count      = 10

  tags = { Service = var.app_name }
}
