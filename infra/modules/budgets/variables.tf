variable "project_name" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "monthly_limit_usd" {
  description = "Monthly budget limit in USD"
  type        = number
  default     = 50
}

variable "email_recipients" {
  description = "Email addresses to alert when the budget is exceeded"
  type        = list(string)
  default     = []
}