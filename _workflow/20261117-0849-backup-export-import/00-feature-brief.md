# Feature Brief: Backup export and import

> Issue: #32 · Mode: autonomous (no human at gates) · Date: 2026-11-17

## What it does
Exports preferences, learned weights and saved items as one versioned JSON file, and imports that file again with an idempotent, non-destructive merge.

## Why it's valuable
The SQLite file backups from `deploy-local.sh` only help on the same machine. A JSON file is a portable backup, for example when moving SmartBrief to another machine or rebuilding the DB.

## Current state (verified)

| Area | Finding |
|---|---|
| Preferences | Single `UserPreferences` row, id `default` |
| Learned weights | `SourceWeight` (unique `source`), `TopicWeight` (unique `topic`). ids are cuids, differ per machine |
| Saved articles | `Article.isSaved = true`. `url` is unique, id is a cuid |
| Saved stories | `TopStory.saved = true`. `articleIds` is a JSON string of `Article.id` values. Unsaved rows are deleted on refresh |
| Feed batch | `selectCurrentBatch()` in `src/lib/top-stories.ts` treats the newest `TopStory.createdAt` as the current batch, saved rows included |
| Secrets | `AppState` (VAPID keys), `PushSubscription`, IMAP env vars. None live in the exported tables |
| Auth | `src/proxy.ts` matcher covers all paths except static assets; only `/login` and `/api/auth/*` are public |
| Tests | Vitest (`npm test`), `src/**/*.test.ts` |

## In scope
1. `GET /api/backup/export`: JSON download (`Content-Disposition: attachment`), format `smartbrief-backup`, version 1. Contains the whole Prisma rows of `UserPreferences`, `SourceWeight`, `TopicWeight`, saved `Article`, saved `TopStory`, and the articles those stories reference.
2. `POST /api/backup/import`: validates format and version, merges in one transaction, never deletes. Returns counts per table.
3. Settings page: "Backup" section with Export and Import buttons.
4. Pure functions in `src/lib/backup.ts` with Vitest tests: serialize, validate, row coercion, merge planning.

## Out of scope
- Feedback log (`FeedbackSignal`, `ArticleFeedback`), events, notification log, custom RSS sources.
- Scheduled or automatic exports.
- Restore that replaces (deletes) existing data.
- Secrets: VAPID keys, push subscriptions, IMAP credentials, `AppState`.

## UI changes
Yes, small. One new section on `/settings`.

## Known constraints
- Forbidden files: `prisma/schema.prisma`, `src/types/index.ts`, `package.json`, `src/app/api/news/**`, `src/app/api/saved/**`, `src/lib/top-stories.ts`. Types live in `src/lib/backup*.ts`.
- Other agents may add columns in parallel (e.g. `savedAt`). Copy rows generically. Use the runtime Prisma schema (`Prisma.dmmf`) to drop unknown fields and revive DateTime fields on import.
- Article ids differ between machines for the same URL. Saved stories must have their `articleIds` remapped to local ids.

## Gate 1 decision
Approved by orchestrator (autonomous mode). Reason: scope matches issue #32 and the caller's brief; the file surface stays inside the allowed list.
