terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }

  # Remote state in S3 (bootstrap complete). Init with:
  # terraform init -backend-config=backend.hcl
  backend "s3" {}
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project_name" {
  type    = string
  default = "trakplus"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "db_password" {
  type      = string
  sensitive = true
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "network" {
  source       = "../../modules/network"
  project_name = var.project_name
  environment  = var.environment
}

module "ecr" {
  source       = "../../modules/ecr"
  project_name = var.project_name
  environment  = var.environment
}

module "rds" {
  source       = "../../modules/rds"
  project_name = var.project_name
  environment  = var.environment

  vpc_id                    = module.network.vpc_id
  database_subnet_ids       = module.network.database_subnet_ids
  allowed_security_group_id = module.network.security_group_ids["backend"]
  db_password               = var.db_password
}

module "elasticache" {
  source       = "../../modules/elasticache"
  project_name = var.project_name
  environment  = var.environment

  vpc_id                    = module.network.vpc_id
  private_subnet_ids        = module.network.private_subnet_ids
  allowed_security_group_id = module.network.security_group_ids["backend"]
}

module "eks" {
  source       = "../../modules/eks"
  project_name = var.project_name
  environment  = var.environment

  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}

module "iam" {
  source       = "../../modules/iam"
  project_name = var.project_name
  environment  = var.environment

  ecr_repository_arns = values(module.ecr.repository_arns)
  oidc_provider_url   = module.eks.oidc_provider_url
  oidc_provider_arn   = module.eks.oidc_provider_arn
}

module "budgets" {
  source            = "../../modules/budgets"
  project_name      = var.project_name
  environment       = var.environment
  monthly_limit_usd = 50
}

output "alb_sg_id" {
  value = module.network.security_group_ids["alb"]
}

output "backend_sg_id" {
  value = module.network.security_group_ids["backend"]
}

output "frontend_sg_id" {
  value = module.network.security_group_ids["frontend"]
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

output "redis_endpoint" {
  value = module.elasticache.endpoint
}

output "ecr_backend_url" {
  value = module.ecr.repository_urls["backend"]
}

output "ecr_frontend_url" {
  value = module.ecr.repository_urls["frontend"]
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "github_actions_role_arn" {
  value = module.iam.github_actions_role_arn
}