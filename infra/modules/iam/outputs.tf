output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}

output "eks_pod_execution_role_arn" {
  value = aws_iam_role.eks_pod_execution.arn
}