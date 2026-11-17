# Feature Brief: Top stories respect filters, saved clusters stay unique, saved items sort by save time

> Date: 2026-11-17
> Issues: #16, #29, #30
> Mode: autonomous (no human at the gates; decisions recorded below)

## What it does

Three fixes on the top-story and saved-items path, shipped as one PR:

1. #16: `GET /api/news` drops clusters that consist only of hidden sources or whose title matches an avoid topic.
2. #29: A refresh merges a rebuilt cluster into the saved cluster it continues, so `/saved` never shows the same story twice.
3. #30: `Article` and `TopStory` get `savedAt`. `/api/saved` and `/saved` list the most recently saved items first.

## Why it is valuable

- #16: Hidden sources and avoid topics are personalisation signals. Clusters ignore them today, so a hidden source can still lead the feed.
- #29: Since PR #27, saved clusters survive refresh. The same topic comes back as a new unsaved cluster. Saving it again creates a near-identical duplicate on `/saved`.
- #30: `/saved` sorts by publish date and cluster creation date. A story saved a minute ago can sit at the bottom.

## In scope

- Pure filter function for clusters plus its use in `src/app/api/news/route.ts`.
- Pure matcher for rebuilt clusters plus its use in step 7 of `src/lib/news-aggregator.ts`.
- `savedAt DateTime?` on `Article` and `TopStory` in `prisma/schema.prisma`.
- Save toggle routes set `savedAt` on save and clear it on unsave.
- `GET /api/saved` orders by `savedAt` desc, rows with `savedAt = null` after that in the old order.
- Types in `src/types/index.ts`.
- Unit tests (Vitest) for every new pure function.

## Out of scope

- Partial hidden-source overlap (issue #16 explicitly keeps those clusters).
- Balance ratio enforcement on clusters (issue #16 out of scope).
- Filtering `/saved` by hidden sources or avoid topics. The user saved those items on purpose.
- Backfilling `savedAt` for rows saved before this change. They fall back to the old order.
- Title-similarity matching for #29. Article-id overlap only (see spec).
- UI changes to `/saved` beyond what the new API order gives for free.

## UI changes?

No visible UI change. `/saved` renders in API order, so the new order needs no component change. UX step skipped.

## Known constraints

- Schema change: `prisma db push` runs on deploy (`deploy-local.sh` detects schema changes). Additive nullable columns only, no data loss.
- TopStories are ephemeral except saved rows (CLAUDE.md). The #29 fix touches the only place that writes clusters.
- No e2e framework exists (`e2e/` and `features/` absent, and `e2e/` is outside this run's file surface). QA runs as impl check-results against a throwaway DB on port 3101.
- File surface is restricted (parallel agents). `package.json` and `CLAUDE.md` are off limits.

## GATE 1: decision

Approved autonomously on 2026-11-17. Reason: scope follows the three issue bodies and the caller's brief one to one. The issue #16 rule (drop only if every source is hidden, title match for avoid topics, no intersection with the article list) is taken verbatim.
