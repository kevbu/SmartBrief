# Review

*Sprint: Q2 cleanup + maintenance | Date: 2026-05-29*

---

## What shipped

- Next.js 14 → 16.2.6 with all breaking-change fixes applied
- 8 route handlers migrated to async params API
- `middleware.ts` → `proxy.ts` rename (Next.js 16 requirement)
- `CLAUDE.md` written from scratch — repo now has architecture docs
- 8 Obsidian docs migrated to `docs/` and updated for current state
- Q2 performance audit closed: 92/100 Lighthouse score, real numbers in doc
- Raw Lighthouse HTML + JSON saved to `docs/`

---

## Open items

**LCP simulated miss (non-blocking)**
Lighthouse simulated LCP is 3.3s against a 2.5s target. Real-world is 205ms. Root cause: `page.tsx` is a `'use client'` component; the LCP element isn't in the HTML until `GET /api/news` resolves, so Lighthouse's 4G simulation punishes it. Three remediation paths are documented in `docs/performance-audit-q2-2026.md`. No action required for this sprint.

**`docs/prds/` is a partial migration**
Only the two PRDs specifically listed in the spec were migrated. Other vault docs (Sprint Specs, Kickoff notes, older PRDs) were intentionally left out as they contain stale or superseded content. If future AI assistants or contributors need them, they should be migrated on demand.

---

## Notes for future work

- `tsconfig.json` now uses `"moduleResolution": "bundler"` — required by Next.js 16 / ESLint v9. Do not revert to `"node"`.
- `proxy.ts` export name (`proxy`) is load-bearing — Next.js 16 looks for this export. Renaming it back to `middleware` will silently break auth.
- The `api/articles/[id]/route.ts` file was not in the original spec but also needed the async params fix. Any new dynamic route handlers must use `const { id } = await params` from day one.
