# Implementation: Backup export and import

> Spec: [01-spec.md](01-spec.md)

## Files

| File | Change |
|---|---|
| `src/lib/backup.ts` | New. Pure: format constants, types, `buildBackup`, `backupFilename`, `parseArticleIds`, `collectReferencedArticleIds`, `validateBackup`, `coerceRow`, `findSchemaViolation`, `planKeyedUpserts`, `planArticleMerge`, `planTopStoryMerge` |
| `src/lib/backup.test.ts` | New. 32 Vitest tests |
| `src/lib/backup-db.ts` | New. `exportBackup()`, `importBackup()`, `BackupSchemaError`. Field specs and required/non-nullable rules from `Prisma.dmmf` |
| `src/app/api/backup/export/route.ts` | New. `GET`, attachment + `no-store` |
| `src/app/api/backup/import/route.ts` | New. `POST`, 20 MB cap, 400 on parse/validation/schema errors, 500 with a one-line Prisma reason otherwise |
| `src/components/BackupSection.tsx` | New. Export link, Import file picker, live result region |
| `src/app/settings/page.tsx` | +12/-2 lines. New `importVersion` state: the existing preferences `load()` effect depends on it (re-runs after import); `LearnedPreferencesSection` and `NewsletterIngestSection` remount via `key={importVersion}`; `<BackupSection>` after Feed Learning. Kept minimal on purpose: other agents edit this file in parallel |

## Deviations from spec
- R6 article promotion copies only `isSaved` and `saved*` columns (review finding 1). Read state, severity and push bookkeeping of the other machine are not copied onto an existing local article. Spec updated by this note.
- Added after review: pre-transaction schema check (required / non-nullable fields from dmmf) → 400; ratio-sum check on preferences (same rule as `PUT /api/preferences`); duplicate id rejection; weights with identical values count as unchanged and are not written.

## Checks
- `npx tsc --noEmit`: pass
- `npm test`: 46/46 pass (3 files)
- `npm run build`: pass, `/api/backup/export` and `/api/backup/import` are dynamic (ƒ)
