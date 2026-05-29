# PRD — SmartBrief: Audit Completion + Next.js Upgrade

*Sprint: Q2 cleanup + maintenance | Date: 2026-05-28*

---

## Goal

Close out the remaining Q2 housekeeping item, upgrade Next.js to 15/16, and land all
product documentation inside the repo.

---

## Features

### P0 — Next.js Upgrade (14 → 15/16)

**Why:** Next.js 14 will eventually lose security patches. The CI already uses Node 24.
The upgrade unblocks Turbopack stable, improves caching ergonomics, and is cheaper to do
now than after Q4 features add more surface area.

**Scope:**
- Upgrade `next` package to latest stable (15.x or 16.x)
- Fix async Request APIs: anywhere `params`, `searchParams`, `cookies()`, or `headers()` are
  used in Server Components or Route Handlers, await them (or unwrap as required by the new API)
- Remove any incorrect upgrade notes in docs (the `proxy.ts` reference is fiction)
- Update `Dockerfile` base image: `node:20-alpine` → `node:24-alpine`
- `middleware.ts` requires **no changes** — the middleware API is unchanged in Next.js 15/16

**Acceptance criteria:**
- `npm run build` succeeds with zero errors on the upgraded version
- `npm run dev` starts with no warnings about deprecated APIs
- Auth flow works: unauthenticated → `/login` redirect; valid cookie → feed loads
- `/api/news`, `/api/recap`, `/settings` all respond correctly
- No Prisma or DB regressions

### P0 — Docs Migration

**Why:** Documentation lives only in Obsidian; the repo has no product context beyond CLAUDE.md.
Stale docs also contain incorrect technical claims (proxy.ts).

**Scope — files to create in `docs/`:**
| Target file | Source | Notes |
|---|---|---|
| `docs/product.md` | SmartBrief — Product Documentation.md | Update shipped status |
| `docs/backlog.md` | SmartBrief — Backlog & Sizing.md | Mark Q2/Q3/Q4 as shipped; update open items |
| `docs/open-decisions.md` | SmartBrief — Open Decisions.md | Mark decisions that were implemented |
| `docs/qa-checklist.md` | SmartBrief — QA Release Checklist.md | Keep as-is |
| `docs/metrics.md` | SmartBrief — Metrics & Measurement Plan.md | Keep as-is |
| `docs/infrastructure.md` | SmartBrief — Docker Setup & Infrastructure Notes.md | Update Node version |
| `docs/prds/newsletter-ingestion.md` | SmartBrief — PRD Newsletter Ingestion.md | Note: webhook UI + source mgmt shipped; IMAP UI still open |
| `docs/prds/push-notifications.md` | SmartBrief — PRD Push Notifications.md | Note: fully shipped |

**Do NOT copy:**
- Competitor Landscape / MoSCoW (strategic, not operational)
- Design System (lives better as Tailwind config)
- Value Proposition (marketing, not engineering)
- Q2/Q3/Q4 Sprint Specs + Kickoff docs (superseded by shipped code)

### P1 — Performance Audit — Real Lighthouse Run

**Why:** `docs/performance-audit-q2-2026.md` exists with estimated numbers only. The Q2
sprint is not closed until real numbers are recorded.

**Scope:**
- Run `npm run perf` against a locally running production build
- Update the doc with real FCP/LCP/CLS/TBT numbers
- Confirm all four targets are met (or document any miss + remediation)

**Note:** The fixes (next/font, next/image, bundle-analyzer) are already applied. This is
a measurement task, not a fix task. If a metric misses its target, investigate and fix.

---

## Out of Scope

- IMAP configuration UI (Q4 low-priority, separate sprint)
- Lighthouse CI integration (nice-to-have, not blocking)
- Any new features
- Implicit signals — verified already shipped; nothing to build
