# SmartBrief — Infrastructure Notes

*Last updated: 2026-11-17*

---

## Current Setup

SmartBrief runs locally on macOS as the launchd agent `com.kevbu.smartbrief` (`~/Library/LaunchAgents/com.kevbu.smartbrief.plist`). The agent runs `next start -p 3000` on a production build in the main checkout. Logs go to `~/Library/Logs/smartbrief.log`. The former VPS / Docker / Watchtower deploy is retired. `Dockerfile` and `docker-compose.yml` remain for manual container builds only.

**Deploy:** after merging to `main`, run `npm run deploy:local` (`scripts/deploy-local.sh`). It backs up the DB, pulls `main`, runs `npm ci` / `prisma db push` only when needed, builds, restarts the agent and checks the server responds.

**Environment variables** (in `.env` / `.env.local` of the main checkout):

```
ANTHROPIC_API_KEY=          # Optional — Claude Haiku + Sonnet; features degrade gracefully without it
SMARTBRIEF_PASSWORD=        # Optional — cookie-based login (checked in src/proxy.ts); unset = no auth
DATABASE_URL=               # Required — file:/Users/<you>/Library/Application Support/smartbrief/smartbrief.db
```

**Port:** `3000` on localhost.

**Database:**
- SQLite file outside the checkout: `~/Library/Application Support/smartbrief/smartbrief.db`
- Move an existing `prisma/dev.db` there once with `scripts/migrate-db-location.sh` (`--dry-run` first)
- Managed via Prisma. `deploy-local.sh` runs `prisma db push` only when `prisma/schema.prisma` changed

---

## Newsletter Ingestion

The newsletter pipeline uses a **webhook endpoint** — no new Docker service, no MX records, no SMTP ports needed.

**New environment variable:**
```
NEWSLETTER_INGEST_SECRET=   # Optional — enables newsletter ingestion webhook
                             # Generate: openssl rand -base64 32
                             # If unset, endpoint returns 501 (feature disabled)
```

**How it works:** Users configure an external email routing service (Mailgun, SendGrid, n8n, Zapier, Make) to forward newsletter emails as HTTP POST to:
```
POST https://[your-domain]/api/ingest/newsletter
X-Ingest-Secret: [NEWSLETTER_INGEST_SECRET]
```

**IMAP alternative:** The app also supports direct IMAP inbox polling (`imapflow`). Credentials are stored in the `AppState` DB record, configured via the Settings UI (when IMAP UI is built).

---

## Push Notifications

All push infrastructure is built. VAPID keys are auto-generated on first run and stored in the `AppState` DB record (not env vars).

**Key rotation warning:** Resetting the DB or regenerating VAPID keys invalidates all existing push subscriptions. Users must re-enable notifications. Handle gracefully with a settings banner.

**No new ports required.** Push delivery is outbound HTTPS from the app container to browser push endpoints. Ensure outbound port 443 is open.

---

## Auth Proxy

`src/proxy.ts` handles cookie-based auth for all routes. Next.js 16 renamed `middleware.ts` → `proxy.ts` and the exported function from `middleware` → `proxy`. The logic is unchanged — cookie check, redirect to `/login` if unauthenticated, allow public paths through.

---

## Node.js Version

| Context | Version |
|---------|---------|
| Dockerfile (`FROM`) | `node:24-alpine` |
| Local dev | Node 24 recommended |

---

## Data & Backups

All persistent data lives in the single SQLite file. This includes: articles, user preferences, learned weights, feedback, saved items, push subscriptions, VAPID keys, IMAP poll timestamps, and app state.

**Backups:** `deploy-local.sh` writes a consistent `sqlite3 .backup` copy to `~/Library/Application Support/smartbrief/backups/` before every deploy and keeps the newest 10 (`SMARTBRIEF_BACKUP_KEEP`). For backups between deploys, run the same command manually:

```bash
sqlite3 "$HOME/Library/Application Support/smartbrief/smartbrief.db" ".backup '$HOME/Library/Application Support/smartbrief/backups/manual-$(date +%Y%m%d-%H%M%S).db'"
```
