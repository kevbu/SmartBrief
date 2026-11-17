# UX Design: Backup section on Settings

## User flow
1. `/settings` → "Backup" section (after "Feed Learning", before "Auto-Refresh").
2. Export: tap "Export" → browser downloads `smartbrief-backup-YYYY-MM-DD.json`. Implemented as a plain link (`<a href="/api/backup/export" download>`). No JS state; the auth cookie travels with it.
3. Import: tap "Import" → native file picker (`accept="application/json,.json"`) → file is read and POSTed → result line shows counts.
4. After a successful import the page reloads its preferences from the server. A later "Save Preferences" then does not overwrite the imported values with stale local state.

## States

| State | Shows |
|---|---|
| Idle | Short description + two buttons |
| Importing | Import button disabled, `LoadingSpinner size="sm"` + "Importing…" |
| Success | Neutral note in `bg-well/60`: "Imported: …" with counts per table |
| Error | Existing error style `bg-red-50 … dark:bg-red-950/50` with the server message |

## Primitives to reuse
- Section shell: `rounded-2xl border border-line bg-card p-4 shadow-card`, `h2.headline mb-1 text-lg font-semibold`, `p.mb-3 text-xs text-ink-muted` (all sections in `src/app/settings/page.tsx`)
- Buttons: secondary style `bg-well text-ink-soft hover:bg-well-strong`, `min-h-[40px]` (Auto-Refresh grid)
- `src/components/LoadingSpinner.tsx`

## New primitive needed?
No. One new component `src/components/BackupSection.tsx` keeps the 1700-line settings page from growing.

## Accessibility
- Hidden `<input type="file">` with `aria-label`; the visible button triggers it.
- Result and error in an `aria-live="polite"` region.
- Both controls are real `<a>` / `<button>` elements, keyboard reachable in DOM order.

## Open questions
None.
