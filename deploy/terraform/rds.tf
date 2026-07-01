# =============================================================================
# RDS PostgreSQL — small, single-AZ, Graviton (db.t4g.micro) for Argus.
# Lives in the prod DATA subnets; reachable ONLY from the ECS task SG (5432).
# The module provisions its own KMS key, subnet group, parameter group and a
# Secrets Manager secret holding the generated master credential.
# =============================================================================

module "rds" {
  # Shared estate module (local path; git-source alt in ecr.tf header).
  source = "../../../iac-self-service-terraform/terraform/modules/database/rds-postgres"

  namespace = local.name_prefix # argus-prod
  name      = "db"              # -> identifier argus-prod-db

  subnet_ids             = var.data_subnet_ids
  vpc_security_group_ids = [aws_security_group.rds.id]

  instance_class        = var.db_instance_class # db.t4g.micro
  initial_database_name = var.db_name           # argus
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  multi_az = false

  # Production data safety.
  deletion_protection     = true
  skip_final_snapshot     = false
  backup_retention_period = 7

  # Cost control: db.t4g.micro — keep PI / enhanced monitoring off (<$50/mo).
  performance_insights_enabled = false
  enhanced_monitoring_interval = 0

  tags = { Service = var.app_name }
}
