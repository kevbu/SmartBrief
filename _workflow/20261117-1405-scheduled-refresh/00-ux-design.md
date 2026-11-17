# UX Design: Scheduled Refresh

Scope: the "Auto-Refresh" section in `src/app/settings/page.tsx` (around line 1670). No other screen changes.

## User flow

1. User opens Settings and scrolls to "Auto-Refresh".
2. User picks a mode in a three-option button group: **Manual** · **Interval** · **Daily**.
   - Manual: no further controls.
   - Interval: the existing 2×2 grid (30 min / 1 hour / 2 hours / 4 hours) appears below.
   - Daily: one time input ("Every day at [07:00]") appears below.
3. User taps the existing "Save Preferences" button at the bottom of the page. The section has no own save. Same as every other section.
4. The server picks up the new mode within one minute. No restart.

## Copy

- Section title: "Auto-Refresh" (unchanged).
- Subtitle: "When SmartBrief fetches and analyses new articles".
- Mode descriptions, one muted line under the button group, depends on mode:
  - Manual: "Only when you tap refresh."
  - Interval: "Every {n} while your computer is on."
  - Daily: "Every day at {HH:MM}. If your computer is asleep then, it runs as soon as it wakes."
- Hint for Interval and Daily, muted text: "Each refresh uses Claude."

## States

| State | What the section shows |
|---|---|
| Loading prefs | Same as the rest of Settings today (page-level loading). No section-specific state |
| Manual (default) | Mode group, Manual active, "Only when you tap refresh." |
| Interval | Mode group + 2×2 interval grid, selected option active |
| Daily | Mode group + time input, prefilled `07:00` |
| Stored interval not in options (DB default 360) | Interval mode: no option looks active. Spec must decide: map to nearest option or add a "6 hours" option. Recommendation: add "6 hours" (value 360), because it is the DB default and the old scheduler value |
| Save error / success | Existing "Save Preferences" button states. No change |

## Primitives to reuse

- **Mode group:** same button style as the current interval grid in the same section (`bg-ink text-paper` active, `bg-well text-ink-soft hover:bg-well-strong` inactive, `min-h-[40px] rounded-lg`). Use `grid grid-cols-3 gap-2`.
- **Interval grid:** the existing `REFRESH_OPTIONS` grid, unchanged markup, shown only in Interval mode.
- **Time input:** the quiet-hours `<input type="time">` pattern (`rounded border border-line px-2 py-1 text-xs`) from the Notifications section, wrapped in the same `rounded-lg bg-well/60 p-3` sub-panel.
- **Section card:** existing `rounded-2xl border border-line bg-card p-4 shadow-card`.
- Tokens: the settings page already uses the semantic tokens `ink`, `ink-soft`, `ink-muted`, `well`, `line`, `card`, `accent`. Use only these. No `gray-*`, no `slate-*`.

## New primitive needed?

No.

## Accessibility

- Mode group: `role="radiogroup"` with `aria-label="Refresh mode"`. Each button `role="radio"` + `aria-checked`. Tab reaches the group; Enter/Space selects. Arrow-key roving is nice to have, not required (the existing grids do not have it either).
- Interval grid buttons: add `aria-pressed` for the active option (currently missing).
- Time input: a real `<label htmlFor>` ("Time") linked to the input. The quiet-hours inputs lack this; do not copy that gap.
- The description line under the group updates with the mode. No live region needed, because it changes only on the user's own action.
- Focus order: mode group → interval grid or time input → next section.

## Constraints that apply

- `docs/design-system.md`: neutral palette, single accent, SVG icons only, no emoji as UI chrome.
- CLAUDE.md: "All preferences live in a single DB row (`UserPreferences` id=`"default"`)". New fields go there and through `GET/PUT /api/preferences`.
- Backup export/import (`src/lib/backup.ts`) covers preferences. New fields must round-trip.
- e2e (Playwright) has a settings test surface. The section must keep working with the default mode Manual.

## Open questions for the spec writer

1. Add "6 hours" to `REFRESH_OPTIONS`, or migrate stored 360 to a listed value? (Recommendation: add 6 hours.)
2. Should the time input accept any minute, or snap to 15-minute steps (`step="900"`)? (Recommendation: any minute, simpler.)
