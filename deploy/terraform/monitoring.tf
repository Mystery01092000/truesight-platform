# =============================================================================
# Monitoring — SNS topic + CloudWatch alarms covering the full request path:
# ALB 5xx, unhealthy targets, ECS CPU/memory, RDS CPU + free storage.
# =============================================================================

resource "aws_sns_topic" "alarms" {
  name = "${local.name_prefix}-alarms"
  tags = { Name = "${local.name_prefix}-alarms" }
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# ---- ALB: elevated 5xx from the load balancer -------------------------------
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.name_prefix}-alb-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_5xx_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_description   = "Truesight ALB returning >= ${var.alarm_5xx_threshold} 5xx per 5 min."
  dimensions          = { LoadBalancer = aws_lb.this.arn_suffix }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  tags                = { Name = "${local.name_prefix}-alb-5xx" }
}

# ---- ALB: target group has unhealthy hosts ----------------------------------
resource "aws_cloudwatch_metric_alarm" "tg_unhealthy" {
  alarm_name          = "${local.name_prefix}-tg-unhealthy"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_description   = "Truesight target group has unhealthy tasks."
  dimensions = {
    TargetGroup  = aws_lb_target_group.this.arn_suffix
    LoadBalancer = aws_lb.this.arn_suffix
  }
  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = { Name = "${local.name_prefix}-tg-unhealthy" }
}

# ---- ECS: CPU + memory saturation -------------------------------------------
resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  alarm_name          = "${local.name_prefix}-ecs-cpu-high"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_cpu_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_description   = "Truesight ECS service CPU > ${var.alarm_cpu_threshold}%."
  dimensions = {
    ClusterName = module.ecs_cluster.cluster_name
    ServiceName = module.ecs_service.service_name
  }
  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = { Name = "${local.name_prefix}-ecs-cpu-high" }
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  alarm_name          = "${local.name_prefix}-ecs-mem-high"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_memory_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_description   = "Truesight ECS service memory > ${var.alarm_memory_threshold}%."
  dimensions = {
    ClusterName = module.ecs_cluster.cluster_name
    ServiceName = module.ecs_service.service_name
  }
  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
  tags          = { Name = "${local.name_prefix}-ecs-mem-high" }
}

# ---- RDS: CPU + free storage ------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.alarm_cpu_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_description   = "Truesight RDS CPU > ${var.alarm_cpu_threshold}%."
  dimensions          = { DBInstanceIdentifier = module.rds.instance_id }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  tags                = { Name = "${local.name_prefix}-rds-cpu-high" }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.name_prefix}-rds-low-storage"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = var.alarm_evaluation_periods
  threshold           = var.rds_free_storage_bytes_threshold
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_description   = "Truesight RDS free storage below threshold."
  dimensions          = { DBInstanceIdentifier = module.rds.instance_id }
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
  tags                = { Name = "${local.name_prefix}-rds-low-storage" }
}
