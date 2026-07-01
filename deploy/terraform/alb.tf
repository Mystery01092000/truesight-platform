# =============================================================================
# ALB — small dedicated internet-facing load balancer for Argus.
#   :443 HTTPS  -> forward to the :3000 IP target group (Next.js)
#   :80  HTTP   -> 301 redirect to :443
# Certificate is the regional *.centricitywealth.tech ACM cert (data lookup).
# =============================================================================

resource "aws_lb" "this" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
  tags               = { Name = "${local.name_prefix}-alb" }
}

resource "aws_lb_target_group" "this" {
  name        = "${local.name_prefix}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = var.health_check_path
    matcher             = "200-299"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Allow the ALB to bring up a new target group before destroying the old one
  # on immutable changes.
  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name_prefix}-tg" }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = data.aws_acm_certificate.wildcard.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }

  tags = { Name = "${local.name_prefix}-https" }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }

  tags = { Name = "${local.name_prefix}-http-redirect" }
}
