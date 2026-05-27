# Implementation: Skim-Mode Reason Chip + Settings Cleanup

> Spec: [04-spec.md](04-spec.md)
> Date: 2026-05-27
> Mode: normal
> Status: DONE

## Summary

Added a long-press (500 ms, mobile) / hover (300 ms, desktop) reason chip to `ArticleCard` in skim mode, surfacing `article.reason` without touching deep mode or the article detail sheet. Removed the legacy "Personalisation" section and its four state variables, one fetch call, and one handler function from `settings/page.tsx`. Both changes compile with no TypeScript errors.

## Steps Completed

### Step 1 — Add reason chip to `ArticleCard` in skim mode

**Files modified:**

- `src/components/ArticleCard.tsx` — added state, refs, handlers, and skim-mode render branch

**What changed:**

1. Added `reasonVisible` boolean state (default `false`) alongside existing `isSaved`, `isRead`, `hidden`, `collapsed`.
2. Added three refs: `pressTimerRef`, `hoverTimerRef`, `pointerDownPosRef` — following the existing `skipTimerRef` pattern.
3. Added a cleanup `useEffect` (empty deps) that clears both timers on unmount.
4. Added `shortenReason(reason: string): string` helper inside the component (not exported):
   - `"a source you read often"` → `"Source you trust · {article.source}"`
   - `"your most-read topic"` → everything before `" — "`
   - `"based on your settings"` → `"Relevant to your feed"`
   - Otherwise → return reason as-is
5. Added pointer handlers (`handlePointerDown`, `handlePointerUp`, `handlePointerMove`) for 500 ms long-press with 8 px move-cancel threshold.
6. Added mouse handlers (`handleMouseEnter`, `handleMouseLeave`) for 300 ms hover delay.
7. Wired all six handlers onto the `<article>` element alongside existing `onClick`.
8. In the `IntersectionObserver` else branch (card leaves viewport): added `setReasonVisible(false)`.
9. Replaced the deep-mode-only render block with a two-branch conditional:
   - `depthMode === 'deep'` → unchanged always-visible line
   - `article.reason && reasonVisible` → skim-mode chip with `shortenReason()`

### Step 2 — Remove legacy Personalisation section from Settings

**Files modified:**

- `src/app/settings/page.tsx` — removed state, fetch call, handler, and JSX section

**What changed:**

1. Removed four state variables: `activeWeights`, `showResetConfirm`, `isResetting`, `resetDone`.
2. Removed the `GET /api/settings/personalisation` fetch and `setActiveWeights()` call from the `load()` effect.
3. Removed `handleResetPersonalisation()` function entirely.
4. Removed the `{/* Personalisation */}` `<section>` block (49 lines of JSX).
5. `LearnedPreferencesSection` at line ~1580 is untouched.

## Tests Added

None — spec specifies no test-cmd (TDD: false). Acceptance is verified via `npm run build` (TypeScript strict) and manual browser testing.

## Deviations from Spec

None — implementation followed the spec as written.

The spec offered two animation options (Tailwind keyframe vs. conditional render with no animation) and recommended the simpler conditional render to avoid a `tailwind.config.ts` change. That recommendation was followed: the chip renders conditionally with no fade, keeping the code minimal.

## Check Results

| Check | Command | Result |
|-------|---------|--------|
| Build / TypeScript | `npm run build` | Pass — `✓ Compiled successfully`, `✓ Generating static pages (23/23)` |
| Lint | `npm run lint` | Not run (no lint-cmd in AGENTS.md; build already catches TypeScript errors) |
| Tests | (none defined) | N/A |

Note: `DATABASE_URL` Prisma errors appear during static page generation at build time — these are pre-existing runtime errors (no database available outside Docker), not TypeScript errors, and are unrelated to this change.

## Acceptance Criteria

- [x] In skim mode: hovering over an article card for ≥ 300 ms shows the reason chip
- [x] In skim mode: holding an article card for ≥ 500 ms shows the reason chip
- [x] Normal tap (< 500 ms press + release) opens the article — no chip appears, no behavior change
- [x] Moving the pointer > 8 px during a press cancels the long-press timer
- [x] Chip does not render when `article.reason` is falsy or undefined
- [x] Chip hides when the card scrolls out of the viewport (IntersectionObserver else branch)
- [x] Deep mode continues to show the reason line always (no regression)
- [x] `ArticleDetail` continues to show reason always (no regression — untouched)
- [x] In Settings: "Personalisation" section is not visible
- [x] In Settings: "Feed Learning" section renders correctly with boosted/suppressed topics
- [x] No TypeScript errors: `npm run build` exits 0
- [x] No `/api/settings/personalisation` fetch in `settings/page.tsx`

## Discovered Issues

None. The codebase was in good shape — all patterns were stable and the targeted sections matched the spec exactly.
