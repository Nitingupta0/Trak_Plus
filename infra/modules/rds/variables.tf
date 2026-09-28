variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (staging / prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the RDS subnet group lives"
  type        = string
}

variable "database_subnet_ids" {
  description = "Subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "allowed_security_group_id" {
  description = "Security group allowed to connect to Postgres (backend)"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "trakplus"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "trakplus"
}

variable "db_password" {
  description = "Database password (should come from secrets manager in prod)"
  type        = string
  sensitive   = true
}

variable "backup_retention_days" {
  description = "Backup retention period in days (free tier max = 1)"
  type        = number
  default     = 1
}