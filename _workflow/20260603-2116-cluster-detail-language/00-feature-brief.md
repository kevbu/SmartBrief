# Feature Brief: Cluster Detail Language Consistency

## Feature name
Cluster detail language consistency

## What it does
When opening a cluster's detail sheet, show the cluster's pre-generated, language-correct bullets instead of re-fetching single-article bullets that always come back in English.

## Why it's valuable
`generateTopStories()` already applies a language rule: German-majority clusters get German title/summary/bullets; English-majority clusters get English. But when the user taps a cluster card, `ArticleDetail` ignores those pre-generated bullets and instead calls `GET /api/articles/${ids[0]}?topStoryId=...` — which generates article-level bullets with no language instruction, defaulting to English. The fix is to short-circuit that fetch and use what's already there.

## In scope
- In `ArticleDetail`, when `topStory` is provided and has bullets, use `topStory.bullets` directly and skip the API fetch
- The fix is entirely frontend, no API or DB changes needed

## Out of scope
- Language fix for single-article detail sheets (separate issue, user didn't report it)
- Re-generating cached `aiBullets` that are already stored in English
- Adding language detection to the single-article bullet generation endpoint

## UI changes
Yes — the content rendered in the detail bottom sheet changes (bullets now in correct language), but no layout or visual changes.

## Known constraints
- `TopStory.bullets` is `string[] | undefined` — the `useEffect` should only skip the fetch when `bullets` is non-empty
- The `topStoryId` query param serves a secondary purpose: `ArticleDetail` uses the returned `topStoryArticleIds` to know which article links to render. That logic doesn't go through `bullets` at all, so skipping the fetch for `topStory` is safe as long as we don't rely on the API response for link rendering (we don't — `getTopStoryArticles()` reads from `topStory.clusterArticles` / `topStory.articleIds` directly)
- Cached `aiBullets` that were previously generated in English will still be returned if the user taps on a single article whose first source article had those bullets cached — this is unchanged behavior, not this feature's concern
