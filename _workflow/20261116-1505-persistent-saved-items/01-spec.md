# Feature: Persistent saved items and safe local DB

> Source: Manual request (build-feature, brief `00-feature-brief.md`, UX `00-ux-design.md`)
> Date: 2026-11-16
> Depth: standard (≈9 files, no new subsystem)

## Context

Smartbrief runs locally as launchd agent `com.kevbu.smartbrief`. Saved top stories are deleted on every refresh, their saved flag is not returned by the feed, and `/saved` only shows saved articles that are still inside the feed window. The SQLite file lives inside the git checkout with no backup.

## Requirements

- A news refresh never deletes a saved top story.
- The feed shows only the newest refresh batch of top stories. Older saved stories do not reappear in the feed.
- `GET /api/news` returns `saved` for each top story.
- `GET /api/saved` returns every saved article and every saved top story, without time window, pagination, balance, hidden-source or avoid-topic filters.
- `/saved` shows saved top stories ("Stories") and saved articles ("Articles"); unsave removes the card.
- The DB default location for the local setup is `~/Library/Application Support/smartbrief/smartbrief.db`.
- `scripts/migrate-db-location.sh` moves an existing DB there safely. The user runs it manually.
- `scripts/deploy-local.sh` writes a consistent DB backup before schema push and restart, and keeps the newest 10.

**Out of scope:**

- Theme / dark mode.
- Article retention / pruning.
- `savedAt` ordering (needs schema change).
- Docker paths and `docker-compose.yml`.
- Running the migration script as part of this pipeline (it edits the user's untracked `.env` and restarts the service).

## Current State

- `src/lib/news-aggregator.ts:159-174` — if `topStoryData.length > 0`: `db.topStory.deleteMany({})` then `createMany`. Rows get `createdAt @default(now())`.
- `src/app/api/news/route.ts:75` — `db.topStory.findMany({ orderBy: { createdAt: 'desc' } })`; lines 137-158 map rows to `TopStory` without `saved`, sort by `sources.length` desc.
- `src/app/api/news/route.ts:90-93` — Prisma `Article` row → `Article` type via spread + sentiment cast.
- `src/app/api/top-stories/[id]/save/route.ts` and `src/app/api/articles/[id]/save/route.ts` — toggle endpoints (unchanged).
- `src/app/saved/page.tsx` — fetches `/api/news?pageSize=200`, filters `isSaved` client-side, articles only.
- `src/app/page.tsx:297-302, 622-630` — feed passes `isSaved={story.saved}` to `TopStoryCard`; `saved` is always undefined after load.
- `src/types/index.ts:39` — `TopStory.saved?: boolean` already exists.
- `src/components/ArticleDetail.tsx:115-127` — resolves cluster articles from `topStory.clusterArticles`, else from `allArticles` by `articleIds`.
- `scripts/deploy-local.sh` — pull → `npm ci` / `prisma db push` if changed → build → `launchctl kickstart -k` → health check. Reads repo dir from plist `WorkingDirectory`.
- Main checkout `.env` / `.env.local`: `DATABASE_URL=file:./dev.db` → `prisma/dev.db`. `.env.local.example` documents the same.
- No `features/` directory and no e2e framework. Only Jest on pure functions (`src/lib/importance-score.test.ts`).

## Implementation Steps

### Step 1 — Pure top-story helpers

**Files:** `src/lib/top-stories.ts` (create), `src/lib/top-stories.test.ts` (create)

- Move the row → `TopStory` mapping from `src/app/api/news/route.ts:137-157` into `toTopStory(row)`. Include `saved: row.saved`. Keep the safe `JSON.parse` fallbacks.
- Add `selectCurrentBatch(rows)`: returns the rows whose `createdAt` equals the maximum `createdAt` in `rows` (compare by `getTime()`). Empty input → empty output.
- Unit tests (Jest, same style as `importance-score.test.ts`): `toTopStory` keeps `saved`, survives malformed JSON; `selectCurrentBatch` keeps only newest-timestamp rows, excludes an older saved row, handles empty input, keeps a saved row that belongs to the newest batch.

### Step 2 — Refresh keeps saved stories and stamps one batch time

**Files:** `src/lib/news-aggregator.ts` (modify)

- Replace `db.topStory.deleteMany({})` with `deleteMany({ where: { saved: false } })`.
- Create one `const batchCreatedAt = new Date()` and set `createdAt: batchCreatedAt` on every row in `createMany`, so `selectCurrentBatch` has an exact match.
- Keep the existing `topStoryData.length > 0` guard.

### Step 3 — Feed returns current batch with saved flag

**Files:** `src/app/api/news/route.ts` (modify)

- Use `selectCurrentBatch(topStoriesDb).map(toTopStory)` then the existing sort by `sources.length` desc.
- Remove the inline mapping.

### Step 4 — Saved endpoint

**Files:** `src/app/api/saved/route.ts` (create)

- `GET` with `export const dynamic = 'force-dynamic'` (match other routes if they set it).
- Query in parallel: `db.article.findMany({ where: { isSaved: true }, orderBy: { publishedAt: 'desc' } })` and `db.topStory.findMany({ where: { saved: true }, orderBy: { createdAt: 'desc' } })`.
- Collect `articleIds` of saved stories; fetch those articles (`id in [...]`) as `relatedArticles` so `ArticleDetail` can resolve clusters without `clusterArticles`.
- Response `{ articles, topStories, relatedArticles }`. Articles mapped like `route.ts:90-93`; stories via `toTopStory`.
- Error → 500 `{ error }`, same shape as `src/app/api/top-stories/[id]/save/route.ts`.
- Add a `SavedApiResponse` type to `src/types/index.ts`.
- Auth: covered by `src/proxy.ts` like every `/api/*` route; verify the matcher does not exclude it.

### Step 5 — Saved page

**Files:** `src/app/saved/page.tsx` (modify)

- Fetch `/api/saved`. State: `articles`, `topStories`, `relatedArticles`.
- Render per `00-ux-design.md`: "Stories" section (`TopStoryCard`, `isSaved`, `onToggleSave`, `onSelect`) then "Articles" section (`ArticleCard`), each `<section aria-labelledby>` with `<h2 className="headline mb-1 text-lg font-semibold">` inside `px-4`. Hide a section when empty. Both empty → existing `EmptyState`.
- Story unsave: `POST /api/top-stories/{id}/save`, remove from state.
- `selectedItem` union gains `{ type: 'topStory'; data: TopStory }`; `ArticleDetail` gets `topStory` and `allArticles = [...articles, ...relatedArticles]`.
- Subtitle: loading/empty → "Your bookmarks"; else `${n} saved` with n = stories + articles.
- Theme tokens only. Do not touch theme/dark-mode code.

### Step 6 — Stable DB path: migration script

**Files:** `scripts/migrate-db-location.sh` (create, executable)

- `set -euo pipefail`. Read repo dir from the plist like `deploy-local.sh`. Target dir default `$HOME/Library/Application Support/smartbrief`, override via `SMARTBRIEF_DATA_DIR`.
- Resolve the current DB from `DATABASE_URL` in `$REPO_DIR/.env.local`, else `.env` (relative `file:./x` → `$REPO_DIR/prisma/x`). Abort if the target file already exists (no overwrite) or the source is missing.
- Stop agent (`launchctl bootout` or `kill` via `launchctl kill TERM gui/$UID/$LABEL` then wait), `sqlite3 "$SRC" ".backup '$DST'"`, run `PRAGMA integrity_check` on target, compare `count(*)` of `Article`, `TopStory`, `UserPreferences`, `SourceWeight`, `TopicWeight`, `FeedbackSignal`, `ArticleFeedback`, `AppState` between source and target.
- On match: rewrite `DATABASE_URL` in each of `.env` / `.env.local` that defines it to `file:<absolute target path>` (keep a `.bak` copy of each env file). Leave the old DB file in place as fallback. Restart agent with `launchctl kickstart -k`, health-check like `deploy-local.sh`.
- `--dry-run` prints the plan without changes.
- Print the rollback steps at the end (restore `.env*.bak`).

### Step 7 — Backup in deploy

**Files:** `scripts/deploy-local.sh` (modify)

- After pull and before `npm ci` / `prisma db push` / build: resolve DB path the same way as Step 6 (share via a small sourced helper `scripts/lib/db-path.sh`).
- If the DB file exists: `sqlite3 "$DB" ".backup '$BACKUP_DIR/smartbrief-<YYYYMMDD-HHMMSS>.db'"` with `BACKUP_DIR` = `<DB dir>/backups` (created if missing). Keep newest `SMARTBRIEF_BACKUP_KEEP` (default 10), delete older ones.
- Run backup also on the "Already up to date" + `--force` path. Skip with a warning if `sqlite3` is missing (do not fail the deploy).

### Step 8 — Docs

**Files:** `CLAUDE.md`, `.env.local.example`, `README.md` (only if it documents `DATABASE_URL`)

- `CLAUDE.md` Database: local default path, migration script, backups. Key conventions: TopStories are replaced each refresh except `saved = true`; feed shows newest batch only.
- `.env.local.example`: comment showing the Application Support path for the local launchd setup.

## Patterns to Follow

- API route shape: `src/app/api/top-stories/[id]/save/route.ts` (try/catch, `NextResponse.json`, error 500).
- Article mapping: `src/app/api/news/route.ts:90-93`.
- Page structure and states: current `src/app/saved/page.tsx`; card wiring from `src/app/page.tsx:622-630`.
- Shell style, plist lookup, `step`/`fail` helpers, health check: `scripts/deploy-local.sh`.
- Unit tests: `src/lib/importance-score.test.ts`.

## Decisions

- Batch identity via one explicit `createdAt` per refresh instead of a new column. Avoids a schema change and a `db push` on deploy.
- Saved stories stay as full `TopStory` rows. Their `articleIds` stay valid because no article pruning exists.
- The migration is a user-run script, not automatic in deploy: it edits untracked local config and stops the service.
- Backup via `sqlite3 .backup` (consistent with WAL), not `cp`.

## Acceptance Criteria

- [ ] AC1: After a refresh that produces new top stories, every top story with `saved = true` before the refresh still exists; all unsaved ones from older batches are gone.
- [ ] AC2: `GET /api/news` returns only top stories from the newest batch, each with a boolean `saved`.
- [ ] AC3: A saved top story from an older batch does not appear in `GET /api/news`.
- [ ] AC4: `GET /api/saved` returns all saved articles regardless of `publishedAt`, hidden sources, avoid topics or balance, plus all saved top stories and their related articles.
- [ ] AC5: `/saved` shows a "Stories" section and an "Articles" section when both have items, hides an empty section, and shows "Nothing saved yet" when both are empty.
- [ ] AC6: Unsaving on `/saved` removes the card and persists (`isSaved`/`saved` false in DB).
- [ ] AC7: `selectCurrentBatch` and `toTopStory` have Jest unit tests that pass.
- [ ] AC8: `scripts/migrate-db-location.sh --dry-run` prints source, target and env files to change, and makes no changes.
- [ ] AC9: The migration script refuses to overwrite an existing target and verifies row counts before editing env files.
- [ ] AC10: `deploy-local.sh` writes a timestamped backup before `prisma db push`/build and keeps at most 10; missing `sqlite3` only warns.
- [ ] AC11: `npx tsc --noEmit` and `npm run build` pass.

## Gherkin Impact

No `features/` directory and no e2e framework (`e2e-cmd`, `e2e-framework` unset). Every AC routes away from Gherkin:

| AC | Venue |
|---|---|
| AC1–AC3 | unit test (`selectCurrentBatch`) + impl check-result (aggregator `where: { saved: false }`, single `batchCreatedAt`) |
| AC4 | impl check-result (curl `/api/saved` against a dev server on a copy of the DB) |
| AC5–AC6 | impl check-result (browser check of `/saved` on dev server) |
| AC7 | unit test |
| AC8–AC10 | impl check-result (run script with `--dry-run`, run backup function against a temp DB copy) |
| AC11 | lint (`tsc`) + build |

No `.feature` files created, extended or pruned.

## Workflow Config

| Key           | Value |
| ------------- | ----- |
| workflow-dir  | _workflow |
| test-cmd      | node --experimental-vm-modules node_modules/.bin/jest src/lib/importance-score.test.ts |
| lint-cmd      | npx tsc --noEmit |
| build-cmd     | npm run build |
| e2e-cmd       | (none) |
| e2e-framework | (none) |
| tdd           | (not set) |
| branch-prefix | feature/ |
| base-branch   | main |
