# Spec: Article retention in refresh + DB-backed refreshNews test

> Brief: [00-feature-brief.md](00-feature-brief.md)
> Issues: #31, #37
> Date: 2026-11-17
> UX: skipped (no UI change)
> Written by the orchestrator in the spec-writer format (autonomous run).

## Requirements

- R1: `SMARTBRIEF_RETENTION_DAYS` sets the window in days. Unset or empty: 30. `0`: retention off (no prune, no ingest guard). Non-integer or negative: 30 plus one warning log.
- R2: `cutoff = now - days`. An article is prunable only when all hold: `isSaved = false`, `publishedAt < cutoff`, `fetchedAt < cutoff`, `readAt` is null or `< cutoff`, and its id is in no remaining `TopStory.articleIds`.
- R3: The prune runs inside `refreshNews()` after step 7, and also on the "no new articles" early-return path. Remaining TopStory rows at that point are the saved rows plus the current batch.
- R4: The final article `deleteMany` repeats `isSaved: false`, so a save that lands after selection wins.
- R5: `ArticleFeedback` rows are deleted when their article no longer exists and their `createdAt` is before `min(cutoff, now - 30 days)`. Younger orphans stay until they age out (keeps `effectiveNegativeRatio()` and recap stable).
- R6: `FeedbackSignal`, `SourceWeight`, `TopicWeight`, `NotificationLog` are never touched by retention.
- R7: Step 2 skips RSS items with `publishedAt < cutoff` (dedup decision: a pruned URL that a feed still serves is not re-inserted).
- R8: A prune error is logged and does not fail the refresh.
- R9: Deletes run in chunks of 500 ids (SQLite bound-variable limit).
- R10 (#37): `npm test` runs a Vitest integration test of `refreshNews()` against a fresh SQLite file in the OS temp dir. RSS fetching and both Claude calls are mocked. The real DB is never opened. The file is removed afterwards.

## Implementation Steps

### Step 1: `src/lib/retention.ts` (pure, no DB import)

- `DEFAULT_RETENTION_DAYS = 30`, `FEEDBACK_MIN_RETENTION_DAYS = 30`, `PRUNE_CHUNK_SIZE = 500`.
- `parseRetentionDays(raw: string | undefined): { days: number; valid: boolean }` (R1).
- `retentionCutoff(now: Date, days: number): Date`.
- `feedbackCutoff(now: Date, days: number): Date` returns the earlier of `retentionCutoff(now, days)` and `retentionCutoff(now, 30)` (R5).
- `shouldIngest(publishedAt: Date, cutoff: Date | null): boolean` (R7). Invalid dates are kept (current behaviour).
- `collectProtectedArticleIds(stories: { articleIds: string | null }[]): Set<string>` via `parseArticleIds` from `top-stories.ts`.
- `isPrunable(article, protectedIds, cutoff): boolean` and `selectArticlesToPrune(candidates, protectedIds, cutoff): string[]` (R2).
- `selectOrphanedFeedbackArticleIds(feedbackArticleIds: string[], existingIds: Set<string>): string[]` (deduped).
- `chunk<T>(items: T[], size: number): T[][]` (R9).

Unit tests in `src/lib/retention.test.ts`.

### Step 2: `src/lib/news-aggregator.ts`

- Read the window once at the top of `refreshNews()` (`getRetentionDays()`, warns on invalid). Compute one `cutoff` (or `null` when off) from the refresh start time.
- Step 2 filter: also drop items where `!shouldIngest(r.publishedAt, cutoff)`. Log the skipped count when > 0.
- New `pruneOldArticles(now, days)` (exported for reuse, not routed). Pre-filter candidates in SQL (`isSaved false`, dates `< cutoff`, `readAt` null or `< cutoff`), load all `TopStory.articleIds`, select with the pure function, delete in chunks with `isSaved: false` guard, then sweep orphaned feedback (R5). Wrapped in try/catch (R8). Logs counts.
- Call it before the early `return` in step 6 and between step 7 and step 8 (R3).

### Step 3: Integration test `src/lib/news-aggregator.integration.test.ts`

- Top of file, before any dynamic import: set `process.env.DATABASE_URL = file:<os.tmpdir()>/smartbrief-refresh-<pid>-<ts>.db`, clear `SMARTBRIEF_RETENTION_DAYS`.
- `vi.mock('./news-fetcher')` and `vi.mock('./claude-analyzer')` with `vi.fn()` stubs.
- `beforeAll`: guard that `DATABASE_URL` points into the OS temp dir, run `node_modules/.bin/prisma db push --skip-generate` with that env, then dynamically import `./news-aggregator` and `./db`.
- `beforeEach`: delete all rows in the touched tables, reset mocks, `analyzeSentiment` echoes `routine` for each input.
- `afterAll`: `$disconnect`, remove the `.db` and `.db-journal` files.
- Cases:
  1. Saved cluster survives, rebuilt cluster merges into the saved row (id, `saved`, `savedAt` kept, content and `createdAt` updated), unsaved cluster from the previous batch is replaced, unrelated saved cluster unchanged, new unsaved row shares the batch `createdAt`.
  2. Retention: prunes an old unreferenced article and an old article referenced only by a replaced unsaved cluster. Keeps old saved, old in saved cluster, old in current batch, old but recently read, old but recently fetched, recent. Deletes old orphaned feedback, keeps young orphaned feedback, keeps `FeedbackSignal` and weights. Skips a stale RSS item (ingest guard).
  3. No-new-articles path still prunes and keeps articles of the existing (current) batch.
  4. `SMARTBRIEF_RETENTION_DAYS=0` prunes nothing and ingests stale items.

### Step 4: Config and docs

- `vitest.config.ts`: no change needed unless the integration test needs a longer timeout (set per hook in the file instead).
- `.gitignore`: already ignores `*.db` / `*.db-journal`. No change unless the test needs it.
- `.env.local.example`: document `SMARTBRIEF_RETENTION_DAYS`.
- `CLAUDE.md`: refresh flow step for retention, a "Retention" section, test convention for DB-backed tests.

## Acceptance Criteria

- AC1: R1 parsing covered by unit tests.
- AC2: R2 rule covered by unit tests (each protection on its own).
- AC3: Integration case 1 passes (#37 merge/replace assertions).
- AC4: Integration case 2 passes (R2, R5, R6, R7). R4 is guaranteed by construction (full predicate repeated on delete), not by a test.
- AC5: Integration case 3 passes (R3 early-return path).
- AC6: Integration case 4 passes (R1 off switch).
- AC7: `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run e2e` pass.
- AC8: No file outside the allowed surface changes. No schema change.

## Gherkin Impact

None. No user-observable UI change. Retention is server-side housekeeping and is verified by the integration test. Existing e2e specs (`appearance`, `smoke`) run as a regression gate.

## Risks

- First prune on the live DB deletes a large backlog at once. Mitigation: chunked deletes, `SMARTBRIEF_RETENTION_DAYS=0` kill switch, `deploy-local.sh` takes a `sqlite3 .backup` before each deploy.
- Prisma SQLite `deleteMany` with `in` lists: bounded by chunking.

## GATE 2

Approved autonomously 2026-11-17 09:12. Reason: every requirement traces to #31 or #37, the file surface is within the allowed list, the dedup and feedback decisions are documented with reasons.
