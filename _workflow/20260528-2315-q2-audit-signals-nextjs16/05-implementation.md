# Implementation Notes

*Sprint: Q2 cleanup + maintenance | Date: 2026-05-28 → 2026-05-29*

---

## Track A — Next.js 14 → 16 Upgrade

### A1. Package upgrade

```bash
npm install next@^16.2.6 eslint-config-next@^16
```

Result: Next.js 16.2.6 installed. ESLint config updated to v9 flat config format, which required updating `tsconfig.json` to add `"moduleResolution": "bundler"` and `"allowImportingTsExtensions": true`.

### A2. Async params — 8 route files

All six spec-listed files were migrated. Two additional files were caught during implementation:

| File | Change |
|---|---|
| `src/app/api/articles/[id]/read/route.ts` | `params` → `Promise<{id}>`, `await params` |
| `src/app/api/articles/[id]/signal/route.ts` | same |
| `src/app/api/articles/[id]/save/route.ts` | same |
| `src/app/api/articles/[id]/feedback/route.ts` | same (both GET + POST handlers) |
| `src/app/api/top-stories/[id]/save/route.ts` | same |
| `src/app/api/top-stories/[id]/feedback/route.ts` | same |
| `src/app/api/articles/[id]/route.ts` | same (not in original spec list — caught during audit) |

### A3. next.config.mjs

Moved `serverComponentsExternalPackages` out of `experimental` block and renamed to `serverExternalPackages` (top-level, Next.js 15+ API). `experimental` wrapper removed entirely.

### A4. Dockerfile

`node:20-alpine` → `node:24-alpine`. Matches CI (Node 24 opt-in was done in a prior commit, `71c1ef7`).

### A5. middleware.ts → proxy.ts

`src/middleware.ts` renamed to `src/proxy.ts`; exported function renamed from `middleware` to `proxy`. This was a real Next.js 16 requirement — the Obsidian docs incorrectly described this as a Next.js 15 change. `CLAUDE.md` updated to document the rename.

### A6. CLAUDE.md

Written from scratch — the repo had no `CLAUDE.md`. Documents architecture, data flows, key conventions, commands, and the proxy.ts rename.

---

## Track B — Docs Migration

Eight Obsidian docs migrated to `docs/`:

| File | Key changes beyond cleanup rules |
|---|---|
| `docs/product.md` | Q2/Q3/Q4 roadmap items marked ✅ shipped |
| `docs/backlog.md` | All shipped items marked; open items reflect current reality |
| `docs/open-decisions.md` | Proxy.ts decision updated to reflect actual Next.js 16 behavior |
| `docs/qa-checklist.md` | YAML frontmatter stripped; ready to use |
| `docs/metrics.md` | YAML frontmatter stripped |
| `docs/infrastructure.md` | Node version updated 20→24; env var table current |
| `docs/prds/newsletter-ingestion.md` | Webhook + source mgmt UI marked shipped; IMAP UI open |
| `docs/prds/push-notifications.md` | Marked fully shipped |

All docs: Obsidian frontmatter stripped, `[[Wiki Links]]` converted to plain text, "Last updated" set to 2026-05-28, cross-references to non-migrated vault docs removed.

---

## Track C — Performance Audit Closure

### Audit run

```bash
npm run build && npm start &
# waited for ready
npm run perf
```

Lighthouse 12, mobile preset (Moto G4), simulated 4G, `--disable-storage-reset`.

### Results

| Metric | Result | Target | Status |
|---|---|---|---|
| FCP | 0.8s | <1.5s | ✅ |
| LCP | 3.3s (simulated) / 205ms (real) | <2.5s | ⚠️ see audit doc |
| CLS | 0 | <0.1 | ✅ |
| TBT | 10ms | <200ms | ✅ |
| Overall score | 92/100 | — | ✅ |

Full write-up and LCP nuance documented in `docs/performance-audit-q2-2026.md`. Raw Lighthouse output saved to `docs/lighthouse-report.html` and `docs/lighthouse-report.json`.

### Fixes applied (pre-existing from Q2 audit work)

- `next/font/google` Inter wired correctly with `--font-inter` CSS variable
- `next/image` used throughout (already applied prior to this sprint)
- Bundle analyzer confirmed no unexpected large dependencies

---

## Commit

`78b9fdf` / merged as `26c4323` — 22 files, +2581 / -909 lines.
