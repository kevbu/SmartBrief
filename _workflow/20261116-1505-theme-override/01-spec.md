# Feature: Theme override (System / Light / Dark)

> Source: Manual request (Kevin: "my system is set to dark mode, but I'd like to set smartbrief to light mode")
> Date: 2026-11-16
> Depth: standard (6 files, one new small pattern: pre-paint theme script)

## Context

Smartbrief follows `prefers-color-scheme` only. Kevin's Mac is in dark mode and he wants the light "warm paper" palette. Gate 1 approved option B: a per-device System / Light / Dark setting in `localStorage`, applied before first paint. No DB change.

## Requirements

- Settings has an "Appearance" section (first section) with a 3-way control: System, Light, Dark.
- Choosing an option changes the whole UI at once, without reload.
- The choice persists per device across reloads and across all routes (`/`, `/saved`, `/recap`, `/settings`, `/login`).
- No flash of the wrong theme on page load.
- System mode follows the OS live (switching macOS appearance updates an open tab).
- All existing `dark:` utilities and the `.source-mark` dark variant work in every mode.
- The browser `theme-color` follows the resolved theme.
- Unavailable `localStorage` falls back to System without errors.

**Out of scope:**

- DB / `UserPreferences` column, API changes.
- Theme toggle outside Settings.
- Dark palette redesign; `public/manifest.json` colours (stale `#0f172a`) — file as finding.
- Installing a test runner (see Decisions).

## Current State

- `src/app/globals.css` — light tokens on `:root`; dark tokens in `@media (prefers-color-scheme: dark) { :root { … } }` (lines ~41–70). `.source-mark` has its own `@media (prefers-color-scheme: dark)` block (~line 122).
- `tailwind.config.ts` — no `darkMode` key → Tailwind 3.4 `media` strategy. 33 `dark:` usages in `settings/page.tsx`, `page.tsx`, `recap/page.tsx`, `BiasBadge.tsx`, `login/page.tsx`.
- `src/app/layout.tsx` — server component; `viewport.themeColor` is an array of two media-query entries (`#f7f6f2` / `#0e0e11`). `<html lang="en">` has no theme attribute.
- `src/app/settings/page.tsx` — `'use client'`; sections share the shell `rounded-2xl border border-line bg-card p-4 shadow-card` + `h2.headline` + muted description. First section today: "Mood Preset" (~line 1106).
- `src/components/MoodPresetToggle.tsx` — segmented control template: `flex gap-1 rounded-xl bg-well p-1`, segments with `aria-pressed`, active `bg-raised text-ink shadow-card`, inline SVG icons stroke 1.75.

## High-Level Approach

The `<html>` element always carries a **resolved** `data-theme="light" | "dark"`. The stored **preference** (`system | light | dark`) lives in `localStorage` under `sb-theme`. A tiny inline script in `<head>` resolves preference + `matchMedia` to the attribute before the body paints, and keeps it in sync when the OS changes while in System mode. CSS and Tailwind key dark styles off `[data-theme="dark"]` only, so there is exactly one copy of the dark tokens.

## Implementation Steps

### Step 1 — Theme module

**Files:** `src/lib/theme.ts` (create)

- `type ThemePreference = 'system' | 'light' | 'dark'`, `type ResolvedTheme = 'light' | 'dark'`.
- `THEME_STORAGE_KEY = 'sb-theme'`, `THEME_COLORS: Record<ResolvedTheme, string>` = `#f7f6f2` / `#0e0e11` (values from current `layout.tsx`).
- Pure: `parseThemePreference(raw: unknown): ThemePreference` (anything invalid → `'system'`), `resolveTheme(pref, systemPrefersDark: boolean): ResolvedTheme`.
- Browser helpers (guard `typeof window`): `readThemePreference()` (try/catch around `localStorage`), `setThemePreference(pref)` — writes storage (try/catch, removes the key for `'system'`), resolves via `matchMedia('(prefers-color-scheme: dark)')`, sets `document.documentElement.dataset.theme`, updates `meta[name="theme-color"]` content.
- `THEME_INIT_SCRIPT: string` — a self-contained IIFE (no imports, ES5-safe) built from the constants above: read key in try/catch, resolve, set `data-theme` and the theme-color meta, and register one `matchMedia` `change` listener that re-reads storage and re-applies only when the stored preference is System/absent. Must never throw.

### Step 2 — Tailwind dark variant

**Files:** `tailwind.config.ts` (modify)

Add `darkMode: ['selector', '[data-theme="dark"]']`. Update the top comment. No changes to any `dark:` usages.

### Step 3 — CSS tokens

**Files:** `src/app/globals.css` (modify)

- Replace `@media (prefers-color-scheme: dark) { :root { … } }` with `:root[data-theme="dark"] { … }` (same values, plus `color-scheme: dark`).
- Replace the `.source-mark` media block with `[data-theme="dark"] .source-mark`.
- Update the header comment to describe the attribute model.

### Step 4 — Root layout

**Files:** `src/app/layout.tsx` (modify)

- `viewport.themeColor`: single value `THEME_COLORS.light` (one meta tag the script can update).
- `<html lang="en" data-theme="light" suppressHydrationWarning>` — server default light; script overrides before paint.
- First child of `<head>`: `<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />`.

### Step 5 — ThemeToggle component

**Files:** `src/components/ThemeToggle.tsx` (create)

Client component mirroring `MoodPresetToggle` markup and classes. Options System (monitor icon), Light (sun), Dark (moon), labels visible. Internal state initialised to `'system'`, synced from `readThemePreference()` in `useEffect`. On click: `setThemePreference(value)` and update state. Buttons use `aria-pressed`; group `role="group" aria-label="Theme"`.

### Step 6 — Settings section

**Files:** `src/app/settings/page.tsx` (modify)

Insert an "Appearance" section before "Mood Preset", same shell: `h2.headline` "Appearance", description "Light, dark, or follow your device. Saved on this device only.", then `<ThemeToggle />`. Render it inside the existing loaded branch (after the `isLoading` spinner guard) — no dependency on preferences data.

## Patterns to Follow

- `src/components/MoodPresetToggle.tsx` — segmented control shape, classes, `aria-pressed`, icon style. Differs: owns its own state via `src/lib/theme.ts` instead of props from the page.
- Settings section shell from "Mood Preset" in `src/app/settings/page.tsx`.
- Semantic tokens only (`bg-well`, `bg-raised`, `text-ink`, `text-ink-muted`, `shadow-card`). No raw colours.

## Decisions

- **Resolved attribute, not "explicit-or-media" CSS.** One copy of dark tokens; Tailwind `selector` strategy is trivial. Cost: without JS the app renders light. Acceptable: the app is fully client-rendered anyway.
- **Server default `data-theme="light"`.** Script overrides before first paint; only a no-JS client would see light.
- **Key `sb-theme`, absent = System.** Choosing System removes the key so future default changes still apply.
- **No unit test.** Jest is configured in `CLAUDE.md` `test-cmd` but is not installed and was never in `package.json`. Adding a test runner is out of scope. ACs are verified via `tsc`, build and browser check-results. Filed as a finding.

## Acceptance Criteria

- [ ] AC1: Settings shows "Appearance" as the first section with System / Light / Dark; the stored choice is highlighted after load.
- [ ] AC2: With OS in dark mode, choosing Light switches `/settings` to the light palette instantly (`<html data-theme="light">`, body background `rgb(247 246 242)`).
- [ ] AC3: After choosing Light, a hard reload of `/`, `/saved`, `/recap` renders light from first paint (attribute set before body; no dark frame).
- [ ] AC4: Choosing Dark with OS light renders dark; existing `dark:` utilities apply (e.g. error banner classes resolve to dark variants).
- [ ] AC5: In System mode, emulating `prefers-color-scheme` change flips `data-theme` without reload; in Light/Dark mode it does not.
- [ ] AC6: `meta[name="theme-color"]` content equals `#f7f6f2` in light and `#0e0e11` in dark.
- [ ] AC7: If `localStorage` access throws, the page loads in System mode with no console errors.
- [ ] AC8: No React hydration warning for `<html>` in the console.
- [ ] AC9: `npx tsc --noEmit` and `npm run build` pass.

## Gherkin Impact

**Affected `.feature` files:** none. The repo has no `features/` directory and no e2e framework (`e2e-cmd` / `e2e-framework` not configured).

**Routing:** AC1–AC8 → impl check-result (browser verification on the dev server with `prefers-color-scheme` emulation). AC9 → lint/build check-result. No new `.feature` file: introducing a Gherkin/e2e stack is out of scope for this feature.

**Prune candidates:** none.

## Workflow Config

| Key           | Value |
| ------------- | ----- |
| workflow-dir  | _workflow |
| test-cmd      | node --experimental-vm-modules node_modules/.bin/jest src/lib/importance-score.test.ts (Jest not installed — broken) |
| lint-cmd      | npx tsc --noEmit |
| build-cmd     | npm run build |
| e2e-cmd       | — |
| e2e-framework | — |
| tdd           | — |
| branch-prefix | feature/ |
| base-branch   | main |
