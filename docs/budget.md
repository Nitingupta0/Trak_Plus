# TrakPlus — Budget

> **Version:** 2.0 (revised) · **Date:** 2026-09-01
> **Supersedes:** §9 of `report.md` (Budget A / Budget B)
> **Companion docs:** [`README.md`](../README.md) · [`docs/prod.md`](prod.md) · [`docs/design.md`](design.md) · [`docs/plan.md`](plan.md)

---

## 1. Summary

| | |
|---|---|
| **Active plan** | Single Lightsail instance running the existing Docker Compose stack |
| **Monthly cost** | **~$12–13.50** |
| **Funded by** | AWS $200 credit (expires Jan 2027) |
| **Cost after credit expires** | Well inside the $10–20/mo you can sustainably spare |
| **EKS/Terraform (Budget A)** | Kept as portfolio code, `terraform destroy`-ed, re-applied only for demos |

This revises Budget B in `report.md` (EC2 t4g.small, ~$21–27/mo) after two issues surfaced: it sat at or above the $10–20/mo sustainable ceiling, and t4g is ARM while the GitHub Actions runners (`ubuntu-latest`) build x86 images — a multi-arch build problem not worth taking on this close to other deadlines.

---

## 2. Why Lightsail over EC2

| | EC2 t4g.small (previous) | Lightsail Small (revised) |
|---|---|---|
| vCPU / RAM | 2 / 2GB, **ARM** | 2 / 2GB, **x86** |
| Storage | 20GB EBS — billed separately | 60GB SSD — bundled |
| Data transfer | ~20–40GB — billed separately | 1.5TB — bundled |
| Static IP | Elastic IP, free only while attached | Free while attached |
| Matches CI build arch? | No — needs `buildx` multi-arch | Yes |
| Base price | ~$16 + extras | **$12 flat** |
| Realistic total | ~$21–27/mo | **~$12–13/mo** |

Everything else from Budget B is unchanged: same Docker Compose stack, Postgres + Redis self-hosted on the box (no RDS/ElastiCache), EKS/Terraform code untouched as portfolio artifact.

---

## 3. Line-item budget — active plan

| Line | Resource | Monthly | Notes |
|---|---|---|---|---|
| 1 | Lightsail Small (2 vCPU, 2GB, 60GB SSD, 1.5TB transfer) | **$12.00** | Runs backend + frontend + Postgres + Redis, all in Compose ($12 flat, not $24 EC2) |
| 2 | Static IP | $0.00 | Free while attached to a running instance |
| 3 | Domain (optional) | $0–1.00 | Only if a custom domain is added for demos; free subdomain otherwise |
| 4 | ECR image storage (optional) | $0–0.50 | Can be skipped entirely — build/deploy directly on the box via SSH instead |
| | **Total** | **~$12.00–13.50** | |

---

## 4. Where the money is NOT going (vs. Budget A / EKS)

| Removed | Was costing | Why |
|---|---|---|
| EKS control plane | ~$73/mo | Flat fee just to exist — unneeded for a handful of users |
| NAT Gateway | ~$38/mo | Instance gets a public IP directly |
| RDS Postgres | ~$12–15/mo | Runs in Docker on the same box |
| ElastiCache Redis | ~$13/mo | Runs in Docker on the same box |
| ALB + LCUs | ~$18–22/mo | No load balancer needed for one instance |
| EBS + IPv4 + transfer as separate line items | ~$4–8/mo | Bundled into the Lightsail flat rate |
| **Total avoided** | **~$160–170/mo** | Same app, same features |

---

## 5. Credits

| Credit | Amount | Expires | Use |
|---|---|---|---|
| AWS | $200 | Jan 2027 | Covers Lightsail bill in full — at ~$12–13/mo this lasts past expiry, so no out-of-pocket spend expected before then |
| MongoDB Atlas | $50 | — | **Held in reserve, not used here.** Postgres is already the right self-hosted choice for TrakPlus. Relevant later only for a project needing Atlas Vector Search (e.g. the semantic-caching-proxy project), not this one |

---

## 6. Post-credit sustainability

| Scenario | Monthly | Fits $10–20/mo budget? |
|---|---|---|
| This plan (Lightsail Small) | ~$12–13.50 | Yes, with room to spare |
| Previous plan (EC2 t4g.small) | ~$21–27 | No — at or past the ceiling |
| ~100 active users | ~$25–35 | Would need managed RDS/ElastiCache, revisit then |
| ~1000+ users | ~$150+ | Re-apply the existing EKS/Terraform code (Budget A) |

---

## 7. Guardrails

- AWS Budgets alarm at 80% / 100% of a $20/mo threshold — emails before any surprise.
- ECR lifecycle policy (if ECR is used): keep 10 tagged images, purge untagged after 30 days.
- EKS (Budget A) stays `terraform destroy`-ed between demos — ~$0/mo while idle.
- Nightly `pg_dump` to cheap object storage as a backup, since a single instance is a single point of failure (acceptable at this scale, per `report.md` §10).

---

## 8. Current status & next action

**Status (2026-09-01):** Lightsail Small `trakplus` is provisioned and LIVE at **https://trakplus.noblechicken.me** (Caddy TLS via Let's Encrypt). Google sign-in + search verified. Monthly cost ~$12, covered by the AWS credit.

**Update (2026-10-02):** the app is now also deployed to an **Azure VM** (`Standard_B2s`, static IP) at **https://trak-plus.lucifer07o.tech**, started before demos and deallocated afterwards (idle cost ≈ disk + static IP). See [`azure-deployment.md`](azure-deployment.md). The Lightsail figures above describe the original AWS plan.

**Next:** (a) wire `deploy/backup.sh` to run nightly on the box (pg_dump → S3); (b) confirm the AWS Budgets alarm is active for the Lightsail account; (c) review the first full month bill against this plan.
