# Deploying TrakPlus to an Azure VM

Live: **https://trak-plus.lucifer07o.tech** — one Ubuntu VM running the same Docker Compose stack as the Lightsail path (`deploy/`), behind Caddy (automatic Let's Encrypt TLS). The VM is **deallocated between demos** to keep cost near zero (see [Cost & routine](#cost--routine)).

## Architecture

```
Browser ──HTTPS──► Caddy (80/443) ─┬─ /api/bff/*, /api/auth/* ─► frontend (Next.js :3000)
                                   ├─ /api/*  (prefix stripped) ─► backend (FastAPI :8000)
                                   └─ /*                        ─► frontend
                      backend ──► postgres (volume) · redis        (internal network only)
```

Only Caddy publishes ports. The NSG allows inbound 22, 80, 443 only.

## One-time setup

1. **VM** (Azure portal or `az`): Ubuntu Server 24.04 LTS, `Standard_B2s` (2 vCPU / 4 GB), ~64 GB Standard SSD, **Standard SKU static public IP**, SSH (22) open. Resource group `trakplus-rg`.
   ```bash
   az group create -n trakplus-rg -l <region>
   az vm create -g trakplus-rg -n trakplus-vm --image Ubuntu2404 --size Standard_B2s \
     --admin-username azureuser --generate-ssh-keys \
     --public-ip-sku Standard --public-ip-address-allocation static --os-disk-size-gb 64
   az vm open-port -g trakplus-rg -n trakplus-vm --port 80  --priority 1010
   az vm open-port -g trakplus-rg -n trakplus-vm --port 443 --priority 1020
   ```
2. **DNS**: one `A` record for the site hostname → the VM's static IP (TTL 300). Check: `nslookup <host>`. Caddy needs port 80 reachable to complete the HTTP-01 challenge.
3. **Docker + swap** (the Next.js build needs more than the free RAM on 4 GB):
   ```bash
   curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER   # re-login after
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
4. **Code + config** (Compose ≥ 2.24 required for `!reset`):
   ```bash
   git clone https://github.com/nitingupta0/trak_plus.git && cd trak_plus
   cp deploy/.env.lightsail.example deploy/.env.lightsail && chmod 600 deploy/.env.lightsail
   ```
   Fill in `deploy/.env.lightsail` — never commit it:
   | Var | Value |
   |---|---|
   | `CADDY_SITE_ADDRESS` | site hostname, no scheme (e.g. `trak-plus.example.tech`) |
   | `CORS_ORIGINS` | `'["https://<hostname>"]'` |
   | `POSTGRES_PASSWORD` | `openssl rand -hex 16` |
   | `JWT_SECRET_KEY` | `openssl rand -hex 32` — **required**, compose refuses to start without it |
   | `TMDB_API_KEY`, `RAWG_API_KEY` | free keys; anime/manga need none |
   | `NEXT_PUBLIC_API_URL` | `/api` (baked into the frontend at build time) |
   | Google client IDs | optional; leave empty to use email/password login only |
5. **Start**:
   ```bash
   docker compose -f docker-compose.yml -f deploy/docker-compose.lightsail.yml \
     --env-file deploy/.env.lightsail up -d --build
   ```
   Verify: `docker compose ... ps` (only Caddy shows published ports), `curl https://<host>/health` → `"environment":"production"`.

Optional convenience alias on the VM: `alias tp='cd ~/trak_plus && docker compose -f docker-compose.yml -f deploy/docker-compose.lightsail.yml --env-file deploy/.env.lightsail'` → `tp ps`, `tp logs -f backend`, `tp up -d --build`.

## Cost & routine

- **Day before an interview:** start the VM (`az vm start -g trakplus-rg -n trakplus-vm`), wait ~3 min, open the site, run the demo flow once. Containers restart on boot (`restart: unless-stopped`); the TLS cert and DB live in Docker volumes; the static IP keeps DNS valid.
- **Afterwards:** `az vm deallocate -g trakplus-rg -n trakplus-vm` (status must read *Stopped (deallocated)*; an OS-level shutdown still bills compute). Idle cost = disk + static IP only.
- Set an Azure Cost Management budget alert; delete `trakplus-rg` to remove everything.

## Operations

| Task | Command |
|---|---|
| Update after a code change | `git pull && tp up -d --build` |
| Apply `.env.lightsail` changes | `tp up -d` |
| Logs | `tp logs -f backend` |
| DB backup | `tp exec postgres pg_dump -U trakplus trakplus > backup_$(date +%F).sql` |
| Stop (keeps data) | `tp down` — never add `-v` (deletes the DB volume) |

## Lessons / gotchas

- **SSH source restriction by IP is brittle** on campus/ISP networks (multiple egress IPs, IPv6 vs IPv4). The demo itself only needs 80/443; SSH is left open with a strong password + fail2ban.
- **`NEXT_PUBLIC_*` values are build-time.** Changing `NEXT_PUBLIC_API_URL` or the Google client ID requires `tp up -d --build`.
- **`ports: []` does not remove base-file ports in Compose** — the override uses `!reset []` so Postgres/Redis/backend/frontend are not published on the host.
- **`JWT_SECRET_KEY` has an insecure public default in `app/core/config.py`.** The compose override now requires it to be set explicitly.
- Google sign-in needs a real HTTPS domain added to the OAuth client's *Authorized JavaScript origins*; it is optional (email/password works without it).
