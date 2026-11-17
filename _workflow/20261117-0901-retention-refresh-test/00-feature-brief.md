# Feature Brief: Article retention + DB-backed refresh test

> Issues: #31 (retention), #37 (refreshNews integration test)
> Date: 2026-11-17
> Mode: autonomous (no human at the gates, decisions recorded below)

## What it does

Every refresh prunes old, unprotected articles from the DB. A Vitest integration test runs `refreshNews()` against a throwaway SQLite DB and pins the cluster replace/merge logic and the new retention step.

## Why it matters

- The `Article` table grows without bound. No pruning exists today (#31).
- `refreshNews()` step 7 (delete unsaved, merge rebuilt into saved, create) has only pure-function coverage. Adding retention to the same path without a DB-backed test is risky (#37).

## Current state (explored)

- `src/lib/news-aggregator.ts`: steps 1-8. Step 2 dedups by URL (`findMany` existing + `createMany`, not upsert). Step 6 returns early when no new articles arrived. Step 7 is an interactive transaction.
- Article references: `TopStory.articleIds` (JSON string, no FK), `ArticleFeedback.articleId`, `FeedbackSignal.articleId` (no FK on either). `NotificationLog.storyId` holds an article id but is a history log.
- `ArticleFeedback` consumers: `effectiveNegativeRatio()` (counts `too-negative` in the last 30 days), `/api/recap` (feedback in the last N days, default 7), per-article feedback routes.
- `FeedbackSignal` has its own 90-day cleanup (`runSignalCleanupIfNeeded`). `SourceWeight` / `TopicWeight` do not reference articles.
- Feed (`/api/news`) reads the newest 500 by `publishedAt`, so very old rows are effectively invisible already.
- Tests: Vitest, `src/**/*.test.ts`, no DB-backed test yet.

## In scope

- Pure retention module `src/lib/retention.ts` (+ unit tests): window parsing, cutoff, protected-id collection, prune selection, orphaned-feedback selection.
- Retention step in `refreshNews()`, on both the normal path and the "no new articles" early-return path. Never fails the refresh.
- Ingest guard in step 2: skip incoming RSS items published before the cutoff (dedup decision, see below).
- `ArticleFeedback` cleanup for pruned articles.
- Integration test `src/lib/news-aggregator.integration.test.ts` on a throwaway SQLite file.
- Docs: `CLAUDE.md` (retention + test convention), `.env.local.example` (`SMARTBRIEF_RETENTION_DAYS`).

## Out of scope

- UI setting for the retention window.
- `VACUUM` / file-size reclaim. SQLite reuses freed pages, the file does not shrink.
- Age guard for newsletter ingest (`imap-poller`, `/api/ingest/newsletter`). Those rows are still pruned by the same rule on the next refresh.
- Schema changes (none needed: no FKs, all fields exist).

## UI changes

No. UX step skipped.

## Decisions (self-approved)

| Topic | Decision | Reason |
|---|---|---|
| Window | 30 days. `SMARTBRIEF_RETENTION_DAYS` overrides. `0` disables. Invalid values fall back to 30 with a warning | Issue suggestion. `0` is a cheap kill switch for the live DB. |
| Age rule | Prune only if `publishedAt`, `fetchedAt` and `readAt` (if set) are all before the cutoff | Never delete a row fetched or read inside the window. Protects recap ("read in last N days") and avoids insert-then-delete. |
| Protected | `isSaved`, and any id in any remaining `TopStory.articleIds` (saved rows + current batch) | Prune runs after step 7, so the remaining rows are exactly saved + current batch. On the early-return path the existing unsaved rows are the current batch. |
| Dedup | Step 2 skips RSS items with `publishedAt` before the cutoff | Without it, a pruned URL that a feed still serves comes back as a "new" row, costs a Haiku call, and is pruned again next refresh. An item re-served with a fresh `publishedAt` is re-inserted as new, which is correct. |
| ArticleFeedback | Delete rows whose article no longer exists and whose `createdAt` is older than max(window, 30 days) | No FK, so no cascade. `effectiveNegativeRatio()` counts the last 30 days of feedback. Deleting younger rows would shift learned behaviour. |
| FeedbackSignal, weights | Untouched | Learned state. Has its own 90-day cleanup. |
| Failure mode | Prune errors are logged, refresh still succeeds | Retention is housekeeping. |
| Concurrency | Final `deleteMany` repeats `isSaved: false` | A save between selection and delete must win. |

## GATE 1

Approved autonomously 2026-11-17 09:05. Reason: scope matches both issues, stays inside the allowed file surface, no schema change.
