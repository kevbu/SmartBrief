# Tech Decisions

*Sprint: Q2 cleanup + maintenance | Date: 2026-05-28*

---

## Next.js Upgrade — 14.2.5 → 16.2.6

### Target version
`next@16.2.6` (latest stable as of 2026-05-28)

### Breaking changes that affect this codebase

**1. Async Request APIs (the only real breaking change here)**

In Next.js 15+, route handler `params` is a Promise. All 6 affected route files use the old
synchronous pattern. One file (`articles/[id]/route.ts`) already uses the new async pattern
as a reference implementation.

Files to update:
- `src/app/api/articles/[id]/read/route.ts`
- `src/app/api/articles/[id]/signal/route.ts`
- `src/app/api/articles/[id]/save/route.ts`
- `src/app/api/articles/[id]/feedback/route.ts` (2 exported functions)
- `src/app/api/top-stories/[id]/save/route.ts`
- `src/app/api/top-stories/[id]/feedback/route.ts`

Migration pattern (identical in each):
```ts
// Before
{ params }: { params: { id: string } }
// use: params.id

// After
{ params }: { params: Promise<{ id: string }> }
// use: const { id } = await params
```

**2. `next.config.mjs` — moved config key**

`experimental.serverComponentsExternalPackages` moved to top-level `serverExternalPackages`:
```js
// Before
experimental: { serverComponentsExternalPackages: ['@prisma/client', 'prisma'] }

// After
serverExternalPackages: ['@prisma/client', 'prisma']
```

**3. Dockerfile base image**
`node:20-alpine` → `node:24-alpine` (matches CI which already uses Node 24)

### What does NOT change
- `middleware.ts` — auth middleware API is unchanged in Next.js 15/16. The `proxy.ts`
  description in the Obsidian docs is incorrect. No migration needed.
- No `fetch()` caching patterns in server components — codebase uses Prisma directly; 
  changed fetch defaults in Next.js 15 do not apply.
- No `searchParams` / `cookies()` / `headers()` calls in server components — no changes needed.
- `page.tsx` `params.set()`  — this is URLSearchParams (client-side), not Next.js params prop.

### Packages to update
```
next: 14.2.5 → 16.2.6
eslint-config-next: (match next version)
```
React 18 stays — no React 19 migration needed for this sprint.

---

## Docs Migration

### Structure
```
docs/
  performance-audit-q2-2026.md   ← already exists, update with real numbers
  product.md                     ← from Product Documentation.md (update roadmap section)
  backlog.md                     ← from Backlog & Sizing.md (mark shipped items)
  open-decisions.md              ← from Open Decisions.md (mark decisions implemented)
  qa-checklist.md                ← from QA Release Checklist.md (keep as-is)
  metrics.md                     ← from Metrics & Measurement Plan.md (keep as-is)
  infrastructure.md              ← from Docker Setup & Infrastructure Notes.md (update Node ver)
  prds/
    newsletter-ingestion.md      ← from PRD Newsletter Ingestion.md (note what's shipped)
    push-notifications.md        ← from PRD Push Notifications.md (note fully shipped)
```

### What to update/clean in each file
- Remove all Obsidian `[[wiki links]]` — replace with plain text or relative markdown links
- Remove `tags:` YAML frontmatter (not useful in a code repo)
- Update "Last updated" dates
- Remove `proxy.ts` references (incorrect)
- Update Q2/Q3/Q4 status markers to reflect what has shipped
- PRD Feedback Learning + Weekly Recap: note fully shipped, keep as historical spec
- Push Notifications PRD: mark fully shipped (VAPID fix done, daily cap done, opt-in done)
- Newsletter Ingestion PRD: mark webhook + source mgmt UI as shipped; IMAP UI still open

---

## Performance Audit — Closure

The `docs/performance-audit-q2-2026.md` doc exists with:
- Fixes already applied (next/font ✅, next/image ✅, bundle-analyzer ✅)
- `npm run perf` script wired to Lighthouse CLI
- Estimated numbers in the table (not real Lighthouse measurements)

**Approach:** Start dev server, run `npm run build && npm start`, then `npm run perf`.
Capture real FCP/LCP/CLS/TBT numbers and update the doc. If any metric misses its target,
investigate and fix before closing.

**Constraint:** Requires a running server — will be done after the Next.js upgrade is
complete so the audit reflects the upgraded build.
