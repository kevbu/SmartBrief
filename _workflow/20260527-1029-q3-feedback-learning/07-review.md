# Review: Skim-Mode Reason Chip + Settings Cleanup

> Spec: [04-spec.md](04-spec.md)
> Implementation: [05-implementation.md](05-implementation.md)
> QA: [06-qa.md](06-qa.md)
> Date: 2026-05-27
> Verdict: **PASS_WITH_NOTES**

## Summary

Both changes are clean and correct. The settings cleanup is a straightforward deletion with no issues. The `ArticleCard` changes follow the existing `skipTimerRef` pattern faithfully and the spec's acceptance criteria are all satisfied. Three minor behavioral edge cases are worth knowing about — none are regressions and none block shipping, but one (mouse/touch event overlap) is worth a quick manual test on a real iOS device.

No critical or major issues found. Three minor notes below.

---

## Findings

### MINOR — Mouse/touch event overlap on iOS

**Location:** `src/components/ArticleCard.tsx:125–135` (`handleMouseEnter`)

**What:** On iOS Safari (and Chrome on iOS), a `touchstart` event synthesizes a `mouseenter` event as part of the browser's compatibility layer. This means on mobile, when a user presses down on a card, both `pressTimerRef` (500 ms) and `hoverTimerRef` (300 ms) may start simultaneously. The hover timer fires first at 300 ms, setting `reasonVisible(true)` before the press timer reaches 500 ms — effectively making the chip appear in 300 ms on touch, not 500 ms.

**Why it matters:** The spec specifies 500 ms for mobile long-press and 300 ms for desktop hover. The 500 ms threshold exists to avoid accidental chip appearances during scrolling. If the hover timer undercuts it on iOS, the chip could appear during a 300 ms press — which is shorter than a typical scroll flick but may still cause unintended chip appearances.

**Recommendation:** Add a `{ passive: true }` touch event listener or use `e.pointerType === 'touch'` in `handleMouseEnter` to skip the hover timer on touch devices:
```tsx
function handleMouseEnter(e: React.MouseEvent) {
  // Skip hover delay on touch — pointer handlers own the touch flow
  if (window.matchMedia('(pointer: coarse)').matches) return
  hoverTimerRef.current = setTimeout(() => setReasonVisible(true), 300)
}
```
This is a one-line fix that cleanly separates touch and mouse paths.

---

### MINOR — Chip stays visible after click-through

**Location:** `src/components/ArticleCard.tsx:137–158` (`handleClick`)

**What:** `handleClick` does not reset `reasonVisible` to `false`. If the user long-presses to show the chip (on mobile) and then taps the card again, the article opens but `reasonVisible` remains `true`. If the article detail is a sheet that renders the same card behind it (or if the user dismisses and returns), the chip is still showing.

The UX design doc (`03-ux-design.md`) specified: *"[Mobile] Tapping card after chip is visible: dismisses chip first, second tap opens article."* The implementation spec (`04-spec.md`) simplified this and explicitly stated *"No change to handleClick needed."* So the implementation follows the spec — this is a spec simplification, not an implementation error.

**Why it matters:** Low: `reasonVisible` resets to `false` on component unmount (React state doesn't persist across mounts), and the spec de-scoped the two-tap dismiss behavior intentionally.

**Recommendation:** If the two-tap dismiss behavior from the UX doc is desired later, add `setReasonVisible(false)` at the top of `handleClick`. Not required for this spec.

---

### MINOR — `pointerDownPosRef` not cleared on pointer up

**Location:** `src/components/ArticleCard.tsx:106–111` (`handlePointerUp`)

**What:** After a press-release cycle, `pointerDownPosRef.current` retains the last recorded `{ x, y }` coordinates. On subsequent `onPointerMove` events (mouse hovering, not pressing), `handlePointerMove` still runs the delta calculation against the stale coordinates. No action is taken because `pressTimerRef.current` is null (checked at line 118), so this is harmless.

**Recommendation:** Add `pointerDownPosRef.current = null` to `handlePointerUp` for cleanliness:
```tsx
function handlePointerUp() {
  if (pressTimerRef.current !== null) {
    clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
  }
  pointerDownPosRef.current = null
}
```

---

## Acceptance Criteria Review

| # | Criterion | Code Evidence | Verdict |
|---|-----------|---------------|---------|
| 1 | Hover ≥ 300 ms shows chip | `handleMouseEnter` → 300 ms `hoverTimerRef` | ✓ (see MINOR-1) |
| 2 | Hold ≥ 500 ms shows chip | `handlePointerDown` → 500 ms `pressTimerRef` | ✓ |
| 3 | Normal tap opens article | `handlePointerUp` clears timer before 500 ms; `onClick` unmodified | ✓ |
| 4 | Pointer move > 8 px cancels timer | `handlePointerMove` lines 117–122 | ✓ |
| 5 | Chip absent when `article.reason` falsy | `article.reason &&` guard at line 252 | ✓ |
| 6 | Chip hides on scroll out | `setReasonVisible(false)` in IntersectionObserver else branch, line 72 | ✓ |
| 7 | Deep mode unchanged | Deep-mode branch at lines 247–251 identical to pre-change | ✓ |
| 8 | `ArticleDetail` unchanged | File not modified | ✓ |
| 9 | "Personalisation" section absent | Section block removed; `grep` → 0 results | ✓ |
| 10 | "Feed Learning" renders correctly | `LearnedPreferencesSection` intact at line 1511 | ✓ |
| 11 | Build exits 0 | `✓ Compiled successfully` confirmed | ✓ |
| 12 | No personalisation fetch | `grep` → 0 results | ✓ |

All 12 acceptance criteria satisfied.

---

## Pre-existing Project Issues (not introduced by this change)

**[MAJOR] `next@14.2.5` has a known security vulnerability** — npm warns on install: *"This version has a security vulnerability. Please upgrade to a patched version."* `npm audit` reports 1 CRITICAL and 7 HIGH findings (15 total). These are pre-existing and unrelated to the Q3 Learning changes. Upgrading Next.js was already noted as post-Q3 maintenance scope in the PRD.

---

## Summary for Fix Mode

No FAIL verdict — no fix round needed. Notes are informational:

1. **MINOR-1 (mouse/touch overlap):** ~~Easy one-line fix in `handleMouseEnter`~~ **Fixed** — `window.matchMedia('(pointer: coarse)')` guard added; build verified clean.
2. **MINOR-2 (click-through chip):** Out of spec scope; only relevant if the two-tap dismiss UX from the design doc is later desired.
3. **MINOR-3 (stale pointerDownPosRef):** Cosmetic; safe to apply in a follow-up.
