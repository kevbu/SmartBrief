# Feature Brief: Persistent saved items and safe local DB

## What it does
Saved articles and saved top stories survive refreshes, deploys and time, and the local SQLite file lives at a stable path with a backup before each deploy.

## Why it's valuable
Smartbrief now runs locally as launchd agent `com.kevbu.smartbrief`. The user expects settings, bookmarks and learned weights to stay. Today some of that state is lost or hidden by app logic, and the DB file sits inside the git checkout with no backup.

## Current state (verified 2026-11-16)

| Area | Finding | Status |
|---|---|---|
| DB location | `DATABASE_URL=file:./dev.db` in main checkout `.env` / `.env.local` → resolves to `prisma/dev.db` (Prisma resolves relative to schema dir). File exists, ~960 KB, updated today. | ⚠️ inside repo |
| git | `*.db`, `*.db-journal`, `*.db-wal` are gitignored. `git pull --ff-only` does not touch it. | ✅ |
| deploy-local.sh | `npm ci` does not touch it. `prisma db push` without `--accept-data-loss` aborts on destructive changes (script has `set -e`), so data is not dropped silently. No backup step. | ⚠️ no backup |
| Risky ops | `git clean -fdx`, deleting/re-cloning the checkout, or a manual `prisma db push --force-reset` would wipe all state. | ⚠️ |
| Browser storage | No `localStorage` / `sessionStorage` use in `src/`. All state is server-side. | ✅ |
| Preferences, weights, feedback, AppState (VAPID) | Stored in DB rows, never bulk-deleted except by explicit user "reset" actions. | ✅ |
| Saved top stories | `src/lib/news-aggregator.ts:161` runs `db.topStory.deleteMany({})` on every refresh. Saved clusters are deleted too. | ❌ bug |
| Top story saved flag in feed | `GET /api/news` maps TopStory rows without `saved` (`src/app/api/news/route.ts:137`). After a reload the bookmark icon always shows unsaved. | ❌ bug |
| Saved page | `src/app/saved/page.tsx` fetches `/api/news?pageSize=200` and filters `isSaved` client-side. Saved articles disappear once outside the feed window (`sinceDate`, `take: 500`, balance filter, hidden sources, avoid topics). Saved top stories are not shown at all. | ❌ bug |

## In scope
1. Refresh keeps saved top stories: delete only `saved = false` rows.
2. Feed shows only the current refresh batch of unsaved clusters plus current saved ones, so old saved clusters do not pile up in the feed. Feed response includes the `saved` flag.
3. New `GET /api/saved` endpoint: returns all saved articles (no time window, no balance/hidden filters) and all saved top stories, newest first.
4. `/saved` page uses `/api/saved` and shows saved top stories (via existing `TopStoryCard`) above saved articles. Unsave works for both.
5. Stable DB location: default path `~/Library/Application Support/smartbrief/smartbrief.db`, outside the checkout.
6. One-time migration script `scripts/migrate-db-location.sh`: stops the agent, copies `prisma/dev.db` (with WAL checkpoint), verifies row counts, updates `DATABASE_URL` in the main checkout `.env`, restarts, keeps the old file as a backup. Run manually by the user.
7. `scripts/deploy-local.sh`: back up the DB (via `sqlite3 .backup`) before `prisma db push` / restart, keep the last N backups (default 10) in `…/smartbrief/backups/`.
8. Docs: `CLAUDE.md` Database/Deployment sections and `.env.local.example`.

## Out of scope
- Theme / dark mode (other session).
- Pruning old articles or a retention policy.
- Saving articles that never existed in DB (newsletter-only items behave as today).
- Export/import of settings as a file.
- Docker paths (`/app/data`) stay unchanged.

## UI changes
Yes, small: `/saved` page gains a "Saved stories" section. Reuses `TopStoryCard`, `ArticleCard`, `PageHeader`, `EmptyState`.

## Known constraints
- Single-user app, single `UserPreferences` row.
- `TopStory.articleIds` reference article IDs. A saved cluster keeps working as long as the articles exist. No article pruning exists today.
- Distinguishing the "current batch" needs a marker. Option: compare `createdAt` with `AppState.lastRefreshed` window, or add a `batchId`/`refreshedAt` column. Spec decides. A schema change triggers `prisma db push` in deploy, which the new backup step covers.
- The migration touches the user's untracked `.env` in the main checkout and restarts the launchd agent. The script must be run by the user, not by the pipeline.
- Only test infra: Jest on pure functions (`importance-score.test.ts` pattern).
