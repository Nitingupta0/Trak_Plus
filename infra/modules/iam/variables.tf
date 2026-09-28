variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "ecr_repository_arns" {
  description = "ARNs of ECR repositories for push access"
  type        = list(string)
}

variable "oidc_provider_url" {
  description = "OpenID Connect provider URL (from EKS)"
  type        = string
  default     = ""
}

variable "oidc_provider_arn" {
  description = "OpenID Connect provider ARN (from EKS)"
  type        = string
  default     = ""
}