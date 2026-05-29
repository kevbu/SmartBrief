# SmartBrief — Design System

*Last updated: 2026-05-29*

This document is the source of truth for visual decisions in SmartBrief. All new UI work — components, pages, one-off elements — should follow these patterns. The overhaul was applied to the primary feed components in May 2026; the secondary pages (`settings`, `saved`, `recap`) still use the old `gray-*` tokens and should be migrated to slate when touched.

---

## Design Direction

**Editorial Dark Minimal.** SmartBrief is a personal reading tool used at the start or end of the day. The UI should stay out of the way of the content: generous whitespace, strong type hierarchy, no decorative chrome. Think Reeder or Readwise Reader, not a news website.

- Content-first: articles and headlines dominate; UI controls are recessive
- Dark mode is the primary experience (themeColor `#0f172a`)
- Neutral palette with a single blue accent — no rainbow of accent colors
- SVG icons only; no emoji as UI chrome

---

## Color Palette

All colors come from Tailwind's **slate** scale, which has a slight blue tint making it feel editorial rather than purely neutral. Do not mix `gray-*` and `slate-*` in the same component — they are different hues.

### Semantic Roles

| Role | Light | Dark | Notes |
|---|---|---|---|
| Page background | `bg-slate-50` | `bg-slate-950` | Set in `globals.css` on `body` |
| Card surface | `bg-white` | `bg-slate-900` | |
| Card border | `ring-1 ring-slate-100` | `dark:ring-slate-800` | Never use `shadow-sm`; use ring |
| Card hover | `hover:ring-slate-200` | `dark:hover:ring-slate-700` | |
| Header / BottomNav bg | `bg-white/95` | `dark:bg-slate-950/95` | With `backdrop-blur-sm` |
| Separator | `border-slate-100` | `dark:border-slate-800` | Dividers, nav borders |
| Primary text | `text-slate-900` | `dark:text-slate-100` | Headlines, labels |
| Secondary text | `text-slate-600` | `dark:text-slate-400` | Source names, descriptions, body copy |
| Muted text | `text-slate-400` | `dark:text-slate-500` | Timestamps, meta, truly supplementary info |
| Input background | `bg-slate-100` | `dark:bg-slate-800` | Toggle backgrounds, tab bars |

### Accent Colors

| Color | Tailwind | Usage |
|---|---|---|
| Blue | `blue-500` | Primary CTA, active states, links, session progress, badges |
| Emerald | `emerald-500` | Positive sentiment, completion states, sync dot |
| Amber | `amber-400 / amber-500` | Negative/in-focus sentiment, warnings |
| Indigo | `indigo-50 / indigo-700` | Recap teaser card only |

**Never** use `blue-600` for primary interactive elements (the old value). Use `blue-500` — it reads better in dark mode and is still WCAG-compliant on white.

### Sentiment Palette

| Sentiment | Background (light) | Background (dark) | Text (light) | Text (dark) |
|---|---|---|---|---|
| Positive | `bg-emerald-50 ring-1 ring-emerald-100` | `dark:bg-emerald-950/40 dark:ring-emerald-900/60` | `text-emerald-700` | `dark:text-emerald-400` |
| Neutral | `bg-white ring-1 ring-slate-100` | `dark:bg-slate-900 dark:ring-slate-800` | — | — |
| Negative | `bg-amber-50 ring-1 ring-amber-100` | `dark:bg-amber-950/40 dark:ring-amber-900/60` | `text-amber-700` | `dark:text-amber-400` |

These are used in `TopStoryCard` backgrounds. Match them exactly when adding sentiment-coded surfaces.

### Custom Tailwind Tokens (`tailwind.config.ts`)

Three semantic color aliases are defined. These are available but **not used** in the current component library — they exist for future chart or data-viz use.

```ts
colors: {
  positive: { DEFAULT: '#10b981', light: '#ecfdf5', border: '#6ee7b7' },  // = emerald
  neutral:  { DEFAULT: '#9ca3af', light: '#f9fafb', border: '#e5e7eb' },  // = gray
  negative: { DEFAULT: '#f59e0b', light: '#fffbeb', border: '#fcd34d' },  // = amber
}
```

---

## Typography

Font: **Inter** (loaded via `next/font/google`, served from the app's own origin). Applied via the CSS variable `--font-inter` on `body` through the `font-sans` Tailwind class.

### Scale in Use

| Role | Size | Weight | Class |
|---|---|---|---|
| App title | 17px | Bold | `text-[17px] font-bold tracking-tight` |
| Page heading | `text-xl` (20px) | Bold | `text-xl font-bold leading-snug` |
| Card headline | `text-sm` (14px) | Semibold | `text-sm font-semibold leading-snug` |
| Top story title | `text-[15px]` | Bold | `text-[15px] font-bold leading-snug` |
| Body / description | `text-xs` (12px) | Normal | `text-xs leading-relaxed` |
| Meta / source row | `text-xs` (12px) | Medium for source name | `text-xs` |
| Micro labels | `text-[11px]` | — | Timestamps, sync status |
| Pill labels | `text-[11px]` / `text-xs` | Bold (uppercase badges) / Medium | `text-[11px] font-bold uppercase tracking-wider` |

**Line height:** Use `leading-snug` (1.375) for headlines to prevent excessive gaps at small sizes. Use `leading-relaxed` (1.625) for body/description text to aid reading.

**Line clamping:** Three utilities are defined in `globals.css`: `line-clamp-2`, `line-clamp-3`, `line-clamp-4`. Use these on card descriptions.

---

## Spacing & Layout

**Container:** `max-w-md mx-auto` — set in `layout.tsx`. All content is constrained to ~448px wide. This never changes.

**Card gutter:** `mx-4` — all cards, banners, and standalone blocks use this horizontal margin. Do not go wider or narrower.

**Card gap:** `mb-2` between cards (was `mb-3` before the overhaul; `mb-2` feels tighter and more focused).

**Page chrome:** `pb-24` on `<main>` to clear the 52px fixed bottom nav plus safe area.

**Safe area:** `pb-safe` (defined in `globals.css`) applies `env(safe-area-inset-bottom)` for iPhone home indicator clearance.

---

## Card Pattern

The canonical card in SmartBrief:

```tsx
<div className="mx-4 mb-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
```

Additions when the card is interactive:

```tsx
// Clickable card
className="... cursor-pointer transition-all active:scale-[0.99] hover:ring-slate-200 dark:hover:ring-slate-700"

// Read/dimmed state
className={clsx('...', isRead && 'opacity-55')}
```

**Never** use `shadow-sm` for cards — it was removed in the overhaul. The `ring-1` approach reads better in both modes and avoids the halo artifact on dark backgrounds.

### Sentiment-tinted Cards

Used for `TopStoryCard` and completion/status banners. Replace the base `bg-white ring-slate-100` surface with the appropriate sentiment palette row (see Color Palette above).

### TopStoryCard Accent Bar

Top story cards use a 4px left accent bar to signal importance and sentiment at a glance:

```tsx
<div className="flex overflow-hidden rounded-2xl">
  <div className={clsx('w-1 flex-shrink-0 rounded-l-2xl', accentColor)} />
  <div className="flex-1 p-4">…</div>
</div>
```

Accent colors: `bg-emerald-500` (positive), `bg-blue-500` (neutral), `bg-amber-500` (negative).

---

## Iconography

**Rule: no emoji as UI icons.** Emoji are only acceptable where they represent external domain identity (source favicon alternatives via `getEmojiForSource`, newsletter `✉️`). All structural UI icons use inline SVGs.

**Source:** [Heroicons](https://heroicons.com) and [Lucide](https://lucide.dev). Both use 24×24 viewBox; size with `h-N w-N` classes.

**Icon sizes in use:**

| Context | Size class |
|---|---|
| Bottom nav | `h-5 w-5` |
| Header logo | `h-4 w-4` (inside a 28px container) |
| Card actions (save, feedback trigger) | `h-4 w-4` to `h-5 w-5` |
| Feedback menu items | `h-4 w-4` |
| Mood toggle | `h-3.5 w-3.5` |
| Category label | `h-3 w-3` |
| Inline text icons | `h-3 w-3` to `h-4 w-4` |

**Stroke weight:** `strokeWidth={1.5}` for standard outline icons. Use `strokeWidth={2}` for small icons that need more weight. Use `strokeWidth={1.75}` for the feedback menu and mood toggle where medium weight reads best.

**Pattern for inline icon components:**

```tsx
function SomeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="…" />
    </svg>
  )
}
```

Use `fill="currentColor"` only for solid/filled variants (e.g. active bookmark, star).

---

## Interactive States

### Touch targets
All tappable elements: minimum `h-11 w-11` (44×44 px, iOS HIG). Icon-only buttons use `flex items-center justify-center` inside the 44px container.

### Cursor
Add `cursor-pointer` to every interactive element including cards, buttons, and links. This was added in the overhaul.

### Press/active
Cards and card-like buttons: `active:scale-[0.99]`. Avoid `active:scale-95` — too dramatic at this size. 

### Hover (desktop)
Cards: `hover:ring-slate-200 dark:hover:ring-slate-700`  
Buttons: typically `hover:bg-slate-100 dark:hover:bg-slate-800` or a lighter variant of the element's fill color.

### Transitions
```
transition-colors   // for color-only changes (most buttons)
transition-all      // for cards with ring + scale
duration-200        // default for colors
duration-500        // for progress bars and data-driven segments
```

Never animate `width` or `height` directly — use `transform` and `opacity`. The only exception is the balance meter and session progress bar, which animate `width` via inline style.

### Disabled states
`disabled:opacity-40` (not `50`) — slightly more transparent to look clearly inactive without being invisible.

---

## Button Patterns

### Primary (full-width CTA)
```tsx
<button className="w-full cursor-pointer rounded-2xl bg-blue-500 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600">
  Action
</button>
```

### Secondary / ghost
```tsx
<button className="cursor-pointer rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
  Action
</button>
```

### Icon button (44px)
```tsx
<button className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
  <SomeIcon className="h-4 w-4" />
</button>
```

### Segmented control (tab bar inside a surface)
```tsx
<div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
  <button className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium
    bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100  // active
    text-slate-500 hover:text-slate-700 dark:text-slate-400                  // inactive
  ">…</button>
</div>
```

---

## Badge Patterns

### Status badge (e.g. "Top Story")
```tsx
<span className="rounded-full bg-blue-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
  Top Story
</span>
```

### Count / meta badge
```tsx
<span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
  4 sources
</span>
```

### Source pill (inside TopStoryCard)
```tsx
<span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200/60 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700/60">
  Reuters
</span>
```

### Sentiment badge (`SentimentBadge` component)
Rendered by the component — do not inline. The component uses an SVG icon + label, no emoji.

### Bias badge (`BiasBadge` component)
Uses a colored background scale: `bg-blue-600` (L) → `bg-blue-400` (CL) → `bg-gray-400` (C) → `bg-orange-400` (CR) → `bg-red-500` (R). Note: this component still uses `gray-400` for center — acceptable because it's a deliberate neutral signal, not a text color.

### Inline code / monospace
```tsx
<code className="rounded bg-slate-100 px-1 font-mono text-xs dark:bg-slate-800 dark:text-slate-300">
  VALUE
</code>
```

---

## Navigation

### Header (`Header` component)

Sticky, `z-10`, blurred backdrop. Structure: logo icon + wordmark + sync status on left; refresh button on right; MoodPresetToggle below.

```tsx
<header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/95">
```

The logo is a newspaper SVG icon inside a 28px `rounded-lg bg-blue-500` container. Do not replace with text or a different color.

The sync indicator is: green dot `h-1.5 w-1.5 rounded-full bg-emerald-400` + timestamp text. While refreshing, only the timestamp text is shown (no dot).

### Bottom Nav (`BottomNav` component)

Fixed, `z-20`, blurred backdrop. Four items: Home, Saved, Recap, Settings. Each item is a 52px minimum-height `Link` with stacked icon + label.

Active state: icon is wrapped in `rounded-full bg-blue-50 px-3 py-1 dark:bg-blue-500/10` pill. Active text is `text-blue-500 dark:text-blue-400`. Inactive text is `text-slate-400 dark:text-slate-500`.

Active icons use the `fill="currentColor"` (solid) variant; inactive icons use the `stroke` (outline) variant. This is handled by passing `active` as a boolean to each icon function.

### Page headers (secondary pages)

Secondary pages (Saved, Recap, Settings) should use the same sticky header pattern as the main `Header` component:

```tsx
<header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-950/95">
  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Page Title</h1>
  <p className="text-xs text-slate-400 dark:text-slate-500">Subtitle or status</p>
</header>
```

The current `saved/page.tsx` and `recap/page.tsx` use `border-gray-100 dark:bg-gray-900/95` — update these when the pages are next touched.

---

## Bottom Sheet (`ArticleDetail`)

Used as the article detail panel. Triggered by tapping a card, slides up from the bottom.

```tsx
{/* Scrim */}
<div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

{/* Sheet */}
<div className="fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900">
  {/* Drag handle */}
  <div className="sticky top-0 flex justify-center bg-white pt-3 pb-2 dark:bg-slate-900">
    <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
  </div>
  {/* Content */}
  <div className="px-5 pb-10 pt-1">…</div>
</div>
```

Key differences from generic modals: `rounded-t-3xl` (not `2xl`), `max-h-[88vh]`, and a sticky drag handle that stays fixed as content scrolls. Scrim uses `backdrop-blur-[2px]` for a frosted-glass feel.

Bullet points inside the sheet use `h-1.5 w-1.5 rounded-full bg-blue-400` dots instead of text characters.

---

## Status Banners

Banners (catch-up, warnings, API key missing) follow the card pattern with sentiment-appropriate coloring:

```tsx
// Info / catch-up
<div className="mx-4 mb-2 rounded-2xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:ring-blue-900/60">

// Warning / no API key
<div className="mx-4 mt-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:ring-amber-900/60">

// Error
<div className="mx-4 mt-3 rounded-2xl bg-red-50 p-3 ring-1 ring-red-100 dark:bg-red-950/40 dark:ring-red-900/60">

// Success / completion
<div className="mx-4 mb-3 rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/60">
```

Note the `/40` opacity on dark backgrounds (not `/50` as in the old system) — this prevents the tinted cards from overpowering the near-black background.

---

## Skeleton Loading

```tsx
<div className="mx-4 mb-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
  <div className="h-3 w-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
  {/* … */}
</div>
```

Use `rounded-lg` on skeleton lines (not `rounded`). The pulse animation is Tailwind's built-in `animate-pulse`.

---

## Toast

The undo toast is a pill anchored `bottom-24` (above the bottom nav) and centered:

```tsx
<div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 py-2.5 pl-4 pr-2 text-sm text-white shadow-xl shadow-slate-900/20">
  <span>{message}</span>
  <button className="cursor-pointer rounded-full bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30">
    Undo
  </button>
</div>
```

---

## Animation & Motion

Custom animations defined in `tailwind.config.ts`:

| Name | Effect | Duration |
|---|---|---|
| `animate-spin-slow` | 1.5s spin | Loading spinners |
| `animate-fade-in` | Fade up 4px, 200ms ease-in-out | Menus, tooltips |

`fadeIn` keyframe: `{ '0%': { opacity: 0, transform: translateY(4px) }, '100%': { opacity: 1, transform: translateY(0) } }`

Apply `animate-fade-in` to dropdown menus and tooltips. The FeedbackMenu dropdown currently does not apply this — add it if motion is desired.

**Respect reduced motion:** For any animation beyond the built-in Tailwind utilities, wrap in `@media (prefers-reduced-motion: no-preference)` or check in JS with `window.matchMedia('(prefers-reduced-motion: reduce)')`.

---

## Z-Index Scale

| Value | Usage |
|---|---|
| 10 | Sticky header |
| 20 | Fixed bottom nav |
| 30 | Dropdown menus (FeedbackMenu) |
| 40 | Bottom sheet scrim |
| 50 | Bottom sheet panel, undo toast |

Do not introduce new z-index values outside this scale without documenting them here.

---

## Page Migration Status

Secondary pages still use old `gray-*` design tokens and should be updated to `slate-*` when next touched:

| Page | Old tokens present | Priority |
|---|---|---|
| `src/app/settings/page.tsx` | `bg-gray-*`, `text-gray-*`, `border-gray-*`, `rounded-lg`, `shadow-sm` | Medium |
| `src/app/saved/page.tsx` | `border-gray-100`, `bg-gray-*`, `text-gray-*`, `dark:bg-gray-900/95` | Medium |
| `src/app/recap/page.tsx` | `bg-gray-*`, `text-gray-*`, `rounded-xl`, `dark:bg-gray-*` | Medium |
| `src/app/login/page.tsx` | Not audited | Low |

When migrating: `bg-gray-N` → `bg-slate-N`, `text-gray-N` → `text-slate-N`, `border-gray-N` → `border-slate-N`, `rounded-xl` on cards → `rounded-2xl`, `shadow-sm` → `ring-1 ring-slate-100 dark:ring-slate-800`.
