# Production deploy runbook (VPS)

Manual `git pull` deploy for the Delphic stack.

- **Host path:** `/opt/delphic`
- **Runner:** `./start-delphic.sh --prod` (Docker Compose, both files, service name `server`)
- **Migrations:** `prisma migrate deploy` runs automatically on every `server` container start.
- **Seeding:** never automatic — see [PRODUCTION-SEED.md](PRODUCTION-SEED.md).

```bash
cd /opt/delphic
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
```

---

## 1. Backup the database (always, before pulling)

```bash
cd /opt/delphic

# Custom-format dump — restorable via start-delphic --restore=<file> / pg_restore
dc exec -T db pg_dump -U postgres -Fc requirement_dashboard > ~/backup-$(date +%F-%H%M).dump

# (Alternative) plain gzipped SQL
dc exec -T db pg_dump -U postgres requirement_dashboard | gzip > ~/delphic-$(date +%F-%H%M).sql.gz

ls -lh ~/backup-*.dump ~/delphic-*.sql.gz 2>/dev/null | tail -3
```

---

## 2. Pull and deploy

```bash
cd /opt/delphic
git pull origin main
./start-delphic.sh --prod          # == dc up -d --build
```

---

## 3. Verify

```bash
cd /opt/delphic

# container health
dc ps

# API health from inside the server container
dc exec server node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" && echo "API OK"

# tail logs if something looks off
dc logs --tail=100 server
dc logs --tail=100 client
```

---

## 4. Rollback

### Code only (no DB change in the bad release)

```bash
cd /opt/delphic
git log --oneline -5
git checkout <previous-good-sha>
./start-delphic.sh --prod
```

### Database restore (bad migration / data loss)

```bash
cd /opt/delphic
./start-delphic.sh --prod --restore=$HOME/backup-<YYYY-MM-DD-HHMM>.dump

# manual equivalent
gunzip -c ~/delphic-<YYYY-MM-DD-HHMM>.sql.gz | dc exec -T db psql -U postgres requirement_dashboard
```

---

## Notes

- Frontend-only commits (e.g. React pages under `client/src/`) still need `--build`
  because the built assets are baked into the `client` image; no seed or migration step.
- Required prod env vars (no defaults): `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`,
  `JWT_REFRESH_SECRET`, `CORS_ORIGIN`. Generate secrets: `openssl rand -hex 32`.
- Loopback binds in prod: API `127.0.0.1:4000`, client `127.0.0.1:8081` (nginx fronts them).
