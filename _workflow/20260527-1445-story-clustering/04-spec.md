# Feature: Story Clustering — Themen-Aggregation

> Source: Manual request
> Date: 2026-05-27
> Depth: standard

## Context

Kevin's news feed shows one card per article per source. When 5 sources cover the same AI breakthrough, he sees 5 separate cards. He wants the feed to aggregate semantically similar articles from the last 12 hours into topic clusters, ranked by how many sources are covering the topic. Infrastructure (TopStory model, TopStoryCard component, generateTopStories()) already exists and needs surgical extension.

## Requirements

- Feed shows topic clusters first, sorted by source count descending
- Each cluster card shows 2–5 bullet points (not prose summary) with concrete facts
- Each cluster card shows clickable links to the source articles (title + source name, opens in new tab)
- Each cluster card shows a "X Quellen" badge
- Articles not assigned to any cluster appear below clusters as normal ArticleCards
- Clustering uses only articles from the last 12 hours (not all-time)
- Fallback: if a cluster has no bullets (old DB entry), show summary prose

**Out of scope:** Quellen-Logos, manual cluster editing, on-demand re-clustering

## Current State

| Component | File | Current behavior |
|-----------|------|-----------------|
| TopStory model | `prisma/schema.prisma:40-49` | Has `title, summary, category, articleIds, sources, sentiment, createdAt` — no `bullets`, no `clusterArticles` |
| TopStory type | `src/types/index.ts:34-42` | Interface matches schema — no `bullets`, no `clusterArticles` |
| generateTopStories() | `src/lib/claude-analyzer.ts:104-194` | Claude prompt returns summary only; maps `articleIndices` → Article objects for `articleIds`/`sources` |
| news-aggregator.ts | `src/lib/news-aggregator.ts:96-99` | `db.article.findMany({ orderBy: publishedAt desc, take: 100 })` — no time filter |
| /api/news route | `src/app/api/news/route.ts:138-164` | `findMany({ orderBy: createdAt desc, take: 5 })` — capped at 5, no source-count sort |
| buildUnifiedFeed() | `src/app/page.tsx:376-425` | Interleaves cluster cards inline where first cluster article appears in feed |
| TopStoryCard | `src/components/TopStoryCard.tsx` | Shows title + prose summary + source pills. No bullets, no article links, no source-count badge |

**Structural template:** The existing `bullets`/`aiBullets` pattern on `Article` (see `prisma/schema.prisma:21`, `src/app/api/news/route.ts:90-93`) shows how JSON-stringified arrays are stored and parsed.

## Implementation Steps

### Step 1 — Prisma Schema: add bullets and clusterArticles

**Files:** `prisma/schema.prisma` (modify)

Add to the `TopStory` model after the `sentiment` field:
```
bullets         String?   // JSON array of 2-5 bullet strings
clusterArticles String?   // JSON array of {title, source, url} objects
```

After editing, run: `cd /Users/kevinburger/projects/smartbrief && npx prisma migrate dev --name add-topstory-bullets`

---

### Step 2 — TypeScript type: update TopStory interface

**Files:** `src/types/index.ts` (modify)

In the `TopStory` interface (lines 34–42), add after `sources: string[]`:
```typescript
bullets?: string[]
clusterArticles?: Array<{ title: string; source: string; url: string }>
```

---

### Step 3 — Claude prompt: add bullets to generateTopStories

**Files:** `src/lib/claude-analyzer.ts` (modify), `generateTopStories()` function (lines 104–194)

**Prompt change:** extend the JSON schema to include `"bullets"`:
```
"bullets": ["Fact one, max 15 words", "Fact two", ...],
```
Add to the prompt instruction: `"bullets": array of 2-5 concise bullet points, each a concrete fact from the cluster (max 15 words each)`

**Parsed type:** extend the `parsed` array element type:
```typescript
const parsed = JSON.parse(jsonMatch[0]) as Array<{
  title: string
  summary: string
  bullets?: string[]
  category: string
  articleIndices: number[]
  sources: string[]
  sentiment: string
}>
```

**Return mapping:** in the `.map()` at line 173, add:
- `bullets: item.bullets?.filter(Boolean).slice(0, 5) ?? []`
- `clusterArticles: relatedArticles.map(a => ({ title: a.title, source: a.source, url: a.url }))`

The return type `Omit<TopStory, 'id' | 'createdAt'>` must include the new fields — TypeScript will enforce this once Step 2 is done.

---

### Step 4 — 12h time filter in news-aggregator.ts

**Files:** `src/lib/news-aggregator.ts` (modify), lines 95–99

Replace:
```typescript
const recentArticles = await db.article.findMany({
  orderBy: { publishedAt: 'desc' },
  take: 100,
})
```

With:
```typescript
const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000)
let recentArticles = await db.article.findMany({
  where: { publishedAt: { gte: twelveHoursAgo } },
  orderBy: { publishedAt: 'desc' },
  take: 200,
})
// Fallback: if fewer than 5 recent articles, use latest 100 regardless of time
if (recentArticles.length < 5) {
  recentArticles = await db.article.findMany({
    orderBy: { publishedAt: 'desc' },
    take: 100,
  })
}
```

Also update the `topStory.create` call at line 121 to persist the new fields:
```typescript
await db.topStory.create({
  data: {
    title: ts.title,
    summary: ts.summary,
    category: ts.category,
    articleIds: JSON.stringify(ts.articleIds),
    sources: JSON.stringify(ts.sources),
    sentiment: ts.sentiment,
    bullets: JSON.stringify(ts.bullets ?? []),
    clusterArticles: JSON.stringify(ts.clusterArticles ?? []),
  },
})
```

---

### Step 5 — API route: remove take:5, parse new fields, sort by source count

**Files:** `src/app/api/news/route.ts` (modify), lines 138–164

Replace the `topStoriesDb` fetch and mapping block:
```typescript
// OLD: take: 5, no source-count sort
const topStoriesDb = await db.topStory.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
})
```

With:
```typescript
const topStoriesDb = await db.topStory.findMany({
  orderBy: { createdAt: 'desc' },
})

const topStories: TopStory[] = topStoriesDb
  .map((ts) => ({
    id: ts.id,
    title: ts.title,
    summary: ts.summary,
    category: ts.category,
    articleIds: (() => { try { return JSON.parse(ts.articleIds) as string[] } catch { return [] } })(),
    sources: (() => { try { return JSON.parse(ts.sources) as string[] } catch { return [] } })(),
    bullets: (() => { try { return ts.bullets ? JSON.parse(ts.bullets) as string[] : undefined } catch { return undefined } })(),
    clusterArticles: (() => { try { return ts.clusterArticles ? JSON.parse(ts.clusterArticles) as Array<{title:string;source:string;url:string}> : undefined } catch { return undefined } })(),
    sentiment: ts.sentiment as 'positive' | 'neutral' | 'negative',
    createdAt: ts.createdAt,
  }))
  .sort((a, b) => b.sources.length - a.sources.length)
```

---

### Step 6 — buildUnifiedFeed: clusters first, then unclustered

**Files:** `src/app/page.tsx` (modify), `buildUnifiedFeed()` (lines 376–425)

Replace the function body. The new logic:
1. Filter stories by category (same as before)
2. Build `clusteredIds` set from all stories' articleIds
3. Return `[...stories as topStory items, ...articles not in clusteredIds as article items]`

```typescript
function buildUnifiedFeed(articleList: Article[], stories: TopStory[]) {
  const filteredStories =
    activeCategory === 'all'
      ? stories
      : stories.filter((s) => s.category === activeCategory)

  const clusteredIds = new Set(
    filteredStories.flatMap((s) => {
      try {
        return typeof s.articleIds === 'string'
          ? (JSON.parse(s.articleIds) as string[])
          : s.articleIds
      } catch {
        return []
      }
    })
  )

  type FeedItem =
    | { kind: 'article'; article: Article }
    | { kind: 'topStory'; story: TopStory }

  return [
    ...filteredStories.map((story): FeedItem => ({ kind: 'topStory', story })),
    ...articleList
      .filter((a) => !clusteredIds.has(a.id))
      .map((article): FeedItem => ({ kind: 'article', article })),
  ]
}
```

---

### Step 7 — TopStoryCard: bullets, source-count badge, article links

**Files:** `src/components/TopStoryCard.tsx` (modify)

Three additions to the existing card JSX (all within the existing div structure):

**A) Source-count badge** — in the label row alongside "Top Story" badge:
```tsx
<span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
  {story.sources.length} {story.sources.length === 1 ? 'Quelle' : 'Quellen'}
</span>
```

**B) Bullets or summary** — replace the current `<p>{story.summary}</p>` block:
```tsx
{story.bullets && story.bullets.length > 0 ? (
  <ul className="mb-3 space-y-1">
    {story.bullets.map((b, i) => (
      <li key={i} className="flex gap-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
        <span className="mt-0.5 flex-shrink-0 text-gray-400">·</span>
        <span>{b}</span>
      </li>
    ))}
  </ul>
) : (
  <p className="mb-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
    {story.summary}
  </p>
)}
```

**C) Cluster article links** — between bullets/summary and source pills, when `story.clusterArticles` exists:
```tsx
{story.clusterArticles && story.clusterArticles.length > 0 && (
  <div className="mb-3 border-t border-gray-100 dark:border-gray-800 pt-2 space-y-1">
    {story.clusterArticles.slice(0, 5).map((a, i) => (
      <a
        key={i}
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <span className="flex-shrink-0 font-medium">{a.source}</span>
        <span className="text-gray-400">·</span>
        <span className="flex-1 line-clamp-1">{a.title}</span>
        <span className="flex-shrink-0 text-gray-400">↗</span>
      </a>
    ))}
  </div>
)}
```

## Patterns to Follow

- JSON serialization: `JSON.stringify()` on write, `JSON.parse()` on read with try/catch — identical to `articleIds`/`sources` in the existing TopStory code.
- `aiBullets String?` in Article (schema.prisma:21) — same optional JSON-string pattern.
- `clsx()` for conditional classes — already imported in TopStoryCard.

## Acceptance Criteria

- [ ] Feed shows cluster cards first, sorted by source count (most sources = top)
- [ ] Cluster cards show 2–5 bullet points from Claude; fallback to prose summary if bullets absent
- [ ] Each cluster card shows "X Quellen" / "1 Quelle" badge in the label row
- [ ] Each cluster card shows clickable article links (source · title ↗), max 5, open in new tab
- [ ] Unclustered articles appear after all cluster cards as normal ArticleCards
- [ ] 12h filter: clustering input uses only articles from last 12 hours (with fallback if < 5)
- [ ] `npm run build` exits 0, no TypeScript errors
- [ ] Old TopStory rows without bullets/clusterArticles still render (summary fallback)

## Gherkin Impact

No e2e framework in this project. All acceptance criteria route to:

- **Build verification** (TypeScript strict): ACs 7, 8
- **Code inspection** (render logic, JSON guards): ACs 2, 5, 8
- **Manual browser testing**: ACs 1, 2, 3, 4, 5, 6

No `.feature` files to create or modify.

## Workflow Config

| Key | Value |
|-----|-------|
| workflow-dir | _workflow |
| test-cmd | (none) |
| lint-cmd | (none) |
| build-cmd | npm run build |
| e2e-cmd | (none) |
| e2e-framework | (none) |
| tdd | false |
| branch-prefix | (none) |
| base-branch | main |
