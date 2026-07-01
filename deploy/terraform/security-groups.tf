# =============================================================================
# Security groups (in the existing prod VPC).
#   alb  : 80/443 from the internet, egress all
#   ecs  : container_port from ALB only, egress all
#   rds  : 5432 from ECS only, no egress
# Uses the modern aws_vpc_security_group_*_rule resources (one rule per object)
# mirroring cms-ecs.tf.
# =============================================================================

# ---- ALB SG ------------------------------------------------------------------
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Argus prod ALB - HTTP/HTTPS from internet"
  vpc_id      = var.vpc_id
  tags        = { Name = "${local.name_prefix}-alb-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  tags              = { Name = "${local.name_prefix}-alb-https" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  tags              = { Name = "${local.name_prefix}-alb-http" }
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
  description = "Argus prod ECS tasks - from ALB only"
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
  description = "Argus prod RDS - PostgreSQL 5432 from ECS tasks only"
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
