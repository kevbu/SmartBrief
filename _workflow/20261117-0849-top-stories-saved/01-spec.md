# Feature: Top stories respect filters, saved clusters stay unique, saved items sort by save time

> Brief: [00-feature-brief.md](00-feature-brief.md)
> Issues: #16, #29, #30
> Date: 2026-11-17
> UX: skipped (no UI change)

## Context

`GET /api/news` filters articles by `hiddenSources` and `avoidTopics` but returns clusters unfiltered (#16). Refresh step 7 deletes only unsaved clusters (PR #27), so a long-running topic is rebuilt next to its saved copy and can be saved twice (#29). Neither model stores a save time, so `/saved` sorts by publish and creation date (#30).

## Requirements

- R1 (#16): The feed drops a cluster when every entry of `cluster.sources` is a hidden source (case-insensitive). A cluster with at least one visible source stays.
- R2 (#16): The feed drops a cluster when its lowercased title contains any `avoidTopics` entry. Same `includes` logic as the article filter.
- R3 (#16): The cluster filter does not intersect clusters with the article list.
- R4 (#16): A cluster with an empty `sources` array is not dropped by R1.
- R5 (#29): During refresh, a new cluster that continues a saved cluster updates that saved row instead of creating a new row. The saved row keeps its `id`, `saved = true` and `savedAt`. It gets the new content and the new batch `createdAt`, so it shows in the feed as saved.
- R6 (#29): Matching is one-to-one. A saved row absorbs at most one new cluster, and a new cluster merges into at most one saved row.
- R7 (#30): `Article.savedAt` and `TopStory.savedAt` exist as nullable `DateTime`.
- R8 (#30): The save toggle routes set `savedAt = now` on save and `savedAt = null` on unsave.
- R9 (#30): `GET /api/saved` returns articles and stories ordered by `savedAt` desc. Rows with `savedAt = null` come after, in the old order (`publishedAt` desc for articles, `createdAt` desc for stories).

## Current State

- `src/app/api/news/route.ts`: builds `topStories` from `selectCurrentBatch(topStoriesDb).map(toTopStory)` with no preference filter. `hiddenSources` and `avoidTopics` are already parsed and lowercased above.
- `src/lib/news-aggregator.ts` step 7: `$transaction([deleteMany({ saved: false }), createMany(newBatch)])`.
- `src/lib/top-stories.ts`: `toTopStory`, `selectCurrentBatch`. Tests in `top-stories.test.ts` (Vitest, `npm test`).
- Save routes toggle `isSaved` / `saved` only. `/api/saved` orders in Prisma by `publishedAt` / `createdAt`.
- `src/app/saved/page.tsx` renders API order as is.

## Implementation Steps

### Step 1: Pure helpers in `src/lib/top-stories.ts`

- `filterTopStoriesForFeed<T extends { title: string; sources: string[] }>(stories, hiddenSources, avoidTopics): T[]`. Inputs are already lowercased lists. Implements R1, R2, R4.
- `articleOverlap(a: string[], b: string[]): { shared: number; coefficient: number }`. Dedupes both lists. `coefficient = shared / min(|A|, |B|)`, 0 when either list is empty.
- `matchRebuiltClusters(newClusters: { articleIds: string[] }[], saved: { id: string; articleIds: string[] }[]): Map<number, string>`. Maps the index of a new cluster to the id of the saved row it continues. Candidate pair: `shared >= 2` and `coefficient >= 0.6`. Greedy assignment by `shared` desc, then coefficient desc, then input order (deterministic). One-to-one (R6). (Changed in review fix round 1: ranking by coefficient first let a 2-article fragment beat the grown continuation.)
- `sortBySavedAt<T extends { savedAt: Date | null }>(rows: T[]): T[]`. Stable sort. Non-null `savedAt` first, newest first. Null rows keep their input order (R9 fallback).
- `toTopStory` passes `savedAt` through.

### Step 2: Feed filter in `src/app/api/news/route.ts`

Apply `filterTopStoriesForFeed` after `toTopStory`, before the source-count sort. No other change.

### Step 3: Refresh merge in `src/lib/news-aggregator.ts` step 7

Inside one interactive transaction (fix round 1), load saved rows and compute `matchRebuiltClusters`. Then:
1. `deleteMany({ saved: false })` (unchanged).
2. One `update` per matched saved row with the new title, summary, category, articleIds, sources, sentiment, bullets, clusterArticles and `createdAt: batchCreatedAt`. Leave `saved` and `savedAt` untouched.
3. `createMany` for the unmatched clusters only.
Log the merge count.

### Step 4: Schema

Add `savedAt DateTime?` to `Article` and `TopStory`. Run `prisma generate` locally. No migration files (project uses `db push`).

### Step 5: Save toggle routes

- `src/app/api/articles/[id]/save/route.ts`: `data: { isSaved: next, savedAt: next ? new Date() : null }`.
- `src/app/api/top-stories/[id]/save/route.ts`: same for `saved`. Response shape unchanged.

### Step 6: `/api/saved` order

Keep the Prisma `orderBy` (it supplies the fallback order) and wrap both result lists in `sortBySavedAt`. `/saved` page needs no change, it renders API order. Verify only.

### Step 7: Types

`Article.savedAt?: Date | string | null`, `TopStory.savedAt?: Date | string | null` in `src/types/index.ts`. Optional, so `generateTopStories` return type and existing callers compile unchanged.

## Patterns to Follow

- Pure function + Vitest test, as `selectCurrentBatch` (CLAUDE.md: "New logic worth testing follows the same pattern").
- Lowercased preference lists are parsed once in the route; reuse them.
- Single `db` singleton from `src/lib/db.ts`.

## Decisions

### D1 (#29): Merge the rebuilt cluster into the saved row, matched by article-id overlap

Options considered:

| Option | Effect on `/saved` | Effect on feed | Cost |
|---|---|---|---|
| A. Update the saved row in place with the rebuilt content (chosen) | One entry, content stays current | Rebuilt cluster shows as saved, unsave works | Pure matcher + one `update` per match, no schema change |
| B. Mark the new cluster saved, keep the old one | Still two entries | Shows as saved | Does not fix the bug |
| C. Mark the new cluster saved, delete the old saved row | One entry, but `savedAt` and id are lost | Shows as saved | Deletes user data automatically |
| D. Link the new cluster to the saved one (`savedParentId`) | One entry if the page dedupes | Needs UI logic | Extra column, more moving parts |

Chosen: A. It is the only option that fixes the duplicate without deleting a saved row or adding a column. The saved row keeps its id and `savedAt`, so the `/saved` order (#30) stays stable.

Matching rule: overlap coefficient on `articleIds` (`shared / min(|A|, |B|)`) of at least 0.6, with at least 2 shared articles. Reason: a long-running story grows between refreshes. A saved 3-article cluster rebuilt as a 10-article cluster with the same 3 articles has a Jaccard of 0.3 but an overlap coefficient of 1.0. The floor of 2 shared articles stops a single shared article from merging two unrelated 2-article clusters.

Trade-off accepted: the saved row shows the latest version of the story, not the snapshot from save time. A story whose articles all age out of the 12-hour window no longer matches; the next rebuild then appears as a new unsaved cluster. That is a new chapter of the story and acceptable. Title similarity is not used: titles are LLM-generated and vary between runs, article ids are deterministic.

### D2 (#30): Sort in JS, not in Prisma `nulls: 'last'`

The sort is a pure, tested function. The lists are small (bookmarks). Prisma `orderBy` stays as the fallback order for null rows.

### D3 (#16): Empty `sources` is not "every source hidden"

`[].every(...)` is `true` in JS. A cluster without sources must not vanish because of that.

## Acceptance Criteria

- AC1: A feed cluster whose sources are all hidden is absent from `/api/news`. (R1)
- AC2: A feed cluster with one hidden and one visible source is present. (R1)
- AC3: A feed cluster whose title contains an avoid topic (any case) is absent. (R2)
- AC4: Cluster filter does not depend on the article list; a cluster whose articles are all read or filtered still shows. (R3)
- AC5: Unit tests cover the filter, including empty sources. (R4)
- AC6: Unit tests cover `matchRebuiltClusters`: growth case matches, single shared article does not, one-to-one assignment, best match wins. (R5, R6)
- AC7: Refresh code updates matched saved rows with the batch `createdAt` and creates only unmatched clusters; saved flag and `savedAt` untouched. (R5)
- AC8: Saving sets `savedAt`; unsaving clears it, for both articles and stories. (R8)
- AC9: `/api/saved` lists the most recently saved item first; null `savedAt` rows follow in old order. (R9)
- AC10: `npx tsc --noEmit`, `npm run build`, `npm test` pass.

## Gherkin Impact

None. No `features/` or `e2e/` tree exists, and `e2e/` is outside this run's file surface. AC1 to AC4, AC8 and AC9 are verified as impl check-results against a throwaway DB on port 3101. AC5, AC6 and AC7 are unit tests plus code check (a real refresh needs RSS and Claude).

## Workflow Config

```
lint-cmd: npx tsc --noEmit
test-cmd: npm test   (CLAUDE.md still names the old jest command; Vitest replaced it in PR #34)
build-cmd: npm run build
```

## GATE 2: decision

Approved autonomously on 2026-11-17. Reason: every requirement traces to an issue body; D1 is the design call the caller delegated, with options and trade-offs recorded above.
