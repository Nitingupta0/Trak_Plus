output "repository_urls" {
  value = { for k, r in aws_ecr_repository.repos : k => r.repository_url }
}

output "repository_names" {
  value = { for k, r in aws_ecr_repository.repos : k => r.name }
}

output "repository_arns" {
  value = { for k, r in aws_ecr_repository.repos : k => r.arn }
}