# Feature Brief: Theme override (System / Light / Dark)

## What it does
Adds an "Appearance" setting so smartbrief can render light (or dark) regardless of the macOS appearance.

## Why it's valuable
Kevin's Mac runs in dark mode, but he prefers reading smartbrief in light mode. Today the app follows `prefers-color-scheme` only, so there is no way to get the light "warm paper" palette on a dark-mode system.

## Current state (from the code)
- Theming is token-based. `src/app/globals.css` defines RGB tokens on `:root` and swaps them in `@media (prefers-color-scheme: dark)`. Same for `.source-mark`.
- `tailwind.config.ts` has no `darkMode` key, so Tailwind 3.4 uses the `media` strategy. 33 `dark:` utilities exist (settings 20, page 4, recap 4, BiasBadge 4, login 1).
- `src/app/layout.tsx` sets `themeColor` per media query. `public/manifest.json` has stale colours (`#0f172a`).
- No theme state exists anywhere (no `data-theme`, no class, no setting).

## Scope challenge
| Option | Effort | Trade-off |
|---|---|---|
| A. Hard-code light (drop dark palette) | ~15 min | Simplest. Loses dark mode for good, also on the phone at night. Throws away work from the UI overhaul. |
| B. Setting System / Light / Dark, stored in `localStorage`, applied by an inline `<head>` script | ~1–2 h | No flash, no DB change, no server dependency. Per device (Mac light, phone can stay System). |
| C. Same setting stored in `UserPreferences` (DB) | ~2–3 h | Syncs across devices. Server must read the DB in the root layout to avoid a flash; makes layout dynamic and adds a schema change on a table another session may touch. |
| D. Same setting in a cookie, read in the root layout | ~1.5 h | No flash without inline script. Makes the root layout dynamic. No real gain over B for a single user. |

Recommendation: **B**. Theme is a display concern of the device, not a feed preference. Per-device fits better than DB sync, and the inline script avoids the flash without touching the DB or making the layout dynamic.

## In scope
- `darkMode` strategy in Tailwind that respects both an explicit `data-theme` on `<html>` and the system setting when no choice is made. All existing `dark:` utilities keep working unchanged.
- `globals.css`: dark tokens apply for `[data-theme="dark"]`, or for system dark when no explicit light choice is set. Same for `.source-mark`.
- Inline script in `layout.tsx` `<head>` that reads `localStorage` and sets `data-theme` before first paint (no flash).
- "Appearance" section at the top of Settings: segmented control System / Light / Dark. Applies instantly.
- `theme-color` meta follows the chosen theme.
- Default for a new device: System (no behaviour change until Kevin picks Light).

## Out of scope
- DB / `UserPreferences` column (only if option C is picked).
- Toggle in the header or feed. Settings only.
- Redesign of the dark palette.
- Manifest colour cleanup (note as finding).
- DB location, persistence, deploy scripts (other session).

## UI changes
Yes (one new Settings section).

## Known constraints
- Tailwind 3.4: custom `darkMode: ['variant', [...]]` is supported for the "explicit or system" combination.
- Next 16 App Router: inline script in a server `layout.tsx` needs `suppressHydrationWarning` on `<html>` because the attribute is set before hydration.
- `localStorage` can throw (private mode). Script must fail safe to System.
