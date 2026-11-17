# Review: Top stories respect filters, saved clusters stay unique, saved items sort by save time

> Spec: [01-spec.md](01-spec.md) · Implementation: [02-implementation.md](02-implementation.md) · QA: [03-qa.md](03-qa.md)
> Date: 2026-11-17
> Reviewer: independent subagent, given the diff and spec only (not the implementer's conclusions)
> Round 1 verdict: PASS_WITH_NOTES (1 MAJOR, 2 MINOR)
> After fix round 1: PASS

## Verified sound

- Step 7 stays atomic. A failed write rolls back delete, updates and creates. An empty `createMany` is fine.
- A merged row gets the exact `batchCreatedAt`, so `selectCurrentBatch` includes it. An unmatched saved row keeps its old `createdAt` and stays off the feed (previous behaviour).
- Merge never writes `saved` or `id`. Matching is one-to-one.
- `filterTopStoriesForFeed` follows #16 exactly: every-source rule with empty guard, title-only `includes`, no intersection with the article list. The off-topic feedback route feeds `avoidTopics` with title prefixes, so clusters now honour that signal too.
- Save toggles set and clear `savedAt` for both models. Response shapes unchanged.
- `sortBySavedAt` is stable, null rows last, non-mutating.
- Schema change is additive and nullable. `deploy-local.sh` runs `prisma db push` on schema change; no data-loss flag needed.
- Other consumers (`page.tsx` `buildUnifiedFeed`, `ArticleDetail`, `articles/[id]?topStoryId`, top-story feedback route, `/saved` related articles) are unaffected: ids stay stable, `articleIds` stays a JSON string. Breaking news and recap do not read `TopStory`.

## Findings

| # | Severity | Location | Finding | Resolution |
|---|---|---|---|---|
| 1 | MAJOR | `src/lib/top-stories.ts` `matchRebuiltClusters` sort | Ranking by coefficient first lets a small fragment (always 1.0) beat the grown continuation. Saved S = 20 articles; new A = 2 of them (1.0); new B = 14 of them + 10 new (0.7). A overwrote S, B came back as an unsaved duplicate. | Fixed: rank by `shared` desc, coefficient as tie-break. Regression test "prefers the grown continuation over a small fragment" added. |
| 2 | MINOR | `src/lib/news-aggregator.ts` step 7 | Saved rows were read outside the transaction. An unsave in that window made `updateMany` hit 0 rows; the cluster was neither merged nor created. | Fixed: interactive `$transaction(async (tx) => …)` covers read, match and writes. Plain `update` again. |
| 3 | MINOR | step 7 + `/api/saved` | A merged legacy row (`savedAt` null) gets its `createdAt` bumped, so its fallback position on `/saved` jumps on every merge. | Fixed: on merge, a null `savedAt` is pinned to the row's old `createdAt`. Verified in the refresh harness. |

## Fix round 1 verification

- `npx tsc --noEmit` pass, `npm test` 38/38 pass, `npm run build` pass.
- Refresh harness rerun (real `refreshNews()`, mocked RSS and Claude, throwaway DB): merge, no-match and legacy-pin cases pass; an all-matched refresh (`createMany` with 0 rows) passes.

## GATE 3: decision

Approved autonomously on 2026-11-17. Reason: all three findings fixed and re-verified; no open BLOCKER or MAJOR. Ship.
