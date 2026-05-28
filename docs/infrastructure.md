# SmartBrief — Infrastructure Notes

*Last updated: 2026-05-28*

---

## Current Setup

**Services in `docker-compose.yml`:**
- `app` — Next.js 16 app (serves frontend + API routes)

**Environment variables required:**

```
ANTHROPIC_API_KEY=          # Required — Claude Haiku + Sonnet
SMARTBRIEF_PASSWORD=        # Required — cookie-based login (checked in src/middleware.ts)
DATABASE_URL=               # Required — path to SQLite file, e.g. file:/data/smartbrief.db
NEXT_PUBLIC_APP_URL=        # Required — e.g. https://news.yourdomain.com
```

> **Note:** `SMARTBRIEF_PASSWORD` is the correct env var name. If unset, the app runs without auth (local dev only).

**Ports exposed:**
- `3000` — Next.js app (proxied via Nginx Proxy Manager for HTTPS)

**Database:**
- SQLite file bind-mounted into the container
- Managed via Prisma (`prisma db push` runs automatically at container start)
- Build step runs `prisma generate` automatically

**One-command start:**
```bash
docker compose up -d
```

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
| GitHub Actions CI | Node 24 |
| Local dev | Node 24 recommended |

---

## Volume & Data Notes

All persistent data lives in a single bind-mounted SQLite file. This includes: articles, user preferences, feedback, push subscriptions, VAPID keys, IMAP poll timestamps, and app state.

**Backup strategy (recommendation):**
```bash
# Example cron (host machine) — daily backup at 3am
0 3 * * * cp /path/to/data/smartbrief.db /path/to/backups/smartbrief-$(date +\%Y\%m\%d).db
```
