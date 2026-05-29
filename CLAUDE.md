# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Config

```
workflow-dir: _workflow
lint-cmd: npx tsc --noEmit
test-cmd: node --experimental-vm-modules node_modules/.bin/jest src/lib/importance-score.test.ts
build-cmd: npm run build
branch-prefix: feature/
base-branch: main
```

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # prisma generate + next build
npm run db:push      # Apply schema changes to SQLite (run after editing prisma/schema.prisma)
npm run db:studio    # Open Prisma Studio GUI

# Run the single test file
node --experimental-vm-modules node_modules/.bin/jest src/lib/importance-score.test.ts
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
      2. db.article.upsert per URL          — dedup by URL
      3. claude-analyzer.analyzeSentiment() — Haiku 4.5, batches of 20
      4. claude-analyzer.generateTopStories() — Sonnet 4.6, 12-hour window
      5. db.topStory.deleteMany + createMany — replaces all clusters each refresh
  → piggybacked (fire-and-forget): IMAP poll + breaking-news detection
```

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
SQLite file at `DATABASE_URL` (default: `file:/app/data/smartbrief.db` in Docker). Key models: `Article`, `TopStory`, `UserPreferences` (single row, id=`"default"`), `SourceWeight`, `TopicWeight`, `FeedbackSignal`, `ArticleFeedback`. `AppState` tracks last-refreshed timestamps and VAPID keys.

### Deployment
GitHub Actions (`.github/workflows/docker-publish.yml`) builds and pushes to `ghcr.io/kevbu/smartbrief:latest` on every push to `main`. Watchtower on the VPS polls GHCR every 5 minutes and auto-updates the running container. The container entrypoint runs `npx prisma db push && npm start` — schema migrations happen automatically on deploy.

## Key conventions

- **All preferences live in a single DB row** (`UserPreferences` id=`"default"`). Arrays (categories, sources, topics) are stored as comma-separated strings and parsed/serialized at the API boundary.
- **TopStories are ephemeral** — `deleteMany` + `createMany` on every refresh. Don't store business logic that depends on TopStory persistence across refreshes (except the `saved` flag).
- **`src/lib/db.ts`** exports a singleton `db` (Prisma client). Use this everywhere; don't instantiate PrismaClient directly.
- **No test infrastructure beyond the one file** (`importance-score.test.ts`). New logic worth testing follows the same pattern: pure function + Jest.
- **Balance filtering happens server-side** in `applyBalanceFilter()`, not in the client. The ratios come from `UserPreferences.positiveRatio/neutralRatio/negativeRatio`.
