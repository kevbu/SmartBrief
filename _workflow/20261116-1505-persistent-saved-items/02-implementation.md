# Implementation: Persistent saved items and safe local DB

> Spec: [01-spec.md](01-spec.md)
> Date: 2026-11-16
> Mode: normal
> Status: DONE_WITH_CONCERNS

## Summary

Refresh now deletes only unsaved top stories and stamps each batch with one `createdAt`. The feed shows the newest batch with the `saved` flag. A new `GET /api/saved` serves all saved articles and stories to a two-section `/saved` page. Two scripts handle the DB: a one-time migration out of the checkout and a pre-deploy backup with rotation.

## Steps Completed

### Step 1 — Pure top-story helpers
**Files created:**
- `src/lib/top-stories.ts` — `toTopStory(row)` (includes `saved`, safe JSON parsing) and `selectCurrentBatch(rows)`.
- `src/lib/top-stories.test.ts` — 7 Jest-style tests.

### Step 2 — Refresh keeps saved stories
**Files modified:**
- `src/lib/news-aggregator.ts` — `deleteMany({ where: { saved: false } })`, shared `batchCreatedAt` on every created row.

### Step 3 — Feed returns current batch with saved flag
**Files modified:**
- `src/app/api/news/route.ts` — inline mapping replaced by `selectCurrentBatch(...).map(toTopStory)`, existing sort kept.

### Step 4 — Saved endpoint
**Files created:**
- `src/app/api/saved/route.ts` — `GET` returns `{ articles, topStories, relatedArticles }`, no window or filters.
**Files modified:**
- `src/types/index.ts` — `SavedApiResponse`.

### Step 5 — Saved page
**Files modified:**
- `src/app/saved/page.tsx` — fetches `/api/saved`, "Stories" and "Articles" sections, story unsave, `ArticleDetail` for stories, subtitle `N saved` / "Your bookmarks".

### Step 6 — Migration script
**Files created:**
- `scripts/migrate-db-location.sh` — dry-run, refuses overwrite, `sqlite3 .backup`, integrity + row-count check, env rewrite with `.bak`, EXIT-trap restarts agent on the old DB on any failure before the env switch, health check, rollback hint.

### Step 7 — Backup in deploy
**Files created:**
- `scripts/lib/db-path.sh` — `db_url_from_env`, `db_path`, `backup_db`.
**Files modified:**
- `scripts/deploy-local.sh` — backup step after pull, before `npm ci` / `db push` / build.

### Step 8 — Docs
**Files modified:**
- `CLAUDE.md` — refresh flow, Database section, TopStory convention.
- `.env.local.example` — local DB path guidance.

## Tests Added

- `src/lib/top-stories.test.ts` — `toTopStory` (saved flag, JSON fallbacks), `selectCurrentBatch` (empty, newest only, old saved excluded, current saved kept).

## Deviations from Spec

### Test runner
- **Spec said:** run `test-cmd` (`node --experimental-vm-modules node_modules/.bin/jest …`).
- **Found:** Jest is not in `package.json` and not installed in the main checkout or worktree. `test-cmd` fails with `MODULE_NOT_FOUND` before this change.
- **Did instead:** ran both test files through a throwaway describe/it/expect shim (TypeScript `transpileModule` + `node:assert`) kept outside the repo. Did not add dependencies without asking.

### deploy-local.sh header comment
- **Spec said:** n/a.
- **Found:** bash reads a running script by byte offset; `git pull` rewrites `deploy-local.sh` mid-run during the deploy of this very change.
- **Did instead:** kept every byte above the insertion point identical to `main` (verified with `cmp` through line 56) and added a comment warning future edits.

### docs/infrastructure.md
- Mentions `DATABASE_URL` for the retired VPS/Docker setup. Not changed (Docker out of scope).

## Check Results

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx tsc --noEmit` | Pass |
| Tests | `test-cmd` (jest) | Cannot run: jest not installed (pre-existing) |
| Tests | shim runner on `top-stories.test.ts` | Pass (7/7) |
| Tests | shim runner on `importance-score.test.ts` | 6/7: pre-existing failure, see Discovered Issues |
| Build | `npm run build` | Pass (`/api/saved` dynamic, `/saved` static) |

Extra verification:
- Prisma CLI `db push` and `PrismaClient` both work with a `DATABASE_URL` containing a space (`…/App Support Test/t.db`).
- `migrate-db-location.sh --dry-run` against the real setup: correct source (`prisma/dev.db`), target, both env files; no changes.
- `backup_db` on a copy of the real DB: 12 runs → 10 kept, newest passes `integrity_check`, 384 articles. Missing DB and missing `sqlite3` warn with exit 0.
- `db_path` resolves `file:./dev.db`, quoted absolute paths with spaces and `?params`, and `.env.local` precedence over `.env`.
- Real DB: all 20 current TopStory rows share one `createdAt`, so the feed shows the same set before the first post-deploy refresh.

## Acceptance Criteria

- [x] AC1 — code: `deleteMany({ where: { saved: false } })`; unit-tested selection.
- [x] AC2 — `selectCurrentBatch` + `toTopStory` (includes `saved`).
- [x] AC3 — unit test "excludes a saved row from an older batch".
- [x] AC4 — `/api/saved` has no window/filters (runtime check in QA).
- [x] AC5 — sections + empty state implemented (browser check in QA).
- [x] AC6 — unsave calls toggle endpoints, removes card.
- [x] AC7 — 7 tests pass (via shim; jest missing).
- [x] AC8 — dry-run verified.
- [x] AC9 — overwrite guard + row-count check before env edits.
- [x] AC10 — verified on temp copy.
- [x] AC11 — tsc and build pass.

## Discovered Issues

1. **Jest not installed.** `CLAUDE.md` `test-cmd` cannot run. Needs `jest` + `ts-jest` (or `@swc/jest`) and a config with the `@/` path alias, or a switch to `node --test`.
2. **`importance-score.test.ts` "recency decay" fails.** Both articles default to `category: 'technology'`, so the second gets the 0.7 same-category factor: ratio ≈ 0.258, test expects e⁻¹ ≈ 0.368. The test comment says "different categories", so the test fixture is wrong, not the scorer. Hidden because jest never ran.
3. **`docs/infrastructure.md`** still documents the retired VPS `DATABASE_URL`.
4. **No `savedAt`.** `/saved` sorts articles by `publishedAt`, stories by cluster `createdAt`.

## Fix Round 1

> Review: [04-review.md](04-review.md) (PASS_WITH_NOTES; user asked to fix 1–5 before ship)
> Date: 2026-11-16

### Issues Addressed

1. **Env backups in checkout (MAJOR)** — `migrate-db-location.sh` now copies env files to `<data dir>/env-backups/<timestamp>/` (mode 700) instead of `.env.bak` next to `.env`. Env files are rewritten in place (`cat > "$f"`), keeping their inode and permissions. Rollback messages point to the new folder.
2. **Misleading self-modification comment** — `deploy-local.sh` comment now states that the running bash keeps the old copy after `git pull`, so script changes apply from the next deploy. Consequence for this change: the first deploy after merge takes no backup; run `npm run deploy:local -- --force` once afterwards.
3. **Backup without busy timeout** — `backup_db` uses `sqlite3 -cmd '.timeout 5000'`; on failure it removes the partial file, warns and returns 0.
4. **Partial target after failed migration** — EXIT trap (`on_exit`) removes `$DST` when the copy had started and the env switch had not happened, then restarts the agent on the old DB. Integrity/row-count failures go through the same path.
5. **Non-atomic top-story replace** — `deleteMany(unsaved)` + `createMany` now run in `db.$transaction([...])`.

### Verification

- Migration happy path in a sandbox (temp `HOME` with fake plist, stubbed `launchctl`/`curl`, copy of real DB, data dir with a space): row counts match, `.env` keeps comment and other keys, backups in `env-backups/<ts>/`, no `.bak` in repo, rerun is a no-op.
- Migration abort path (stubbed `sqlite3 .backup` writes a partial file and fails): partial target removed, agent restarted, `.env` unchanged, exit 1.
- `backup_db` with failing `sqlite3` under `set -euo pipefail`: warning, rc 0, no partial file; normal run still writes a backup.

### Updated Check Results

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx tsc --noEmit` | Pass |
| Tests | shim runner, `top-stories.test.ts` | Pass (7/7) |
| Shell | `bash -n` on all three scripts | Pass |
| Build | `npm run build` | Pass |
