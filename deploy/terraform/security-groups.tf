# =============================================================================
# Security groups (in the existing prod VPC).
#   alb   : 80/443 from the internet, egress all
#   ecs   : container_port from ALB only, egress all
#   rds   : 5432 from ECS only, no egress
#   redis : 6379 from ECS only, no egress
# Uses the modern aws_vpc_security_group_*_rule resources (one rule per object)
# mirroring cms-ecs.tf.
# =============================================================================

# ---- ALB SG ------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Truesight prod ALB - HTTP/HTTPS from internet"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.name_prefix}-alb-sg" }
}

# CloudFront hardening (ENABLED at cutover): :443 accepts only CloudFront's
# origin-facing IP ranges via the AWS-managed prefix list; the previous open
# 0.0.0.0/0 rules on :443/:80 were removed (CloudFront terminates :80 itself).
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https_from_cloudfront" {
  security_group_id = aws_security_group.alb.id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id
  tags              = { Name = "${local.name_prefix}-alb-https-cloudfront" }
}

resource "aws_vpc_security_group_egress_rule" "alb_egress" {
  security_group_id = aws_security_group.alb.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  tags              = { Name = "${local.name_prefix}-alb-egress" }
}

# ---- ECS task SG -------------------------------------------------------------
resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs-sg"
  description = "Truesight prod ECS tasks - from ALB only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.name_prefix}-ecs-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  from_port                    = var.container_port
  to_port                      = var.container_port
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb.id
  tags                         = { Name = "${local.name_prefix}-ecs-from-alb" }
}

resource "aws_vpc_security_group_egress_rule" "ecs_egress" {
  security_group_id = aws_security_group.ecs.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  tags              = { Name = "${local.name_prefix}-ecs-egress" }
}

# ---- RDS SG ------------------------------------------------------------------
resource "aws_security_group" "rds" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Truesight prod RDS - PostgreSQL 5432 from ECS tasks only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.name_prefix}-rds-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.ecs.id
  tags                         = { Name = "${local.name_prefix}-rds-from-ecs" }
}

# ---- Redis SG ------------------------------------------------------------------
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis-sg"
  description = "Truesight prod Redis - 6379 from ECS tasks only"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.name_prefix}-redis-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "redis_from_ecs" {
  security_group_id            = aws_security_group.redis.id
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.ecs.id
  tags                         = { Name = "${local.name_prefix}-redis-from-ecs" }
}
