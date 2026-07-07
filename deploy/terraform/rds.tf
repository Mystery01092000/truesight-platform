# =============================================================================
# RDS PostgreSQL — small, single-AZ, Graviton (db.t4g.small) for Truesight.
# Lives in the prod DATA subnets; reachable ONLY from the ECS task SG (5432).
# The module provisions its own KMS key, subnet group, parameter group and a
# Secrets Manager secret holding the generated master credential.
# =============================================================================

module "rds" {
  # Shared estate module (local path; git-source alt in ecr.tf header).
  source = "../../../iac-self-service-terraform/terraform/modules/database/rds-postgres"

  namespace = local.name_prefix # truesight-prod
  name      = "db"              # -> identifier truesight-prod-db

  subnet_ids             = var.data_subnet_ids
  vpc_security_group_ids = [aws_security_group.rds.id]

  # Module default (16.6) was retired from RDS; pin a currently-available 16.x
  # (16.9). Parameter group family "postgres16" already covers this version.
  engine_version = "16.9"

  instance_class        = var.db_instance_class # db.t4g.small
  initial_database_name = var.db_name           # truesight
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  multi_az = false

  # Production data safety.
  deletion_protection     = true
  skip_final_snapshot     = false
  backup_retention_period = 7

  # Cost control: db.t4g.small — keep PI / enhanced monitoring off.
  performance_insights_enabled = false
  enhanced_monitoring_interval = 0

  tags = { Service = var.app_name }
}
