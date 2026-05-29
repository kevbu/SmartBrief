# SmartBrief — Backlog & Sizing

*Last updated: 2026-05-28*

---

## Sizing Key

| Size | Story Points | Engineering Days (approx) |
|------|-------------|--------------------------|
| XS | 1 | < 1 day |
| S | 2 | 1–2 days |
| M | 5 | 3–5 days |
| L | 8 | 1–2 weeks |
| XL | 13 | 2–3 weeks |

**Value score** (1–5): impact on the core user job-to-be-done.
**Effort score** (1–5): engineering complexity + risk.
**Priority score** = Value ÷ Effort.

---

## Shipped

### v1.0 — Core Launch
Multi-source RSS aggregation, Claude synthesis and bullet points, sentiment scoring, mood presets, session mode, topic tabs, source management, dark mode, PWA, Docker self-hosting.

### v1.1 — Q2 2026 Polish
Article feedback UX, source management UX, performance audit (next/font, next/image, Lighthouse baseline).

### v1.2 — Q3 2026 Recap & Learning
Weekly news-diet recap, feedback learning (source + topic weights, implicit signals), "Why am I seeing this?" reason chip, Learned Preferences UI, Learning Strength slider.

### v1.3 — Q4 2026 Notifications & Newsletters
Push notifications (VAPID, daily cap, quiet hours, history log, opt-in flow), newsletter ingestion (webhook, per-service guides, source management UI), story clustering (TopStoryCard).

### Maintenance
- Next.js 14 → 16 upgrade (async params migration, `serverExternalPackages`, node:24-alpine) — 2026-05-28

---

## Open — Unscheduled

| Item | Value | Effort | Priority | Notes |
|------|-------|--------|----------|-------|
| IMAP configuration UI | 2 | 2 | 1.0 | Backend (`imapflow`) exists; UI missing. Completes newsletter story. |
| Weekly Recap AI coaching (Haiku) | 3 | 2 | 1.5 | v2 of Recap; adds Haiku API cost/week |
| 4-week trend view in Recap | 3 | 2 | 1.5 | Needs 4 weeks of `readAt` data |
| Push end-of-day digest | 3 | 2 | 1.5 | Different UX contract from breaking news; separate user testing |
| `/admin/metrics` page | 3 | 1 | 3.0 | Surfaces SQLite queries as a table; ~1 day |
| OPML import | 2 | 2 | 1.0 | Power-user; low reach |
| PWA offline mode | 3 | 4 | 0.75 | Service Worker complexity |
| Dark mode polish | 2 | 2 | 1.0 | Address in a future polish sprint |

---

## Risks & Flags

| Risk | Severity | Status |
|------|----------|--------|
| IMAP credentials stored in plaintext SQLite | Medium | Document limitation clearly in IMAP UI when built; consider encryption |
| Push VAPID key rotation invalidates all subscriptions | Low | Handle gracefully with settings banner; documented in infrastructure.md |
| `preference_weight` default (0.3) may need tuning | Low | Exposed in UI as Learning Strength slider — user can adjust |
