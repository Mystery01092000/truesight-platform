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

# CUTOVER (CloudFront hardening — enable AFTER argus-infraspace DNS points at
# the distribution, together with the prefix-list SG rule in
# security-groups.tf): only requests carrying CloudFront's X-Origin-Verify
# secret reach the app; direct-to-ALB traffic gets a 403. Also flip the
# `https` listener default_action above to the fixed-response below so the
# forward happens exclusively through this rule.
#
# resource "aws_lb_listener_rule" "cloudfront_origin_verify" {
#   listener_arn = aws_lb_listener.https.arn
#   priority     = 1
#
#   action {
#     type             = "forward"
#     target_group_arn = aws_lb_target_group.this.arn
#   }
#
#   condition {
#     http_header {
#       http_header_name = "X-Origin-Verify"
#       values           = [random_password.origin_verify.result]
#     }
#   }
#
#   tags = { Name = "${local.name_prefix}-origin-verify" }
# }
#
# ...and replace the `https` listener default_action with:
#   default_action {
#     type = "fixed-response"
#     fixed_response {
#       content_type = "text/plain"
#       message_body = "Forbidden"
#       status_code  = "403"
#     }
#   }
