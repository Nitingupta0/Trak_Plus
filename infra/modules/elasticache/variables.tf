variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (staging / prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the ElastiCache subnet group lives"
  type        = string
}

variable "private_subnet_ids" {
  description = "Subnet IDs for the ElastiCache subnet group"
  type        = list(string)
}

variable "allowed_security_group_id" {
  description = "Security group allowed to connect to Redis (backend)"
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.micro"
}