variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name used for resource naming and tags"
  type        = string
  default     = "trakplus"
}

variable "environment" {
  description = "Environment name (staging | prod)"
  type        = string
  default     = "staging"
}
