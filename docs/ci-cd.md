# CI/CD Pipeline

## Overview

Automated deployment pipeline: **Push to GitHub → CI tests → ECR push → Lightsail auto-deploy**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Push to    │────▶│  GitHub     │────▶│    ECR      │────▶│  Lightsail  │
│  GitHub     │     │  Actions    │     │  (images)   │     │  (deploy)   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │                                       │
                           │ Build & push images                   │ Poll every 5min
                           │ Tag: git SHA + latest                 │ Pull new images
                           │                                       │ Restart stack
```

## GitHub Actions Workflow (`.github/workflows/ci.yml`)

### Jobs (run on every push/PR)

| Job | Purpose | When |
|-----|---------|------|
| `backend-lint` | Ruff check + format | Every push |
| `backend-migrations` | Alembic upgrade/downgrade/check | Every push |
| `backend-test` | pytest with coverage ≥80% | Every push |
| `backend-docker` | Build image + smoke test | Every push |
| `frontend-lint` | ESLint + TypeScript check | Every push |
| `frontend-test` | Vitest component tests | Every push |
| `frontend-build` | Next.js production build | Every push |
| `frontend-docker` | Build image + smoke test | Every push |
| `infra` | Terraform fmt + validate | Every push |
| `security` | Gitleaks + audits + lint | Every push |
| `e2e` | Playwright full user journey | Every push |

### Deploy Jobs (main branch only)

| Job | Purpose | Trigger |
|-----|---------|---------|
| `push-images` | Build & push to ECR | Push to main after tests pass |
| `deploy-staging` | Deploy to EKS staging | If `EKS_DEPLOY_ENABLED=true` |
| `deploy-prod` | Deploy to EKS prod | If `EKS_DEPLOY_ENABLED=true` + approval |

## Lightsail Auto-Deploy

### How It Works

1. **GitHub Actions** pushes Docker images to ECR on every push to `main`
2. Images are tagged with git SHA (e.g., `trakplus-backend:abc1234`) and `latest`
3. **Lightsail** runs `auto-deploy.sh` via cron every 5 minutes
4. Script checks ECR for the latest image tag
5. If tag differs from currently deployed tag → pull images, restart stack
6. If same → do nothing

### Setup (One-Time)

#### 1. Create ECR Repositories

```bash
aws ecr create-repository --repository-name trakplus-backend --region ap-south-1
aws ecr create-repository --repository-name trakplus-frontend --region ap-south-1
```

#### 2. Configure GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `AWS_DEPLOY_ROLE_ARN` | IAM role ARN for OIDC (see below) |
| `AWS_REGION` | `ap-south-1` |
| `ECR_BACKEND_URL` | `123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-backend` |
| `ECR_FRONTEND_URL` | `123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-frontend` |
| `LIGHTSAIL_DEPLOY_WEBHOOK` | *(optional)* URL to trigger instant deploy |

#### 3. Create IAM Role for GitHub Actions OIDC

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:NobleChicken97/trakPlus:*"
        }
      }
    }
  ]
}
```

Attach policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

#### 4. Configure Lightsail

SSH into the Lightsail instance and run:

```bash
# Install AWS CLI v2 (if not present)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure credentials (IAM user with ECR read-only access)
aws configure
# AWS Access Key ID: <from IAM user>
# AWS Secret Access Key: <from IAM user>
# Default region: ap-south-1

# Create deploy user policy (ECR read-only)
aws iam create-policy --policy-name LightsailECRReadOnly --policy-document '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ecr:GetAuthorizationToken",
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:DescribeImages"
    ],
    "Resource": "*"
  }]
}'

# Clone repo (if not present)
cd /opt/trakplus

# Set permissions
chmod +x deploy/auto-deploy.sh

# Add cron job (poll every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/trakplus/deploy/auto-deploy.sh >> /var/log/trakplus-deploy.log 2>&1") | crontab -

# Create log file
sudo touch /var/log/trakplus-deploy.log
sudo chown ubuntu:ubuntu /var/log/trakplus-deploy.log

# Initial deploy (pull latest from ECR)
ECR_BACKEND_URL=123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-backend \
ECR_FRONTEND_URL=123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-frontend \
./deploy/auto-deploy.sh
```

#### 5. Update `.env.lightsail`

Ensure `deploy/.env.lightsail` has:
```bash
ECR_BACKEND_URL=123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-backend
ECR_FRONTEND_URL=123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-frontend
```

## Rollback

To rollback to a previous version:

```bash
# On Lightsail
cd /opt/trakplus
echo "previous-git-sha" > .deployed_tag
ECR_BACKEND_URL=... ECR_FRONTEND_URL=... ./deploy/auto-deploy.sh
```

## Monitoring

```bash
# Check deploy logs
tail -f /var/log/trakplus-deploy.log

# Check currently deployed tag
cat /opt/trakplus/.deployed_tag

# Check cron is running
crontab -l
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Images not pushing | Check `AWS_DEPLOY_ROLE_ARN` secret and IAM permissions |
| Lightsail not deploying | Check `/var/log/trakplus-deploy.log` for errors |
| Health check failed | App rolled back automatically; check `docker compose logs` |
| ECR login expired | Auto-deploy script re-logs in on each run |
