# Implementation: Top stories respect filters, saved clusters stay unique, saved items sort by save time

> Spec: [01-spec.md](01-spec.md)
> Date: 2026-11-17
> Branch: `feature/top-stories-saved`

## Summary

All seven spec steps done. New logic lives in pure functions in `src/lib/top-stories.ts` with Vitest coverage. Routes and the refresh path only wire them in.

## Steps Completed

### Step 1: Pure helpers (`src/lib/top-stories.ts`)
- `filterTopStoriesForFeed` (#16): every-source-hidden rule with an empty-sources guard, title `includes` for avoid topics.
- `articleOverlap`, `matchRebuiltClusters` (#29): overlap coefficient, thresholds `REBUILD_MIN_SHARED = 2`, `REBUILD_MIN_COEFFICIENT = 0.6`, greedy one-to-one.
- `sortBySavedAt` (#30): stable, non-mutating, null rows last in input order.
- `parseArticleIds`: shared parser for the JSON column (used by `toTopStory` and the refresh). Drops non-string entries.
- `toTopStory` passes `savedAt` through.

### Step 2: Feed filter (`src/app/api/news/route.ts`)
`filterTopStoriesForFeed(selectCurrentBatch(...).map(toTopStory), hiddenSources, avoidTopics)` before the source-count sort. Reuses the lists the route already lowercases.

### Step 3: Refresh merge (`src/lib/news-aggregator.ts` step 7)
Loads saved rows, runs `matchRebuiltClusters`, then one transaction: `deleteMany(saved: false)`, one `updateMany({ id, saved: true })` per match with new content and `createdAt: batchCreatedAt`, `createMany` for the rest. `saved` and `savedAt` are not in the update data, so they stay.

### Step 4: Schema
`savedAt DateTime?` on `Article` and `TopStory`. Only the `TopStory` block was realigned; `prisma format` was not run on the whole file to keep the diff small.

### Step 5: Save toggles
Both routes compute `nextSaved` and write `savedAt: nextSaved ? new Date() : null`. Response shapes unchanged.

### Step 6: `/api/saved`
Prisma `orderBy` kept as fallback, both lists piped through `sortBySavedAt`. `src/app/saved/page.tsx` unchanged: it renders API order (verified in QA).

### Step 7: Types
Optional `savedAt?: Date | string | null` on `Article` and `TopStory`.

## Tests Added

`src/lib/top-stories.test.ts`: 23 new cases (30 total in the file, 37 in the suite). Covers `parseArticleIds`, `filterTopStoriesForFeed` (all hidden, partial, empty sources, case-insensitive topic, both rules), `articleOverlap`, `matchRebuiltClusters` (growth, single shared article, below and at threshold, best-wins, one-to-one with two saved duplicates, nothing saved), `sortBySavedAt` (order, null fallback, no mutation), `toTopStory` savedAt passthrough.

## Deviations from Spec

- Step 3 uses `updateMany({ where: { id, saved: true } })` instead of `update`. Reason: the saved rows are read before the transaction. If the user unsaves a matched row in that window, `deleteMany` removes it and a plain `update` would throw and abort the whole refresh. `updateMany` affects zero rows instead. Cost: that one rebuilt cluster is missing until the next refresh. Acceptable for a millisecond window.
- `parseArticleIds` added (not in spec) so `toTopStory` and the refresh parse the column the same way.

## Check Results

| Check | Command | Result |
|---|---|---|
| Lint / types | `npx tsc --noEmit` | pass |
| Unit tests | `npm test` | 37/37 pass |
| Build | `npm run build` | pass |

## Acceptance Criteria

| AC | Status |
|---|---|
| AC5, AC6 | Unit tests pass |
| AC7 | Code done; verified in QA with a refresh harness |
| AC1 to AC4, AC8, AC9 | Code done; verified in QA at runtime |
| AC10 | pass |

## Fix Round 1

Source: [04-review.md](04-review.md) findings 1 to 3.

### Issues Addressed
- F1 (MAJOR): `matchRebuiltClusters` now ranks by `shared` desc, then coefficient. New regression test (20-article saved cluster, 2-article fragment vs 14-shared continuation).
- F2 (MINOR): step 7 is one interactive `$transaction(async (tx) => …)`: read saved rows, match, delete unsaved, `update` matches, `createMany` the rest. Supersedes the `updateMany` deviation above.
- F3 (MINOR): a merged row with `savedAt = null` gets `savedAt = <old createdAt>`, so its `/saved` position stays put.

### Verification
- `npx tsc --noEmit` pass, `npm test` 38/38 pass, `npm run build` pass.
- Refresh harness rerun: merge, no-match, legacy pin and all-matched (`createMany` of 0 rows) cases pass.

## Discovered Issues

- `CLAUDE.md` still documents Jest (`node --experimental-vm-modules ... jest`) as `test-cmd`, but the project uses Vitest (`npm test`) since PR #34. `CLAUDE.md` is outside this run's file surface.
