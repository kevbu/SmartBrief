# Implementation: Article retention + DB-backed refresh test

> Spec: [01-spec.md](01-spec.md)
> Date: 2026-11-17

## Files

| File | Change |
|---|---|
| `src/lib/retention.ts` | New. Pure: `parseRetentionDays`, `retentionCutoff`, `feedbackCutoff`, `shouldIngest`, `collectProtectedArticleIds` (returns `{ ids, unparseable }`), `isPrunable`, `selectArticlesToPrune`, `selectOrphanedFeedbackArticleIds`, `chunk`. |
| `src/lib/retention.test.ts` | New. 22 unit tests. |
| `src/lib/news-aggregator.ts` | Window read once per refresh (`getRetentionDays`, warns once on invalid). Step 2 ingest guard. New exported `pruneOldArticles(now, days)`. Called on the early-return path and after step 7. |
| `src/lib/news-aggregator.integration.test.ts` | New. 8 DB-backed tests of `refreshNews()`. |
| `CLAUDE.md` | Refresh flow corrected (step 2 was documented as upsert), retention section, DB-backed test convention. |
| `.env.local.example` | `SMARTBRIEF_RETENTION_DAYS`. |

Not changed: `vitest.config.ts` (default `include` already matches, isolation default is fine), `.gitignore` (`*.db*` already ignored, and the test DB lives in `os.tmpdir()`), schema, `package.json`.

## Notes

- `pruneOldArticles` reuses one `prunableWhere` object for the candidate query and every chunked `deleteMany`. A save or read that lands between selection and delete wins.
- Fail closed: if any `TopStory.articleIds` is non-empty and not a JSON array, the prune is skipped with a warning.
- Feedback sweep: `ArticleFeedback` rows older than `feedbackCutoff` whose article no longer exists. Uses `distinct` + chunked existence lookup, no raw SQL (Prisma stores SQLite DateTime as epoch ms, raw comparisons would be fragile).
- Integration test isolation: `DATABASE_URL` set at module top, before the dynamic import of `./db`. Two guards: env string check and `PRAGMA database_list` on the live connection (realpath compare). `globalThis.prisma` cleared before import. File plus `-journal/-wal/-shm` removed in `afterAll`.
- Prisma model delegates are not stable `vi.spyOn` targets (fresh object per access). Error injection uses a temporary SQLite trigger (`RAISE(ABORT)`) instead.

## Checks

- `npx tsc --noEmit`: pass
- `npm test`: 4 files, 68 tests pass (~1 s)
- `npm run build` (throwaway `DATABASE_URL` in scratchpad): pass
- Mutation checks (manual, reverted): `deleteMany({})` in step 7, dropping the cluster protection, dropping the post-step-7 prune call. Each one fails at least one test.
