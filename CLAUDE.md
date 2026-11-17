# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Config

```
workflow-dir: _workflow
lint-cmd: npx tsc --noEmit
test-cmd: npm test
build-cmd: npm run build
deploy-cmd: npm run deploy:local
e2e-cmd: npm run e2e
e2e-framework: playwright
branch-prefix: feature/
base-branch: main
```

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # prisma generate + next build
npm run db:push      # Apply schema changes to SQLite (run after editing prisma/schema.prisma)
npm run db:studio    # Open Prisma Studio GUI
npm run deploy:local # Pull main, build, restart the local launchd service

npm test             # Run all unit tests (Vitest, src/**/*.test.ts)
npm run e2e          # Playwright (Chromium) on its own next dev at :3103 with a throwaway DB (prisma/e2e.db)
```

No lint or format scripts are configured; TypeScript type-checking is via `tsc --noEmit` (included in the build).

## Architecture

### Tech stack
Next.js 16 (App Router), TypeScript, SQLite via Prisma, Tailwind CSS. Single-user personal app — one set of preferences, no multi-tenancy.

### Data flow: refresh cycle

```
POST /api/news/refresh
  → news-aggregator.refreshNews()
      1. news-fetcher.fetchAllFeeds()       — RSS → RawArticle[]
      2. db.article.createMany (new URLs)   — dedup by URL, skips items older than the retention window
      3. claude-analyzer.analyzeSentiment() — Haiku 4.5, batches of 20
      4. claude-analyzer.generateTopStories() — Sonnet 4.6, 12-hour window
      5. db.topStory.deleteMany(unsaved) + createMany — replaces unsaved clusters each refresh
      6. pruneOldArticles()                 — retention, also on the "no new articles" path
  → piggybacked (fire-and-forget): IMAP poll + breaking-news detection
```

### Article retention
Each refresh deletes articles older than `SMARTBRIEF_RETENTION_DAYS` (default 30, `0` = off). An article is pruned only if `publishedAt`, `fetchedAt` and `readAt` (if set) are all before the cutoff. Never pruned: saved articles and any id in a remaining `TopStory.articleIds` (saved clusters + the current batch). Orphaned `ArticleFeedback` is removed once older than max(window, 30 days). `FeedbackSignal` and the weight tables are not touched. Dedup only sees existing rows, so step 2 skips RSS items published before the cutoff; otherwise a feed that still serves a pruned URL would re-add it. If any cluster's `articleIds` is unreadable, the prune is skipped (fail closed). Errors are logged and never fail the refresh. A window below 30 days also shortens the 14/30-day recap views. Selection logic is pure in `src/lib/retention.ts`. The SQLite file does not shrink (no `VACUUM`); freed pages are reused.

### Scheduled refresh
`src/lib/scheduler.ts` (started from `src/instrumentation.ts`) runs a one-minute tick, registered once per process via a `globalThis` guard. Each tick reads `UserPreferences.refreshMode` (`manual` default | `interval` | `daily`), `refreshIntervalMins`, `refreshDailyTime` (`HH:MM`, server local time) and `AppState.lastRefreshed`, then asks the pure `isRefreshDue()` in `src/lib/refresh-schedule.ts`. Interval: due when `lastRefreshed + max(interval, 15 min)` has passed. Daily: due when the most recent daily slot is after `lastRefreshed`, so a sleeping Mac catches up on the first tick after wake, and a manual refresh after the slot satisfies it. A due tick calls `refreshNews()` and then `runPostRefreshTasks()` (IMAP poll + breaking-news detect, same due-checks as the refresh route). A failed tick backs off 15 minutes (in memory). `refreshNews()` is single-flight: concurrent callers share one in-flight run. `SMARTBRIEF_SCHEDULER=off` disables the tick; Playwright sets it. Pref changes apply at the next tick without a restart.

### Data flow: feed read

```
GET /api/news
  → reads articles from DB
  → applies source weight decay (source-weights.ts)
  → applies topic weight decay (topic-weights.ts)
  → balance-filter.applyBalanceFilter() — enforces pos/neu/neg ratios from prefs
  → scoreByImportance() in catch-up mode
  → returns { articles, topStories, balanceStats, preferences }
```

### Feed display (page.tsx)
`page.tsx` is the entire frontend — a single `'use client'` page component (~650 lines). It calls `GET /api/news` on mount, optionally triggers a refresh, then builds a **unified feed** via `buildUnifiedFeed()`: cluster cards (`TopStoryCard`) first sorted by source count, then unclustered articles (`ArticleCard`). Articles that appear in a cluster are excluded from the article list.

### Learning / personalization

Feedback (👍 👎 😔 🚫 🙈) adjusts two weight tables:
- `SourceWeight` — per-source multiplier applied at feed query time via `applyDecayAndGetWeightMap()`
- `TopicWeight` — per-topic (= category) multiplier, same pattern

Both tables apply **exponential time decay** (half-life 30 days) so old signals fade. `FeedbackSignal` is an append-only log used by `runSignalCleanupIfNeeded()` for periodic decay recalculation. `topic-weights.ts` and `source-weights.ts` are structurally identical.

### Claude usage
`src/lib/claude-analyzer.ts` is the only file that calls Anthropic:
- `analyzeSentiment()` — `claude-haiku-4-5`, classifies batches of 20 articles as positive/neutral/negative with severity
- `generateTopStories()` — `claude-sonnet-4-6`, takes recent articles and returns up to 20 topic clusters with bullets, summary, sources, sentiment

Both functions return empty results (graceful degradation) if `ANTHROPIC_API_KEY` is missing or the client returns null.

### Auth
Optional password protection via `SMARTBRIEF_PASSWORD` env var. `POST /api/auth/login` sets an `sb_auth` cookie (httpOnly, 30-day). If the env var is unset, auth is disabled entirely. Auth is enforced in `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the exported function is `proxy`).

### Newsletter ingestion
`src/lib/imap-poller.ts` polls an IMAP inbox for newsletter emails. `src/lib/newsletter-parser.ts` extracts article links. Piggybacked on the regular refresh cycle; configured via `IMAP_*` env vars.

### Breaking news
`src/lib/breaking-news-detector.ts` runs on a 5-minute cadence (piggybacked on refresh). Groups articles by title-similarity (Jaccard distance on tokens, threshold 0.2) and pushes Web Push notifications for critical-severity clusters.

### Database
SQLite file at `DATABASE_URL`. Local launchd setup: `~/Library/Application Support/smartbrief/smartbrief.db`, outside the checkout (move an existing `prisma/dev.db` there once with `scripts/migrate-db-location.sh`, `--dry-run` first). Docker: `file:/app/data/smartbrief.db`. `deploy-local.sh` writes a `sqlite3 .backup` copy to `<db dir>/backups/` before every deploy and keeps the newest 10 (`SMARTBRIEF_BACKUP_KEEP`). Key models: `Article`, `TopStory`, `UserPreferences` (single row, id=`"default"`), `SourceWeight`, `TopicWeight`, `FeedbackSignal`, `ArticleFeedback`. `AppState` tracks last-refreshed timestamps and VAPID keys.

### Deployment
Local only. The app runs as the launchd agent `com.kevbu.smartbrief` (`~/Library/LaunchAgents/com.kevbu.smartbrief.plist`): `next start -p 3000` on a production build in the main checkout. Logs go to `~/Library/Logs/smartbrief.log`.

After merging to `main`, run `npm run deploy:local` (`scripts/deploy-local.sh`). It pulls `main`, runs `npm ci` / `prisma db push` only if dependencies or schema changed, builds, restarts the agent and checks the server responds. Use `--force` to rebuild without new commits.

There is no CI/CD pipeline. The former GitHub Actions → GHCR → Watchtower deploy was removed. `Dockerfile` and `docker-compose.yml` remain for manual container builds only.

## Key conventions

- **All preferences live in a single DB row** (`UserPreferences` id=`"default"`). Arrays (categories, sources, topics) are stored as comma-separated strings and parsed/serialized at the API boundary.
- **TopStories are ephemeral** — each refresh deletes unsaved clusters and creates a new batch with one shared `createdAt`. Saved clusters survive. The feed shows only the newest batch (`selectCurrentBatch` in `src/lib/top-stories.ts`); `/saved` reads `GET /api/saved`. Don't store business logic that depends on unsaved TopStory persistence across refreshes.
- **`src/lib/db.ts`** exports a singleton `db` (Prisma client). Use this everywhere; don't instantiate PrismaClient directly.
- **Unit tests run on Vitest** (`vitest.config.ts`, jest-style globals, `@/` alias). Tests live next to the code as `src/**/*.test.ts` and are excluded from `tsc`. New logic worth testing follows the same pattern: pure function + test file.
- **DB-backed tests** are named `*.integration.test.ts` and run under plain `npm test`. Pattern (`src/lib/news-aggregator.integration.test.ts`): set `DATABASE_URL` to a fresh file in `os.tmpdir()` at the top of the file, `vi.mock` network/Claude modules, `prisma db push --skip-generate` in `beforeAll`, then import `./db` and the module under test dynamically, delete the file in `afterAll`. Never point a test at the live DB.
- **Balance filtering happens server-side** in `applyBalanceFilter()`, not in the client. The ratios come from `UserPreferences.positiveRatio/neutralRatio/negativeRatio`.
