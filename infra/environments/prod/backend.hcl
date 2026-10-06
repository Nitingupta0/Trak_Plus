# Remote state config for prod — fill in after bootstrap (infra/README.md).
bucket       = "trakplus-tfstate-522412052856"
key          = "prod/terraform.tfstate"
region       = "ap-south-1"
dynamodb_table = "trakplus-tfstate-lock"
encrypt      = true
