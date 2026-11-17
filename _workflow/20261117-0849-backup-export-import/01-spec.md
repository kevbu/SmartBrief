# Spec: Backup export and import

> Brief: [00-feature-brief.md](00-feature-brief.md) · UX: [00-ux-design.md](00-ux-design.md) · Issue #32

## Context
Portable JSON backup of preferences, learned weights and saved items. Export downloads a file. Import merges it into the current DB without deleting anything.

## Requirements
- R1 `GET /api/backup/export` returns JSON with `Content-Disposition: attachment; filename="smartbrief-backup-YYYY-MM-DD.json"` and `Cache-Control: no-store`.
- R2 File shape: `{ format: "smartbrief-backup", version: 1, exportedAt, data: { preferences, sourceWeights, topicWeights, savedArticles, savedTopStories, referencedArticles } }`. Rows are whole Prisma rows (no field list in code).
- R3 `referencedArticles` = articles whose id appears in a saved story's `articleIds` and that are not already in `savedArticles`.
- R4 No secrets: only the five allow-listed models are read. `AppState`, `PushSubscription`, env vars never enter the file.
- R5 `POST /api/backup/import` takes the file as JSON body. Rejects: body > 20 MB (413), invalid JSON (400), wrong `format` (400), version not an integer in `1..BACKUP_VERSION` (400, newer version gets its own message), malformed sections or rows (400).
- R6 Merge, all inside one interactive transaction, never deletes:
  - Preferences: upsert id `default` with the backup values. `pushEnabled` is skipped (device-bound, needs a push subscription on this device).
  - Weights: upsert by natural key (`source` / `topic`), not by cuid. Backup value wins.
  - Articles: match by `url`. Existing + backup saved + local not saved → update (row minus `id`, `url`). Existing otherwise → unchanged. New → create with the backup id (fresh id only if that id is taken by another URL).
  - Top stories: `articleIds` remapped from backup ids to local ids. Existing id + local not saved → update to saved. Existing id + saved → unchanged. New → create with `saved: true`. A created story's `createdAt` is clamped to just before the newest local `TopStory.createdAt`, so it never becomes the feed's "current batch" (`selectCurrentBatch`).
  - Re-importing the same file creates nothing new.
- R7 Row coercion uses the runtime Prisma schema (`Prisma.dmmf`): unknown fields are dropped (backup from a newer schema), DateTime strings are revived to `Date`, values of the wrong scalar type are dropped. New columns flow through without code changes.
- R8 Response: `{ success: true, counts: { preferences, sourceWeights, topicWeights, articles, topStories } }`, each `{ created, updated, unchanged }`.
- R9 Settings "Backup" section: Export link + Import file picker, states per UX doc. After import the page reloads preferences and remounts the Feed Learning section.
- R10 Both routes are behind `src/proxy.ts` (no change needed; matcher covers `/api/backup/*`).

## Implementation Steps
1. `src/lib/backup.ts` (pure, no Prisma import): constants, types, `buildBackup`, `collectReferencedArticleIds`, `validateBackup`, `coerceRow`, `planArticleMerge`, `planTopStoryMerge`, `planKeyedUpserts`, `backupFilename`.
2. `src/lib/backup.test.ts`: Vitest tests for every function above, incl. secret-key absence, version rejection, id remap, idempotency, clamp.
3. `src/lib/backup-db.ts`: `exportBackup()` and `importBackup(backup)` using `db` and `Prisma.dmmf` field specs.
4. `src/app/api/backup/export/route.ts`, `src/app/api/backup/import/route.ts`: thin handlers, `dynamic = 'force-dynamic'`, error shape `{ success: false, error }` like other routes.
5. `src/components/BackupSection.tsx`: client component, `onImported` callback.
6. `src/app/settings/page.tsx`: lift `load()` to `loadPreferences`, add `<BackupSection>` after Feed Learning, remount `LearnedPreferencesSection` via `key`.

## Decisions
- D1 Natural keys over ids for weights and articles: cuids differ per machine, `source`/`topic`/`url` do not.
- D2 Backup wins for preferences and weights. Articles and stories are only promoted to saved, never unsaved.
- D3 `pushEnabled` not imported (coupled to `PushSubscription`, which is excluded).
- D4 Clamp imported story `createdAt` instead of changing `selectCurrentBatch` (forbidden file, and the clamp keeps the import self-contained).
- D5 One interactive transaction (timeout 60 s): an invalid row aborts the whole import, no partial state.

## Acceptance Criteria
- AC1 Export returns 200, attachment header, valid JSON with format/version and the six sections.
- AC2 Export file contains no `vapidPublic`, `vapidPrivate`, `p256dh`, `auth`/`endpoint` keys or IMAP values.
- AC3 Import of an export into an empty DB restores preferences, weights, saved articles, saved stories (with resolvable `articleIds`).
- AC4 Re-import of the same file creates 0 rows and deletes nothing.
- AC5 Import into a DB that has the same article URL under another id remaps the story's `articleIds` to the local id.
- AC6 Invalid JSON, wrong format, newer version → 400 with a message; DB unchanged.
- AC7 Unknown extra columns in the file are ignored; DateTime fields round-trip.
- AC8 Settings shows the Backup section; Export downloads; Import shows counts or an error.
- AC9 `npx tsc --noEmit`, `npm run build`, `npm test` pass.

## Gherkin Impact
None. `e2e/` is outside this run's file surface. QA verifies via HTTP calls against a dev server on a throwaway DB plus a browser check of the settings section.

## Gate 2 decision
Approved by orchestrator (autonomous mode). Reason: approach is generic (dmmf-driven), non-destructive, and inside the allowed file surface. Risk (DB writes) is covered by the transaction, unit tests, QA and review.
