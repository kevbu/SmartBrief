# Implementation: Theme override (System / Light / Dark)

> Spec: [01-spec.md](01-spec.md)
> Date: 2026-11-16
> Mode: normal
> Status: DONE_WITH_CONCERNS

## Summary

Added a per-device theme preference (System / Light / Dark) stored in `localStorage` under `sb-theme`. An inline `<head>` script resolves it to `<html data-theme="light|dark">` before first paint and follows OS changes in System mode. CSS tokens, `.source-mark` and Tailwind `dark:` now key off that attribute. Settings has a new "Appearance" section with a segmented control.

## Steps Completed

### Step 1 — Theme module

**Files created:**

- `src/lib/theme.ts` — types, `THEME_STORAGE_KEY`, `THEME_COLORS`, `parseThemePreference`, `resolveTheme`, `readThemePreference`, `setThemePreference`, `THEME_INIT_SCRIPT` (ES5 IIFE, fully wrapped in try/catch).

### Step 2 — Tailwind dark variant

**Files modified:**

- `tailwind.config.ts` — `darkMode: ['selector', '[data-theme="dark"]']`, comment updated.

### Step 3 — CSS tokens

**Files modified:**

- `src/app/globals.css` — dark tokens moved from `@media (prefers-color-scheme: dark) :root` to `:root[data-theme='dark']`; `.source-mark` dark variant to `[data-theme='dark'] .source-mark`; header comment updated.

### Step 4 — Root layout

**Files modified:**

- `src/app/layout.tsx` — `<html data-theme="light" suppressHydrationWarning>`, inline `THEME_INIT_SCRIPT` as first `<head>` child, `viewport.themeColor` removed (see deviation).

### Step 5 — ThemeToggle component

**Files created:**

- `src/components/ThemeToggle.tsx` — mirrors `MoodPresetToggle` markup/classes; monitor/sun/moon icons; `role="group" aria-label="Theme"`, `aria-pressed`; state synced from storage in `useEffect`.

### Step 6 — Settings section

**Files modified:**

- `src/app/settings/page.tsx` — "Appearance" section before "Mood Preset".

## Tests Added

None. Jest is not installed (see Discovered Issues); verification done via browser check-results below.

## Deviations from Spec

### theme-color meta

- **Spec said:** keep a single `viewport.themeColor` value; script updates that tag.
- **Found:** In Next 16 the viewport meta is emitted after the inline script runs and React re-inserts it at the end of `<head>` after hydration. Result in the browser: two `theme-color` tags, the second one stale.
- **Did instead:** removed `themeColor` from `viewport`. The init script creates the single `theme-color` meta if missing and sets its content; `setThemePreference` updates all matching tags. Verified: exactly one tag, correct colour in both themes.

## Check Results

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx tsc --noEmit` | Pass |
| Tests | `node --experimental-vm-modules node_modules/.bin/jest …` | Not runnable — Jest not installed (pre-existing; out of scope per spec) |
| Build | `npm run build` | Pass (pre-existing "inferred workspace root" warning from worktree lockfiles) |

Browser verification: `next dev -p 3100` with a throwaway SQLite DB in the session scratchpad, `prefers-color-scheme` emulated.

| AC | Check | Result |
|----|-------|--------|
| AC1 | First `h2` is "Appearance"; System pressed with no stored value; Light pressed after choosing it and reloading | Pass |
| AC2 | OS dark + click Light → `data-theme=light`, body `rgb(247,246,242)`, `sb-theme=light` | Pass |
| AC3 | Raw HTML of `/`, `/saved`, `/recap`, `/login`: script sits in `<head>` before `<body>`; reload of `/` with Light stored + OS dark → light | Pass |
| AC4 | OS light + Dark → body `rgb(14,14,17)`; probe `text-red-700 dark:text-red-300` resolves to red-300; `.source-mark` dark variant applied | Pass |
| AC5 | Light/Dark ignore OS (reload with OS dark stays light) | Pass |
| AC5 | System follows live OS change | Not verifiable in the test browser: CDP colour-scheme emulation fires no `change` events (confirmed with an independent listener). Logic reviewed |
| AC6 | One `theme-color` meta; `#f7f6f2` light, `#0e0e11` dark | Pass (after deviation fix) |
| AC7 | `Storage.prototype` get/set/remove throwing: init script → System, no error; clicking Dark still applies | Pass |
| AC8 | No console errors / hydration warnings on `/` and `/settings` | Pass |
| AC9 | tsc + build | Pass |

## Acceptance Criteria

- [x] AC1 — Appearance first, stored choice highlighted
- [x] AC2 — instant switch to Light with OS dark
- [x] AC3 — no wrong-theme frame on reload across routes
- [x] AC4 — Dark with OS light, `dark:` utilities apply
- [~] AC5 — Light/Dark ignore OS: verified. System live-follow: logic reviewed, not testable with emulation
- [x] AC6 — theme-color follows theme
- [x] AC7 — storage failure falls back to System
- [x] AC8 — no hydration warning
- [x] AC9 — tsc + build pass

## Discovered Issues

- `test-cmd` in `CLAUDE.md` points at Jest, but Jest is not a dependency and was never in `package.json`; `importance-score.test.ts` cannot run.
- `public/manifest.json` colours (`#f9fafb` / `#0f172a`) predate the editorial palette.
- Selected-segment highlight in `ThemeToggle` (and `MoodPresetToggle`) animates over 200 ms when the theme flips, so the controls briefly show the old palette. Cosmetic, matches existing behaviour.
