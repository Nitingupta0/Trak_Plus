# Remote state config for staging — fill in after bootstrap (infra/README.md).
bucket       = "trakplus-tfstate-522412052856"
key          = "staging/terraform.tfstate"
region       = "ap-south-1"
dynamodb_table = "trakplus-tfstate-lock"
encrypt      = true
