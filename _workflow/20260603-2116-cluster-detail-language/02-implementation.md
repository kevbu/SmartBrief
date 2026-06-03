# Implementation: Cluster Detail Language Consistency

## Change made

**`src/components/ArticleDetail.tsx`** — added 4 lines to the `useEffect` (after line 30):

```ts
if (topStory && topStory.bullets && topStory.bullets.length > 0) {
  setBullets(topStory.bullets)
  return
}
```

When a cluster is opened and `topStory.bullets` is non-empty, bullets are set synchronously from the already-language-correct TopStory data. The API fetch is skipped entirely for this case.

## Type check
Pre-existing errors in unrelated files (`customSource` model, `node-cron` types). No new errors introduced.
