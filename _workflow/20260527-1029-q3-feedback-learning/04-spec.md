# Feature: Skim-Mode Reason Chip + Settings Cleanup

> Source: Manual request (Q3 Feedback Learning sprint)
> Date: 2026-05-27
> Depth: Lightweight (2 files, ~40 lines net change)

## Context

The Q3 Feedback Learning sprint is already implemented in the backend and in deep mode. Two UI gaps remain: (1) `article.reason` is invisible in skim mode (the default) — users only see it after opening an article; the spec requires a tap-hold / hover chip on the card itself. (2) The Settings page has a legacy "Personalisation" section (calls `DELETE /api/settings/personalisation`, shows only source-weight count) that duplicates and contradicts the newer "Feed Learning" section (`LearnedPreferencesSection`). Removing it reduces confusion.

## Requirements

- In skim mode, `article.reason` is accessible via long-press (500 ms, mobile) or hover (300 ms delay, desktop) as an inline chip on the `ArticleCard`
- Normal tap / click behavior is unchanged
- Chip only renders when `article.reason` is truthy
- Old "Personalisation" section is removed from the Settings page
- "Feed Learning" (`LearnedPreferencesSection`) remains untouched
- `npm run build` passes with no TypeScript errors after both changes

**Out of scope:**
- Any backend changes (all signal, weight, and recap logic is already correct)
- Changes to deep mode rendering (already shows reason inline)
- Changes to `ArticleDetail` (already shows reason always)
- Any new API endpoints

## Current State

### `src/components/ArticleCard.tsx`

- Line 186: reason is gated behind `depthMode === 'deep'`:
  ```tsx
  {depthMode === 'deep' ? (
    <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-300 dark:text-gray-600">
      <span>✦</span>
      <span>{article.reason ?? `From ${article.source} · ${article.category} · ${article.sentiment} tone`}</span>
    </p>
  ) : null}
  ```
- The card already has a `cardRef` and an `IntersectionObserver` (lines 44–80) for skip signals
- Existing pointer event handling: `onClick={handleClick}` on the `<article>` element
- The component is `'use client'` with `useState`, `useEffect`, `useRef` already imported

### `src/app/settings/page.tsx`

- Lines 697–700: `activeWeights`, `showResetConfirm`, `isResetting`, `resetDone` state vars
- Lines 764–775: `GET /api/settings/personalisation` fetch + `setActiveWeights` in `load()`
- Lines 912–927: `handleResetPersonalisation` function
- Lines 1364–1412: `<section>` with heading "Personalisation" — the entire old block
- Line 1588: `<LearnedPreferencesSection ... />` — the replacement, stays

## Implementation Steps

### Step 1 — Add reason chip to `ArticleCard` in skim mode

**File:** `src/components/ArticleCard.tsx` (modify)

**Add state:**
Add a `reasonVisible` boolean state (default `false`). Add a `pressTimerRef` (`useRef<ReturnType<typeof setTimeout> | null>(null)`) alongside the existing `skipTimerRef`.

**Add a `shortenReason` helper inside the component** (not exported):
- If reason contains `"a source you read often"` → `"Source you trust · {article.source}"`
- If reason contains `"most-read topic"` → extract the topic label from the front of the string (everything before `" — "`)
- If reason contains `"based on your settings"` → `"Relevant to your feed"`
- Otherwise → return reason as-is

**Long-press handlers (add to the `<article>` element alongside existing `onClick`):**
- `onPointerDown`: start a 500 ms timer; on fire, set `reasonVisible(true)`
- `onPointerUp` / `onPointerCancel`: clear the timer
- `onPointerMove`: clear the timer if `Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8` (store pointerdown position in a ref to compute delta)

**Hover handlers (add to the `<article>` element):**
- `onMouseEnter`: start a 300 ms timer; on fire, set `reasonVisible(true)`
- `onMouseLeave`: clear the timer, set `reasonVisible(false)`

**Hide chip when card leaves viewport:**
In the existing `IntersectionObserver` effect (lines 54–79), when `!entry.isIntersecting`, also call `setReasonVisible(false)`.

**Render the chip:**
Replace the existing deep-mode-only block:
```tsx
{depthMode === 'deep' ? (
  <p className="..."><span>✦</span><span>{article.reason ?? ...}</span></p>
) : null}
```
With:
```tsx
{depthMode === 'deep' ? (
  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-300 dark:text-gray-600">
    <span>✦</span>
    <span>{article.reason ?? `From ${article.source} · ${article.category} · ${article.sentiment} tone`}</span>
  </p>
) : article.reason && reasonVisible ? (
  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 animate-fade-in">
    <span>✦</span>
    <span>{shortenReason(article.reason)}</span>
  </p>
) : null}
```

**Animation:** Add `animate-fade-in` to `tailwind.config.ts` keyframes if not present, or use `transition-opacity duration-200` with an opacity toggle instead (simpler, no config change needed — prefer this approach: render with `opacity-0` initially and switch to `opacity-100` via state on next tick using `useEffect`). Check `prefers-reduced-motion` via a media query match — if reduced motion, skip the fade (render at `opacity-100` immediately).

**Ensure no layout shift on tap:** The existing `handleClick` fires on `onClick` (pointer up). Since `onPointerDown` starts the long-press timer and `onPointerUp` cancels it, a normal tap (< 500 ms) cancels the timer before it fires and `onClick` proceeds normally. No change to `handleClick` needed.

---

### Step 2 — Remove legacy Personalisation section from Settings

**File:** `src/app/settings/page.tsx` (modify)

**Remove state variables** (from the `useState` block near lines 697–701):
- `const [activeWeights, setActiveWeights] = useState<number | null>(null)`
- `const [showResetConfirm, setShowResetConfirm] = useState(false)`
- `const [isResetting, setIsResetting] = useState(false)`
- `const [resetDone, setResetDone] = useState(false)`

**Remove from `load()` effect** (lines 764–775):
```ts
const wRes = await fetch('/api/settings/personalisation')
if (wRes.ok) {
  const wData = await wRes.json()
  setActiveWeights(wData.activeWeights ?? 0)
}
```
Delete these lines entirely. The `wRes` variable is local — no other reference exists.

**Remove `handleResetPersonalisation`** function (lines 912–927).

**Remove the old `<section>` block** with heading `"Personalisation"` (lines 1364–1412). This section starts with:
```tsx
<section className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900">
  <h2 className="mb-1 text-base font-semibold ...">Personalisation</h2>
```
and ends before the `{/* Newsletter Ingestion */}` comment. Delete the entire block.

**Keep intact:** `<LearnedPreferencesSection ... />` at line ~1588.

## Patterns to Follow

**Structural template — skip signal timer in `ArticleCard.tsx` (lines 44–80):**
The `skipTimerRef` pattern is the exact model for the long-press timer: ref holds the timeout handle, `IntersectionObserver` callback clears it, `handleClick` also clears it. The press timer follows the same shape.

**Structural template — `FeedbackMenu` hover in existing components:**
For the hover pattern, look at how `FeedbackMenu` manages its own open/close state — `useState` + `onClick` toggle. The hover approach here is simpler: two `onMouse*` handlers plus a timer ref.

## Acceptance Criteria

- [ ] In skim mode: hovering over an article card for ≥ 300 ms shows the reason chip
- [ ] In skim mode: holding an article card for ≥ 500 ms shows the reason chip
- [ ] Normal tap (< 500 ms press + release) opens the article — no chip appears, no behavior change
- [ ] Moving the pointer > 8 px during a press cancels the long-press timer
- [ ] Chip does not render when `article.reason` is falsy or undefined
- [ ] Chip hides when the card scrolls out of the viewport
- [ ] Deep mode continues to show the reason line always (no regression)
- [ ] `ArticleDetail` continues to show reason always (no regression)
- [ ] In Settings: "Personalisation" section is not visible
- [ ] In Settings: "Feed Learning" section renders correctly with boosted/suppressed topics
- [ ] No TypeScript errors: `npm run build` exits 0
- [ ] No `/api/settings/personalisation` fetch in `settings/page.tsx`

## Gherkin Impact

No `features/` directory exists in this project (no Playwright e2e suite). All acceptance criteria are verified via:
- **Manual browser testing** (hover, long-press on device simulation)
- **`npm run build`** (TypeScript strict-mode catch for removed state variables)
- **Visual inspection in Settings** (section removal)

No Gherkin files to create or modify.

## Workflow Config

| Key           | Value          |
| ------------- | -------------- |
| workflow-dir  | _workflow      |
| dev-cmd       | npm run dev    |
| build-cmd     | npm run build  |
| lint-cmd      | npm run lint   |
| test-cmd      | (none defined) |
| e2e-cmd       | (none defined) |
| e2e-framework | (none)         |
| tdd           | false          |
| branch-prefix | (none)         |
| base-branch   | main           |
