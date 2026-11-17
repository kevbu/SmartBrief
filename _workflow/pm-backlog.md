# PM Backlog

> Repo: kevbu/SmartBrief
> Generated: 2026-11-17 08:00 UTC
> Open issues scanned: 10
> Issues in active backlog: 10
> Issues deferred: 0
> Issues needing triage: 0

## Prioritization Rationale

The backlog is mostly follow-ups from the theme and persistence features, plus one older personalisation bug (#16). The top priority is #24: without a test runner there is no gate for any other change, and #28 hides behind it (Rule 3, blocking debt treated as a bug). Next come the user-visible bugs #16 and #29 (Rule 2). Features follow as lead bullets: `savedAt` ordering is cheap, retention protects the DB long term, export/import adds a portable backup. Nothing is deferred: the run goal is an empty backlog, and every item has a clear fix path. Playwright (#25) and export/import (#32) are high effort for a single-user app, so they are built lean.

## Active Backlog

### 1. #24 — test-cmd cannot run: Jest is not installed
- **Type:** bug
- **Impact:** high
- **Effort:** low
- **Conviction:** know
- **Why this rank:** Blocks the test gate for every other change (Rule 2 + Rule 3, blocker).

### 2. #28 — importance-score recency-decay test fixture uses one category
- **Type:** bug
- **Impact:** low
- **Effort:** low
- **Conviction:** know
- **Why this rank:** One-line fixture fix. Surfaces as soon as #24 lands, so it ships in the same pack (Rule 2).

### 3. #16 — top story clusters bypass hidden-source and avoid-topics filters
- **Type:** bug
- **Impact:** high
- **Effort:** low
- **Conviction:** know
- **Why this rank:** Breaks personalisation in the main feed for every refresh (Rule 2, high impact).

### 4. #29 — Re-saving a rebuilt cluster duplicates it on /saved
- **Type:** bug
- **Impact:** low
- **Effort:** low
- **Conviction:** think
- **Why this rank:** User-visible bug, but only for long-running stories (Rule 2, low impact). Needs a design call on overlap detection.

### 5. #30 — Track savedAt so /saved sorts by save time
- **Type:** feature
- **Impact:** low
- **Effort:** low
- **Conviction:** know
- **Why this rank:** Lead bullet with a clear spec. Same file surface as #29, so it ships in the same pack (Rule 4).

### 6. #31 — Article retention policy that keeps saved items and saved-story references
- **Type:** feature
- **Impact:** high
- **Effort:** low
- **Conviction:** think
- **Why this rank:** The DB grows without bound on a local machine (Rule 4, lead bullet). Touches the refresh path, so it runs after the #16/#29/#30 pack.

### 7. #33 — docs/infrastructure.md documents the retired VPS setup
- **Type:** docs
- **Impact:** low
- **Effort:** low
- **Conviction:** know
- **Why this rank:** Trivial inline fix, prevents wrong ops instructions.

### 8. #26 — public/manifest.json colours predate the editorial palette
- **Type:** ux
- **Impact:** low
- **Effort:** low
- **Conviction:** know
- **Why this rank:** Two-line inline fix (Rule 4, lead bullet).

### 9. #32 — Export and import settings and saved items as a file
- **Type:** feature
- **Impact:** low
- **Effort:** high
- **Conviction:** think
- **Why this rank:** Portable backup on top of the SQLite backups. Built lean (JSON export of prefs, weights, saved items; import with merge).

### 10. #25 — No e2e framework configured
- **Type:** debt
- **Impact:** low
- **Effort:** high
- **Conviction:** know
- **Why this rank:** Non-blocking debt (Rule 3). Built lean: Playwright plus one theme spec, no Gherkin layer.

## Execution Index

| Rank | Number | Title | Type | Effort |
|------|--------|-------|------|--------|
| 1 | 24 | test-cmd cannot run: Jest is not installed | bug | low |
| 2 | 28 | importance-score recency-decay test fixture uses one category | bug | low |
| 3 | 16 | top story clusters bypass hidden-source and avoid-topics filters | bug | low |
| 4 | 29 | Re-saving a rebuilt cluster duplicates it on /saved | bug | low |
| 5 | 30 | Track savedAt so /saved sorts by save time | feature | low |
| 6 | 31 | Article retention policy that keeps saved items and saved-story references | feature | low |
| 7 | 33 | docs/infrastructure.md documents the retired VPS setup | docs | low |
| 8 | 26 | public/manifest.json colours predate the editorial palette | ux | low |
| 9 | 32 | Export and import settings and saved items as a file | feature | high |
| 10 | 25 | No e2e framework configured | debt | high |

## Deferred Items

None.

## Needs Triage

None.

## Assumptions

- #31 classified high impact: the DB already holds 384 articles after one day of local use; without pruning it grows indefinitely.
- #32 and #25 are not deferred under Rule 5 because the run goal is an empty backlog. Both are scoped down instead.
- #25 uses Playwright without the Gherkin `features/` layer the issue suggests. Gherkin adds a second abstraction for a single-user app with one developer.
- There is no CI pipeline. "CI green" means local `tsc --noEmit`, `npm run build` and the unit tests pass on the merged result.
