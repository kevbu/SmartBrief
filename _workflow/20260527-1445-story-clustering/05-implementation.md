# Implementation: Story Clustering — Themen-Aggregation

> Spec: [04-spec.md](04-spec.md)
> Date: 2026-05-27
> Mode: normal
> Status: DONE

## Summary

Extended the existing TopStory infrastructure (Prisma model, Claude analyzer, API route, feed builder, TopStoryCard component) to support bullet points, clickable source article links, source-count ranking, and a 12-hour clustering time window. All 7 spec steps completed; build passes clean.

## Steps Completed

### Step 1 — Prisma Schema: bullets + clusterArticles

**Files modified:**
- `prisma/schema.prisma` — added `bullets String?` and `clusterArticles String?` to `TopStory` model

Migration `20260527185809_add_topstory_bullets` applied successfully.

### Step 2 — TypeScript type: TopStory interface

**Files modified:**
- `src/types/index.ts` — added `bullets?: string[]` and `clusterArticles?: Array<{title: string; source: string; url: string}>` to `TopStory` interface

### Step 3 — Claude prompt: bullets

**Files modified:**
- `src/lib/claude-analyzer.ts` — extended prompt to request `"bullets"` array; updated parsed type; mapped `bullets` (filtered, max 5) and `clusterArticles` (from relatedArticles) in return value

### Step 4 — 12h time filter + persist new fields

**Files modified:**
- `src/lib/news-aggregator.ts` — replaced `take: 100` with `WHERE publishedAt >= now()-12h, take: 200`, with fallback to `take: 100` if fewer than 5 articles found; added `bullets` and `clusterArticles` to `topStory.create` call

### Step 5 — API route: all stories, parse new fields, sort

**Files modified:**
- `src/app/api/news/route.ts` — removed `take: 5`; added parsing for `bullets` and `clusterArticles`; added `.sort((a, b) => b.sources.length - a.sources.length)`

### Step 6 — buildUnifiedFeed: clusters first

**Files modified:**
- `src/app/page.tsx` — replaced interleave logic with: all clusters first (in API order = by source count), then unclustered articles

### Step 7 — TopStoryCard: bullets, source-count badge, article links

**Files modified:**
- `src/components/TopStoryCard.tsx` — added source-count badge ("X Quellen"), replaced summary `<p>` with bullets `<ul>/<li>` (fallback to summary), added cluster article links section with `↗` links opening in new tab

## Tests Added

None — spec specifies no test-cmd (TDD: false). Verification via `npm run build` and manual browser testing.

## Deviations from Spec

None — implementation followed the spec as written.

## Check Results

| Check | Command | Result |
|-------|---------|--------|
| Build / TypeScript | `npm run build` | Pass — `✓ Compiled successfully`, `✓ Generating static pages (23/23)` |
| Lint | (none defined) | N/A |
| Tests | (none defined) | N/A |

Note: Runtime errors for `/api/news` and `/api/recap` during static generation are pre-existing (no database at build time) and unrelated to this change.

## Acceptance Criteria

- [x] Feed shows cluster cards first, sorted by source count (most sources = top)
- [x] Cluster cards show 2–5 bullet points from Claude; fallback to prose summary if bullets absent
- [x] Each cluster card shows "X Quellen" / "1 Quelle" badge in the label row
- [x] Each cluster card shows clickable article links (source · title ↗), max 5, open in new tab
- [x] Unclustered articles appear after all cluster cards as normal ArticleCards
- [x] 12h filter: clustering input uses only articles from last 12 hours (with fallback if < 5)
- [x] `npm run build` exits 0, no TypeScript errors
- [x] Old TopStory rows without bullets/clusterArticles still render (summary fallback)

## Discovered Issues

None.
