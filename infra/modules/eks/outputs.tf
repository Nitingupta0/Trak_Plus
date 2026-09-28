output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.main.endpoint
}

output "cluster_ca_certificate" {
  value = aws_eks_cluster.main.certificate_authority[0].data
}

output "node_group_name" {
  value = aws_eks_node_group.main.node_group_name
}

output "oidc_provider_url" {
  value = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

output "oidc_provider_arn" {
  value = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}"
}