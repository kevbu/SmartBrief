# Review: Story Clustering — Themen-Aggregation

> Spec: [04-spec.md](04-spec.md)
> Implementation: [05-implementation.md](05-implementation.md)
> QA: [06-qa.md](06-qa.md)
> Date: 2026-05-27
> Verdict: **PASS_WITH_NOTES**

## Summary

All 7 implementation steps are correct and complete. The Prisma migration applied cleanly, TypeScript compiles without errors, and every acceptance criterion is satisfied by code inspection. Two minor notes below — neither blocks shipping.

---

## Findings

### MINOR — `typeof s.articleIds === 'string'` check is dead code in buildUnifiedFeed

**Location:** `src/app/page.tsx:386` (`buildUnifiedFeed`)

**What:** The guard `typeof s.articleIds === 'string' ? JSON.parse(...) : s.articleIds` was preserved from the old implementation to handle the case where `articleIds` might arrive as a raw JSON string. Since Step 5 now always parses `articleIds` in the API route before returning the response, `s.articleIds` is always `string[]` by the time it reaches `buildUnifiedFeed`. The guard runs `JSON.parse` on a `string[]` which would throw, but the `try/catch` catches it silently.

**Why it matters:** Not a bug — the try/catch makes it safe and the guard always takes the `s.articleIds` array path since `typeof string[] !== 'string'`. But it's misleading dead code.

**Recommendation (optional):** Simplify to `const ids = s.articleIds` in a follow-up. Not required for this ship.

---

### MINOR — max_tokens may be tight at high cluster count

**Location:** `src/lib/claude-analyzer.ts:149` (`client.messages.create`)

**What:** `max_tokens: 4096`. With bullets added, each cluster now emits ~170 tokens (title + summary + 5 bullets + metadata). At 20 clusters that's ~3400 tokens of content + ~200 tokens of JSON scaffolding = ~3600 tokens total — within the 4096 limit. However if Claude generates verbose bullets or summaries, or if article descriptions are long, responses could be truncated. Truncated JSON causes the `JSON.parse` to throw and `generateTopStories` returns `[]` (silently, via catch block).

**Why it matters:** Low probability in practice, but silent failure means Kevin sees no clusters rather than an error.

**Recommendation:** Bump to `max_tokens: 6000` to give headroom. One-line fix:
```typescript
max_tokens: 6000,
```

---

## Acceptance Criteria Review

| # | Criterion | Code Evidence | Verdict |
|---|-----------|---------------|---------|
| 1 | Feed shows clusters first, sorted by source count | API `.sort((a,b) => b.sources.length - a.sources.length)`; `buildUnifiedFeed` clusters-first | ✓ |
| 2 | 2–5 bullets; fallback to summary | `story.bullets && story.bullets.length > 0` guard; fallback `<p>` branch | ✓ |
| 3 | "X Quellen" badge | Badge element in label row, `story.sources.length === 1 ? 'Quelle' : 'Quellen'` | ✓ |
| 4 | Clickable article links, max 5, new tab | `.slice(0,5)`, `target="_blank"`, `rel="noopener noreferrer"`, `e.stopPropagation()` | ✓ |
| 5 | Unclustered articles appear after clusters | `articleList.filter(a => !clusteredIds.has(a.id))` spread after clusters | ✓ |
| 6 | 12h filter with fallback | `publishedAt: { gte: twelveHoursAgo }`, `if (recentArticles.length < 5)` fallback | ✓ |
| 7 | Build exits 0 | `✓ Compiled successfully` confirmed | ✓ |
| 8 | Old rows without bullets render (fallback) | `story.bullets && story.bullets.length > 0` check handles null/undefined/empty | ✓ |

All 8 acceptance criteria satisfied.

---

## Summary for Fix Mode

No FAIL verdict — no fix round needed. Notes are informational:

1. **MINOR-1 (dead code):** Safe to remove in a follow-up; no behavioral impact.
2. **MINOR-2 (max_tokens):** Easy one-line bump from 4096 → 6000 recommended before shipping to avoid silent cluster-generation failures at high load.
