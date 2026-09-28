# TrakPlus infrastructure

Terraform modules and environment configurations. Modules are **skeletons** for Phase 0 —
they get real resources in Phase 6 (see `docs/plan.md`).

## Structure

```
infra/
  versions.tf              # terraform + aws provider version pins
  main.tf                  # root provider config (default tags)
  variables.tf             # shared variables
  backend.tf               # S3 remote state backend — ENABLE AFTER BOOTSTRAP (see below)
  environments/
    staging/               # staging wiring + tfvars + backend.hcl
    prod/                  # prod wiring + tfvars + backend.hcl
  modules/
    network/ eks/ rds/ elasticache/ ecr/ iam/
```

## Local verification (no AWS needed)

```bash
cd infra
terraform init        # resolves providers, writes .terraform.lock.hcl (gitignored — see below)
terraform validate
```

Each environment can also be validated:

```bash
cd environments/staging
terraform init
terraform validate
```

> **Why `.terraform.lock.hcl` is not committed (skeleton phase):** a lock file
> generated on Windows contains only `windows_amd64` provider hashes, so
> `terraform init` on the Linux CI runner fails checksum verification. CI
> regenerates the lock per run. When the infrastructure becomes real (Phase 6),
> commit the lock after generating it for every platform:
>
> ```bash
> terraform providers lock -platform=windows_amd64 -platform=linux_amd64 -platform=linux_arm64
> ```

## Remote state bootstrap (one-time, requires AWS credentials)

1. Create the state bucket and lock table (names must be globally unique):

```bash
aws s3api create-bucket \
  --bucket trakplus-tfstate-<account-id> \
  --region <aws-region> \
  --create-bucket-configuration LocationConstraint=<aws-region>

aws s3api put-bucket-versioning \
  --bucket trakplus-tfstate-<account-id> \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name trakplus-tfstate-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region <aws-region>
```

2. Fill in `environments/<env>/backend.hcl` (bucket name, region).
3. Uncomment the `terraform { backend "s3" {} }` block in `backend.tf` (root) — for env dirs
   the backend block is already present in their `main.tf` and reads `backend.hcl`.
4. Re-run `terraform init -backend-config=backend.hcl` (env dirs) or `terraform init` (root).
   State now lives in S3 with a DynamoDB lock.

Phase 0 passing criteria (`docs/todos.md`) requires step 1–4 to be done once with real AWS
credentials — that part is **blocked on the user's AWS account**, everything else is verifiable
locally.
