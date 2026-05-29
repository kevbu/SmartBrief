# Implementation Spec

*Sprint: Q2 cleanup + maintenance | Date: 2026-05-28*

---

## Track A — Next.js 14 → 16 Upgrade

### A1. Upgrade packages

```bash
npm install next@^16 eslint-config-next@^16
```

### A2. Fix async params — 6 route files

Pattern (same in every file):
```ts
// Before
{ params }: { params: { id: string } }
// usage: params.id

// After
{ params }: { params: Promise<{ id: string }> }
const { id } = await params
// usage: id
```

Files:
1. `src/app/api/articles/[id]/read/route.ts` — 1 function, uses `params.id` twice
2. `src/app/api/articles/[id]/signal/route.ts` — 1 function, uses `params.id`
3. `src/app/api/articles/[id]/save/route.ts` — 1 function, uses `params.id`
4. `src/app/api/articles/[id]/feedback/route.ts` — 2 functions (GET + POST), each uses `params.id`
5. `src/app/api/top-stories/[id]/save/route.ts` — 1 function, uses `params.id`
6. `src/app/api/top-stories/[id]/feedback/route.ts` — 1 function, uses `params.id`

### A3. Update next.config.mjs

```js
// Remove experimental wrapper, hoist to top-level
serverExternalPackages: ['@prisma/client', 'prisma'],
// Remove: experimental: { serverComponentsExternalPackages: [...] }
```

### A4. Update Dockerfile

```
node:20-alpine → node:24-alpine
```

### A5. Acceptance criteria

- `npm run build` exits 0 with no type or lint errors
- `npm run dev` starts cleanly (no deprecation warnings)
- Auth: `SMARTBRIEF_PASSWORD` set + no cookie → redirect to `/login`
- Auth: valid cookie → feed loads
- All article and top-story dynamic routes respond correctly

---

## Track B — Docs Migration

### B1. Files to create

All under `docs/`. Read source from Obsidian vault, write cleaned version to repo.

| Target | Source | Key edits |
|---|---|---|
| `docs/product.md` | Product Documentation.md | Update roadmap status (Q2/Q3/Q4 shipped) |
| `docs/backlog.md` | Backlog & Sizing.md | Mark all shipped items; update open items to current reality |
| `docs/open-decisions.md` | Open Decisions.md | Mark implemented decisions; fix proxy.ts tech-debt note |
| `docs/qa-checklist.md` | QA Release Checklist.md | Keep as-is; remove Obsidian frontmatter |
| `docs/metrics.md` | Metrics & Measurement Plan.md | Keep as-is; remove Obsidian frontmatter |
| `docs/infrastructure.md` | Docker Setup & Infrastructure Notes.md | Update Node version (20→24); update env var notes |
| `docs/prds/newsletter-ingestion.md` | PRD Newsletter Ingestion.md | Mark webhook + source mgmt UI as shipped; IMAP UI still open |
| `docs/prds/push-notifications.md` | PRD Push Notifications.md | Mark fully shipped |

### B2. Cleanup rules (apply to all)

- Strip YAML frontmatter (`tags:`, `created:`, etc.)
- Replace `[[Wiki Links]]` with plain text
- Replace "Last updated: 2026-04-04" with "Last updated: 2026-05-28"
- Remove cross-references to non-migrated docs (Sprint Specs, Kickoff docs)
- Replace `proxy.ts` references with correct info
- Status tables: update ✅/🔄/📅 markers to reflect current shipped state

---

## Track C — Performance Audit Closure

### C1. Run audit

```bash
cd /Users/kevin/projects/SmartBrief
npm run build && npm start &
# wait for server to be ready
npm run perf
```

### C2. Update doc

In `docs/performance-audit-q2-2026.md`:
- Replace estimated numbers in Baseline table with real Lighthouse output
- Replace estimated numbers in Post-fix table with real numbers
- Add "Validated: 2026-05-28" line to the doc

### C3. Acceptance

All four metrics at target:
- FCP < 1.5s
- LCP < 2.5s
- CLS < 0.1
- TBT < 200ms
