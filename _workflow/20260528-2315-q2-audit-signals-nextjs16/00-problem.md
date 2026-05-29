# Problem Statement

*Sprint: Q2 cleanup + maintenance | Date: 2026-05-28*

---

## Context

SmartBrief is ahead of its planned roadmap. Q2, Q3, and most of Q4 features have shipped.
Three housekeeping items remain before the codebase is considered fully current:

---

## Item 1 — Performance Audit (Q2 item, never closed)

**Problem:** The performance audit doc exists (`docs/performance-audit-q2-2026.md`) and the fixes
were applied (next/font, next/image, bundle-analyzer), but the baseline numbers in the doc are
*estimates* — no actual Lighthouse run has been recorded. The `npm run perf` script exists and works,
but has never been executed against a running server to produce real numbers.

**Job to be done:** Close the Q2 audit properly — run Lighthouse, capture real FCP/LCP/CLS/TBT
numbers, update the doc, and confirm the targets are met.

---

## Item 2 — Implicit Read/Skip Signals (Q3 item — ALREADY DONE)

**Finding:** Fully implemented. `ArticleCard.tsx` has IntersectionObserver (3 s threshold),
`handleSkip` in `page.tsx` fires `POST /api/articles/[id]/signal`, and the route writes to
`feedbackSignal` + updates `TopicWeight`. Nothing to build.

**Job to be done:** Document the verified state; no implementation needed.

---

## Item 3 — Next.js 14 → 16 Upgrade (maintenance backlog)

**Problem:** SmartBrief runs on Next.js 14.2.5. Next.js 15/16 is current. The Obsidian roadmap
docs describe a `proxy.ts` migration that does NOT exist in Next.js 15/16 — that information is
incorrect. The real migration items are:
1. Async Request APIs: `params`, `searchParams`, `cookies`, `headers` are now Promises in
   Server Components and Route Handlers
2. Caching defaults: `fetch` requests are no longer cached by default; GET route handlers
   are uncached by default
3. Docker base image: already on `node:20-alpine` (not 18 as the docs said); CI uses Node 24;
   update Dockerfile to `node:24-alpine`

**Job to be done:** Upgrade Next.js, fix async API usage, update Dockerfile, verify auth
middleware still works (middleware.ts API is unchanged in Next.js 15/16).

---

## Item 4 — Docs Migration (parallel task)

**Problem:** All product documentation lives in an Obsidian vault, not in the repo. Docs are
from April 2026 and are stale — they don't reflect what's actually shipped. New contributors
(or future AI assistants) have no documentation unless they have access to the vault.

**Job to be done:** Copy relevant docs to `docs/`, update for current shipped state, remove
incorrect content (the `proxy.ts` migration note; stale Q2/Q3/Q4 status markers).
