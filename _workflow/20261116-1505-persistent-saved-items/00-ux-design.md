# UX Design: Saved page with stories and articles

Scope is small. Only `/saved` changes visibly. The feed's bookmark icon on top stories now reflects the stored state after a reload.

## User flow

1. Feed (`/`) → tap bookmark on a `TopStoryCard` or `ArticleCard` → icon fills (optimistic, as today).
2. Reload or next refresh → the icon stays filled (new: feed returns `saved` for top stories).
3. Bottom nav "Saved" (`/saved`) → page lists:
   - Section "Stories" (only if ≥1 saved top story): `TopStoryCard` list, newest first.
   - Section "Articles" (only if ≥1 saved article): `ArticleCard` list, newest saved first (by `publishedAt` desc; no `savedAt` column exists).
4. Tap a card → `ArticleDetail` modal (`topStory` or `article` mode, same as feed).
5. Tap bookmark on a card in `/saved` → card leaves the list (optimistic), server toggles.

## States

| State | Shows |
|---|---|
| Loading | `LoadingSpinner` centered (as today) |
| Empty (0 stories, 0 articles) | Existing `EmptyState` "Nothing saved yet" (unchanged copy) |
| Only one kind | Only that section, with its heading |
| Both | "Stories" section first, then "Articles" |
| Error | Same as today: logged, empty state shown. No new error UI (out of scope) |

Subtitle: `N saved` where N = stories + articles, e.g. "3 saved". Keep "Your bookmarked articles" → change to "Your bookmarks" for loading/empty.

## Primitives to reuse

- `src/components/PageHeader.tsx` — `PageHeader`, `EmptyState`, `EmptyIcons.bookmark`
- `src/components/TopStoryCard.tsx` — props `story`, `onSelect`, `onToggleSave`, `isSaved` (always `true` here). No `onFeedback` on `/saved`.
- `src/components/ArticleCard.tsx` — as today
- `src/components/ArticleDetail.tsx` — `article` / `topStory` / `allArticles`. For a saved top story, pass the saved articles plus the cluster articles returned by `/api/saved` so the detail view can resolve `articleIds`.
- `src/components/LoadingSpinner.tsx`
- Section heading: copy settings pattern `<h2 className="headline mb-1 text-lg font-semibold">`, wrapped with page side padding (`px-4`), since cards carry `mx-4`.

## New primitive needed?
No.

## Accessibility
- Each section is a `<section aria-labelledby>` with its `<h2>`.
- Bookmark buttons already have `aria-pressed` and accessible names in both cards.
- Removing a card on unsave: no live region today; keep parity (out of scope).

## Constraints
- Theme tokens only (`text-ink-*`, `bg-card`, etc.). No new colors. Do not touch theme/dark-mode code (other session).
- Single `'use client'` page pattern, data via `fetch`.

## Open questions
None blocking. `savedAt` ordering deferred (no column; would need schema change).
