# UX Design — Newsletter Section

**Date:** 2026-06-01
**Feature:** Newsletter tab, list, expand-to-read, action bar

---

## 1. Tab Switcher

Sits directly above the article/newsletter list, between `Header` and topic pills. Topic pills hidden when Newsletters tab is active.

```
┌────────────────────────────────────────────┐
│  Header (unchanged)                         │
├────────────────────────────────────────────┤
│  [ Feed ]  [ Newsletters · 3 ]              │
├────────────────────────────────────────────┤
│  Topic pills (Feed tab only)                │
└────────────────────────────────────────────┘
```

**Switcher container:** `flex gap-0 border-b border-slate-800 px-4 bg-white dark:bg-slate-950`

**Inactive tab:** `pb-2.5 pt-3 px-4 text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer transition-colors hover:text-slate-700 dark:hover:text-slate-300`

**Active tab:** `pb-2.5 pt-3 px-4 text-sm font-medium text-slate-900 dark:text-slate-100 border-b-2 border-blue-500 cursor-pointer transition-colors`

**Unread badge:** `ml-1.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white tabular-nums` — hidden when count is 0. Show `99+` when count > 99.

---

## 2. Action Bar

Right-aligned above the newsletter list:

```
┌────────────────────────────────────────────┐
│              [ ↺ Poll now ] [ ✓✓ Mark all read ] │
├────────────────────────────────────────────┤
│  Newsletter cards...                        │
```

**Container:** `flex items-center justify-end gap-2 px-4 py-2`

**Button base:** `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100`

- Poll now: shows spinner + disabled (`opacity-50 cursor-not-allowed`) while loading
- Mark all read: `opacity-40 cursor-not-allowed pointer-events-none` when all already read

---

## 3. Newsletter Card (Collapsed)

```
┌─┬───────────────────────────────────────────┐
│▌│  Sender Name (bold)          2h ago        │
│ │  Subject line — up to 2 lines              │
│ │  Excerpt preview — muted                   │
└─┴───────────────────────────────────────────┘
```

Left `▌` = 3px absolute accent bar, `bg-blue-500`, visible only on unread cards.

**Card (unread):** `relative mx-4 mb-2 cursor-pointer rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-100 dark:ring-slate-800 transition-all hover:ring-slate-200 dark:hover:ring-slate-700 active:scale-[0.99] pl-5`

**Card (read):** same + `opacity-60`, accent bar hidden.

**Accent bar:** `absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-blue-500`

**Sender name:** `text-xs font-semibold text-slate-700 dark:text-slate-300`

**Timestamp:** `text-xs text-slate-400 dark:text-slate-500`

**Subject line:** `text-sm font-medium leading-snug text-slate-900 dark:text-slate-100 line-clamp-2 mt-0.5`

**Excerpt:** `text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2 mt-1`

---

## 4. Newsletter Card (Expanded — Accordion)

```
┌─┬───────────────────────────────────────────┐
│▌│  Sender Name (bold)          2h ago        │
│ │  Subject line                               │
├─┴─────────────────────────────────────────────┤
│  Full newsletter content (scrollable)          │
│  ...                                           │
│                          [ ↑ Close ]           │
└────────────────────────────────────────────────┘
```

**Divider:** `border-t border-slate-100 dark:border-slate-800 mt-3 pt-3`

**Content wrapper:** `max-h-[60vh] overflow-y-auto overscroll-contain scroll-smooth pr-1`

**Prose area:** `text-sm leading-relaxed text-slate-700 dark:text-slate-300 [&_p]:mb-3 [&_a]:text-blue-400 [&_a]:underline [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-3 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-2`

**Close button:** `flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer mt-3 ml-auto`

**Animation:** `transition-all duration-200 ease-in-out` on `max-h` (collapsed: `max-h-0 overflow-hidden opacity-0`, expanded: `max-h-[60vh] overflow-y-auto opacity-100`)

**Interaction rules:**
- Click collapsed card → expand + mark as read
- Click expanded card header OR Close button → collapse
- Only one card expanded at a time (auto-collapse previous)
- `scrollIntoView({ block: 'nearest', behavior: 'smooth' })` when expanded

---

## 5. Edge Cases

### Empty state
```
flex flex-col items-center justify-center gap-3 py-16 px-8 text-center
```
Icon (envelope) `text-4xl text-slate-600` + heading `text-sm font-medium text-slate-500` + body `text-xs text-slate-400 max-w-[220px]` + centered "Poll now" CTA.

### Loading state
3× skeleton cards matching existing `SkeletonCard` pattern in `page.tsx` — `animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800` bars.

### Error state
```
mx-4 mt-4 rounded-xl bg-red-950/30 border border-red-800/40 px-4 py-3 flex items-center justify-between gap-3
```
Message `text-xs text-red-400` + Retry button `text-xs text-red-300 underline`.

### Poll error
Transient inline message below action bar, auto-dismisses after 4s.

---

## 6. Accessibility

- Tab buttons: `role="tab"`, `aria-selected`
- Accordion cards: `aria-expanded` on trigger button
- Expanded region: `role="region"`, `aria-labelledby` → subject line id
- Unread tab: `aria-label="N unread newsletters"` on tab element
- Read/unread: dual cue — opacity + accent bar (not color alone)
