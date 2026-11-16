# UX Design: Appearance setting

Decision (Gate 1): option B — System / Light / Dark, stored per device in `localStorage`.

## User flow
1. Kevin opens Settings (bottom nav).
2. First section "Appearance" shows a 3-way segmented control: System · Light · Dark. Current choice is highlighted.
3. Tap Light → page switches to the light palette at once, no reload. Choice persists in `localStorage`.
4. Any later page load (feed, saved, recap, login) renders light from the first paint.

## States
- Default (no stored value / storage unavailable): System selected; follows `prefers-color-scheme`, also live when macOS switches.
- Light / Dark selected: fixed, ignores system.
- Storage throws (private mode): control still switches the theme for the session; on reload falls back to System. No error message needed.
- Before hydration the control shows nothing selected? No: render with System, then sync to stored value in `useEffect` (one-frame highlight change is acceptable; the page colours are already correct via the head script).

## Primitives to reuse
- Section shell: the existing settings `<section className="rounded-2xl border border-line bg-card p-4 shadow-card">` + `h2.headline` + `p.text-xs.text-ink-muted` pattern (`src/app/settings/page.tsx`, e.g. "Mood Preset").
- Segmented control: visual shape of `src/components/MoodPresetToggle.tsx` (`flex gap-1 rounded-xl bg-well p-1`, active segment raised). Build a small `ThemeToggle` component in the same style; no new design tokens.
- Icons: inline SVG, stroke 1.75, same as MoodPresetToggle (monitor, sun, moon).

## New primitive needed?
Only `ThemeToggle` (thin, mirrors MoodPresetToggle). No new tokens or colours.

## Accessibility
- `role="radiogroup"` with `aria-label="Theme"`; each option `role="radio"` + `aria-checked`. Or buttons with `aria-pressed` to match MoodPresetToggle — use `aria-pressed` for consistency with the existing settings page.
- Visible text labels next to icons. Existing `:focus-visible` ring applies.
- Tap targets ≥ 36px high.

## Constraints
- Semantic tokens only (`bg-well`, `bg-card`, `text-ink`, `border-line` …). No raw colour classes.
- Existing `dark:` utilities must keep working in all three modes.

## Open questions
None.
