variable "project_name" {
  description = "Project name for repo naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "repos" {
  description = "ECR repository names to create"
  type        = list(string)
  default     = ["backend", "frontend"]
}