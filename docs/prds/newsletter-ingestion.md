# PRD — Newsletter Ingestion

*Status: **Partially shipped** (v1.3, 2026) | Owner: PM Agent | Last updated: 2026-05-28*

---

## Status

Backend pipeline and setup/source management UI are shipped. IMAP configuration UI is still open.

| Component | Status | Location |
|-----------|--------|----------|
| Webhook endpoint | ✅ Shipped | `POST /api/ingest/newsletter` |
| Email parser | ✅ Shipped | `src/lib/newsletter-parser.ts` |
| Article creation + deduplication | ✅ Shipped | Same route |
| IMAP polling (secondary path) | ✅ Shipped | `/api/ingest/newsletter/imap/` |
| `NEWSLETTER_INGEST_SECRET` auth | ✅ Shipped | Env var gate in route |
| Webhook setup UI + per-service guides | ✅ Shipped | Settings → Sources → Newsletters |
| Newsletter source management UI | ✅ Shipped | Settings → Sources → Newsletters |
| **IMAP configuration UI** | ❌ Open | Backend exists; frontend missing |

---

## Architecture

The pipeline uses a **webhook endpoint** — no Docker SMTP service, no MX records, no port exposure needed.

**Webhook accepts:** JSON or multipart form-data from Mailgun, SendGrid Inbound Parse, n8n, Zapier, Make. Fields: `from`, `subject`, `html`/`text`, optional `date`.

**Authentication:** `X-Ingest-Secret` header (preferred) or `secret` body/query field must match `NEWSLETTER_INGEST_SECRET` env var. If the env var is unset, endpoint returns 501.

**IMAP alternative:** Direct mailbox polling via `imapflow`. Credentials stored in `AppState` DB record.

---

## Remaining Work — IMAP Configuration UI

The only unshipped item is the IMAP settings UI. The backend (`/api/ingest/newsletter/imap/`) is fully functional.

### User flow (Path B)
```
Settings → Sources → Newsletters → IMAP Setup
  ↓
User enters: IMAP host, port, username, password, target mailbox/folder
  ↓
App polls the mailbox on the standard ingest schedule
  ↓
New emails in the target folder are parsed and ingested as articles
```

### Acceptance criteria
- [ ] IMAP credentials form in Settings → Sources → Newsletters → IMAP Setup
- [ ] Credentials stored in `AppState` (document plaintext-in-SQLite limitation clearly in UI)
- [ ] "Test connection" button validates credentials without ingesting articles
- [ ] Polling status shown: last polled time, articles ingested in last poll

### Open question
Should `NEWSLETTER_INGEST_SECRET` be auto-generated on first run (stored in `AppState` alongside VAPID keys) rather than requiring manual env var setup?

---

## Sizing (remaining)

| Item | Size | Notes |
|------|------|-------|
| IMAP configuration UI | M | Requires frontend ↔ IMAP route integration |

---

## Out of Scope

- Custom SMTP listener (webhook approach is superior)
- OAuth integrations with Substack/Beehiiv (v2)
- PDF newsletter parsing (v2)
