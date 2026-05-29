# Code Review: UI Design Overhaul — Editorial Dark Minimal

> QA: [06-qa.md](06-qa.md)
> Date: 2026-05-29
> Effort: medium (3+4 angles × 6 candidates → verify)
> Status: **PASS_WITH_NOTES** — 1 real bug, 1 inconsistency, 3 cleanup

---

## Findings

### 1. `MoodPresetToggle` "Constructive" label overflows at 320px — CONFIRMED bug

**File:** `src/components/MoodPresetToggle.tsx`, line 63  
**Severity:** Minor (affects iPhone SE 1st/2nd gen only; 375px+ is fine)

The refactor removed `hidden sm:inline` from preset labels, making them always visible. At 320px (iPhone SE), the toggle is 288px wide. Subtracting `p-1` padding and two `gap-1` gaps, each of the three `flex-1` buttons gets ~90.7px. Icon (14px) + `gap-1.5` (6px) leaves ~70.7px for the label. "Constructive" at `text-xs` Inter ≈ 78px — 7px over budget. No `overflow-hidden`, `truncate`, or `whitespace-nowrap` on the label `<span>`. At 320px the button row breaks height.

**Fix:** Add `truncate` to the label span:
```tsx
<span className="truncate">{preset.label}</span>
```

---

### 2. `TOPIC_LABELS.world` drifted from canonical value — CONFIRMED inconsistency

**File:** `src/app/page.tsx`, line 29  
**Severity:** Minor (cosmetic, personal app)

`page.tsx` defines `TOPIC_LABELS.world = 'World News'` but the canonical `CATEGORIES` array in `src/lib/news-sources.ts` exports `world.label = 'World'`, which also matches `TopStoryCard.tsx`'s `categoryLabels.world = 'World'`. The recap teaser reads "mostly World News" while cluster cards show "World".

Neither map derives from `CATEGORIES`, which means a new category added to `news-sources.ts` will silently produce `undefined` in both. The minimal fix is syncing the value; the ideal fix is deriving from `CATEGORIES`.

**Fix (minimal):** Change line 29 from `world: 'World News'` to `world: 'World'`.

---

### 3. `:focus-visible` global rule: ring-offset-white creates off-colour gaps on dark tinted cards — PLAUSIBLE

**File:** `src/app/globals.css`, line 17  
**Severity:** Cosmetic (keyboard nav only, dark mode only, personal app)

The global rule sets `ring-offset-white dark:ring-offset-slate-950`. This correctly handles elements on the page background and white cards. However, focusable elements inside `bg-emerald-950/40` (positive cluster cards) and `bg-amber-950/40` (negative cluster cards) in dark mode will show a `slate-950` ring-offset gap against a greenish/amber-tinted surface — a visible colour mismatch.

**Fix (simplest):** Replace `ring-offset-2 ring-offset-white dark:ring-offset-slate-950` with `ring-offset-0`:
```css
:focus-visible {
  @apply outline-none ring-2 ring-blue-500;
}
```
`ring-offset-0` removes the gap entirely. A 2px ring with no offset is still clearly visible and avoids the surface-colour dependency.

---

### 4. Star SVG duplicated in `SessionProgress.tsx` and `page.tsx` — CONFIRMED cleanup

**Files:** `src/components/SessionProgress.tsx:19`, `src/app/page.tsx:636`  
**Severity:** Cleanup (maintenance risk)

The `M10.788 3.21...` filled-star path with `h-8 w-8 text-emerald-500` is copy-pasted verbatim. A visual change needs edits in both files. Not worth extracting to a shared component now, but note it when next touching these files.

---

### 5. Bookmark outline SVG triplicated with two different fill-toggle patterns — CONFIRMED cleanup

**Files:** `src/components/ArticleCard.tsx:284`, `src/components/TopStoryCard.tsx:190`, `src/components/BottomNav.tsx:22`  
**Severity:** Cleanup (maintenance risk + pattern inconsistency)

`M17.593 3.322...` path appears in all three files. `ArticleCard` toggles `fill`/`stroke` on one `<svg>` (clean); `TopStoryCard` uses two separate `<svg>` branches (verbose). Not worth addressing now, but a `BookmarkIcon` component would consolidate at the right time.

---

## Refuted / Cleared Candidates

| Candidate | Verdict | Reason |
|---|---|---|
| `sticky top-0` inside `overflow-y-auto` scrolls away | REFUTED | CSS spec: sticky pins relative to nearest scrolling ancestor, which is the `overflow-y-auto` div — correct behavior |
| `strokeWidth={0}` hairline artefact on Safari | REFUTED | `stroke="none"` is also set; stroke attribute takes precedence over strokeWidth; no artefact |
| FeedbackMenu `w-52` dropdown clips viewport at 375px | REFUTED | Right-aligned at card edge; left edge sits ≥55px from viewport left — no overflow |
| `color-scheme: light dark` breaks theme-color | INFORMATIONAL | Pre-existing: `layout.tsx` exports a single dark `themeColor` regardless; not introduced by this refactor |
| German `Quelle/Quellen` → English `source/sources` | INFORMATIONAL | Intentional: the German strings were a pre-existing inconsistency; rest of UI is English |
| `transition-all` on inline-style `width` | INFORMATIONAL | Acknowledged in design system doc as the accepted pattern for progress bars |

---

## Summary

| # | Finding | Severity | Action |
|---|---------|---------|--------|
| 1 | "Constructive" label overflow at 320px | Minor bug | Add `truncate` to label span |
| 2 | `TOPIC_LABELS.world` = 'World News' vs canonical 'World' | Minor inconsistency | Change to 'World' |
| 3 | Focus ring offset wrong colour on tinted cards | Cosmetic | Switch to `ring-offset-0` |
| 4 | Star SVG duplicated | Cleanup | Note for future refactor |
| 5 | Bookmark SVG triplicated, two patterns | Cleanup | Note for future refactor |

**Verdict: PASS_WITH_NOTES.** Findings 1–3 are small fixes. Nothing blocks shipping.
