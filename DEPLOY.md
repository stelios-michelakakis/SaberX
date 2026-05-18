# Deployment guide

This is the recipe for running EDF SABER on a single Ubuntu VM (22.04, 24.04, 26.04) behind Caddy with automatic TLS. It uses the bundled Docker Compose stack as-is plus a thin production override.

```
                    ┌──────────────────────────────────────────┐
   Internet ──443──▶│  Caddy (TLS, auto Let's Encrypt)         │
                    └──────────────┬───────────────────────────┘
                                   │  reverse-proxies → localhost:3000
                    ┌──────────────▼───────────────────────────┐
                    │  docker compose:                          │
                    │   ├─ web      (next start, :3000 / loop)  │
                    │   ├─ worker   (npm run worker)            │
                    │   └─ postgres (docker-net only, no :5432) │
                    └───────────────────────────────────────────┘
```

## 1. VM prep

```bash
sudo apt update && sudo apt -y full-upgrade
sudo apt -y install docker.io docker-compose-v2 git ufw

# Allow your user to run docker without sudo
sudo usermod -aG docker $USER
newgrp docker  # or log out / back in

# Firewall: SSH + HTTP (for Let's Encrypt's HTTP-01 challenge) + HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable

# Caddy from the official Cloudsmith repo
sudo apt -y install debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt -y install caddy
```

## 2. Clone + configure

```bash
sudo mkdir -p /opt/edf-saber && sudo chown $USER /opt/edf-saber
cd /opt/edf-saber
git clone https://github.com/stelios-michelakakis/SaberX.git .
```

Create `/opt/edf-saber/.env` (do **not** commit it):

```bash
cat > .env <<EOF
POSTGRES_USER=edfsaber
POSTGRES_PASSWORD=$(openssl rand -hex 16)
POSTGRES_DB=edfsaber
INVITATION_SECRET=$(openssl rand -hex 32)
APP_ORIGIN=https://your-domain.example.com
SESSION_COOKIE_NAME=edfsaber_session
EOF
chmod 600 .env
```

Edit `APP_ORIGIN` to the real public URL. The other values are random and you don't need to remember them.

## 3. Bring the stack up

The production override [`docker-compose.prod.yml`](docker-compose.prod.yml) layers on top of `docker-compose.yml`:

```bash
cd /opt/edf-saber
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres

# Apply migrations and seed the bootstrap admin (one-off).
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm web npm run db:migrate
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm web npm run db:seed

# Start the rest of the stack.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d web worker
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Tip: alias the long invocation. Put this in `/opt/edf-saber/.envrc` or your shell rc:

```bash
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
# then: dc ps, dc logs -f web, dc up -d, etc.
```

## 4. Caddy + TLS

Copy the example reverse-proxy config:

```bash
sudo cp /opt/edf-saber/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo sed -i 's/YOUR_DOMAIN/your-domain.example.com/' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy issues and renews Let's Encrypt certificates automatically once the DNS A record for `your-domain.example.com` points at the VM. Test:

```bash
curl -I https://your-domain.example.com
# expect: HTTP/2 200, strict-transport-security header, etc.
```

## 5. First login → harden

1. Open the URL, sign in as `admin / admin`.
2. The forced-change flow makes you set a real password before reaching the dashboard.
3. Profile → API tokens — only mint tokens when an agent actually needs one. Treat them like passwords; revoke immediately if leaked.
4. Optional but recommended: replace the seed `admin` username with one of your own from the **Admin** page and disable the original.

## 6. Backups

Two volumes hold persistent state:

- **`postgres_data`** — the database (all repository metadata, audit log, search index, etc.). [`deploy/backup.sh`](deploy/backup.sh) streams a `pg_dump` to `/var/backups/edfsaber/` with 7-day rotation.
- **`source_files`** — uploaded source documents (PDF/DOCX/MD/TXT). Files are content-addressed under `/app/var/sources/<aa>/<bb>/<sha256>.<ext>`. The DB has metadata rows in `sources` that reference these files; if you back up Postgres without the volume, those references dangle.

```bash
sudo crontab -e
# Nightly at 02:30
30 2 * * * /opt/edf-saber/deploy/backup.sh >> /var/log/edfsaber-backup.log 2>&1
```

Test it manually first:

```bash
sudo /opt/edf-saber/deploy/backup.sh
ls -lh /var/backups/edfsaber
```

For the source files volume, snapshot it alongside the SQL dump — a tar of the mount point is fine:

```bash
docker run --rm -v edf-saber_source_files:/data -v /var/backups/edfsaber:/out \
  alpine tar czf /out/sources-$(date +%F).tgz -C /data .
```

(The compose project name prefix may differ — `docker volume ls | grep source_files` to confirm.)

Periodically `scp` the dumps + the source tarball off-box (or rclone them to S3/B2). **A backup you've never restored isn't a backup** — practise restoring at least once:

```bash
zcat /var/backups/edfsaber/edfsaber-YYYY-MM-DD-HHMM.sql.gz \
  | docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
      psql -U edfsaber edfsaber
```

## 7. Updates

```bash
cd /opt/edf-saber
git pull origin main
dc build
dc run --rm web npm run db:migrate    # picks up any new migrations
dc up -d web worker                   # rolls the app containers; postgres untouched
dc logs --tail 100 -f web             # confirm clean boot
```

If a deploy goes bad: `git checkout <previous-commit> && dc build && dc up -d`. Database rollback is harder — that's why we keep the dumps.

## 8. Operations cheatsheet

| | |
|---|---|
| Status | `dc ps` |
| Logs | `dc logs --tail 200 -f web worker` |
| Restart one service | `dc restart web` |
| Connect to Postgres | `dc exec postgres psql -U edfsaber edfsaber` |
| Disk usage of the DB volume | `docker system df -v \| grep postgres_data` |
| Caddy logs | `journalctl -u caddy -f` or `tail -f /var/log/caddy/edfsaber.access.log` |
| Reload Caddy after config edit | `sudo systemctl reload caddy` |

## 9. Pre-flight checklist

Before sharing the URL:

- [ ] `INVITATION_SECRET` is a real 32-byte random value (not the example placeholder)
- [ ] `POSTGRES_PASSWORD` is unique and strong (not the literal `edfsaber`)
- [ ] Bootstrap admin password has been changed
- [ ] `dc ps` does **not** show `0.0.0.0:5432` anywhere — Postgres must be docker-net-only
- [ ] `dc ps` shows web bound to `127.0.0.1:3000`, not `0.0.0.0:3000`
- [ ] `APP_ORIGIN` matches the public URL exactly (invitation links use it)
- [ ] UFW allows only 22, 80, 443 (`sudo ufw status`)
- [ ] Backup cron runs successfully and you've test-restored at least one dump
- [ ] Consider `sudo apt install unattended-upgrades` for kernel/security patches

## 10. Common gotchas

- **`!reset` / `!override` syntax errors** in `docker-compose.prod.yml` mean Docker Compose is older than 2.24. Either `sudo apt install docker-compose-v2` or use a slim alternative override that just sets environment vars and accepts the default `ports:` mapping (then keep Postgres firewalled at the host level).
- **Caddy TLS errors** — port 80 must reach the VM during the HTTP-01 challenge. If you're behind a load balancer, use the `DNS-01` provider instead and configure Caddy accordingly.
- **`db:seed` fails the second time** — the bootstrap user is unique; the seed is intended to run exactly once.
- **Migration order** — always run `dc run --rm web npm run db:migrate` *after* `dc pull` / `dc build` and *before* `dc up -d`. If you skip and the new code uses a column that doesn't exist yet, the app crashes on boot.
- **Cookie sessions invalidated after a redeploy** — only happens if you change `SESSION_COOKIE_NAME`. Pick one at install time and don't touch it.
