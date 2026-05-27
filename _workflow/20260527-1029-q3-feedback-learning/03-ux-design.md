# UX Design — SmartBrief Q3 Feedback Learning

## Scope Revision

After auditing the codebase, the only missing UI piece is:

> **"Why am I seeing this?" visible in skim mode** (the default).

Currently: reason is shown in deep mode (inline text under description) and in the detail sheet (always). In skim mode it's invisible until the user opens the article.

The PRD specified: tap-hold on mobile / hover on desktop.

All other designed surfaces (Learned Preferences UI, Skip signals, deep mode reason) are already built and match the design system.

---

## Surface: Skim-Mode Reason Chip on ArticleCard

### Design Constraints

- Design mandate: "Add nothing that doesn't earn its space. Trust the content; the UI is the frame."
- Skim mode cards are already compact — no layout shifts allowed
- Reason only exists when learning is active AND weights have diverged from neutral
- Min tap target: 44×44pt (tooltip dismiss, not the chip itself)
- Motion: 200ms fade-in, decelerate easing, respects `prefers-reduced-motion`
- Dark-mode primary

### Trigger Mechanism

**Mobile (touch):**
- Long-press (500ms hold) on the article card body → show reason chip
- Second tap anywhere on card → dismiss chip and proceed with normal click
- Long-press should not fire if the user starts scrolling (cancel on `pointermove > 8px`)

**Desktop (mouse):**
- `mouseenter` on card → show reason chip after 300ms delay
- `mouseleave` → hide chip immediately (no linger)
- This is a passive observation, not an action, so no click required

### Visual Design

The reason chip appears **between description and footer** — same position as deep mode's `✦ reason` line, but as a small dismissible chip rather than always-visible text.

```
┌──────────────────────────────────┐
│ 🌐 BBC News · Center · 2h ago    │
│                                  │
│ Ukraine peace talks stall over   │  ← title (always)
│ nuclear plant access             │
│                                  │
│ Negotiators failed to agree...   │  ← description (skim: 2 lines)
│                                  │
│ ┌──────────────────────────┐     │  ← reason chip (appears on hold/hover)
│ │ ✦ Relevant to World News │     │
│ └──────────────────────────┘     │
│                                  │
│ [● Neutral]    [⋯ ☆]             │  ← footer (always)
└──────────────────────────────────┘
```

**Chip styling (Tailwind):**
```
inline-flex items-center gap-1 rounded-full
bg-gray-100 dark:bg-gray-800
px-2.5 py-1
text-[10px] text-gray-400 dark:text-gray-500
animate-fade-in  (200ms opacity 0→1)
```

The `✦` symbol is already used in deep mode for this label — use the same glyph for visual consistency.

**Reason strings from `computeArticleReason` (already implemented):**
- `"From {source} — a source you read often"` → truncate to `"Source you trust"`
- `"From {source} — included for variety"` → `"Included for variety"`
- `"{Topic} — your most-read topic"` → keep as-is
- `"Positive story — matches your Constructive preset"` → keep as-is
- `"Included for balance — you can hide it"` → keep as-is
- `"From {source} — based on your settings"` → `"Matched your settings"`

The existing reason strings are already readable but some are long for a chip. Apply the short-form mapping above when rendering in skim mode. Deep mode and detail sheet keep the long-form.

### Interaction Flow

```
User scrolls feed (skim mode)
  → Card enters viewport
  → [Mobile] User long-presses card body (500ms)
       → Chip fades in
       → Normal tap/release (< 500ms) proceeds as click (article opens or saves)
  → [Desktop] Mouse hovers card
       → After 300ms delay: chip fades in
       → Mouse leaves: chip fades out
  → Chip shows reason
  → [Mobile] Tapping card after chip is visible: dismisses chip first,
    second tap opens article (or immediately opens if tap is on title area)
```

### Accessibility

- Chip text is readable by screen readers (`aria-label` not needed — it's visible text)
- Long-press is enhancement only; reason also available in detail sheet (tap to open)
- `prefers-reduced-motion`: skip the fade, appear/disappear instantly

---

## Surfaces Already Correctly Implemented

These do not need changes — documenting for completeness.

### Deep Mode: Reason Line (ArticleCard.tsx:186–191)
```
✦ {article.reason}
```
Rendered as `text-[10px] text-gray-300 dark:text-gray-600` below description.
Matches design system. No changes needed.

### Article Detail Sheet (ArticleDetail.tsx:161–164)
`article.reason` rendered when present. Always visible regardless of depth mode.
No changes needed.

### Learned Preferences Section (settings/page.tsx:369–622)
Full component with:
- Toggle (enable/disable learning)
- Boosted topics (↑ green arrow, topic label, Reset link)
- Suppressed topics (↓ orange arrow, topic label, Reset link)
- Hidden sources (unhide link)
- Signal count footer
- Advanced: Learning strength 3-way toggle (Low/Medium/High)
- Reset all with confirmation
No changes needed.

---

## Micro-copy Recommendations

### Skim-mode chip (short forms)
| Long form | Short form chip |
|-----------|-----------------|
| "From BBC News — a source you read often" | "Source you trust · BBC News" |
| "Tech & AI — your most-read topic" | "You read a lot of Tech & AI" |
| "Positive story — matches your Constructive preset" | "Matches your Constructive preset" |
| "Included for balance — you can hide it" | "Included for balance" |
| "From BBC News — included for variety" | "Included for variety" |
| "From BBC News — based on your settings" | "Relevant to your feed" |

### Settings → Feed Learning (already implemented, no changes)
- Section header: **"Feed Learning"**
- Subtitle: "Adapts your feed based on what you read and skip"
- Empty state (0 signals): "No signals yet — start reading to personalise your feed"
- Empty state (signals but no strong weights): "No strong preferences detected yet — keep reading"
- Signal count: "{n} signal{s} recorded"
- Advanced label: "Learning strength"

---

## Pre-Delivery Checklist (for the one remaining change)

- [ ] Chip appears on long-press (500ms) on iOS Safari — test on real device
- [ ] Chip appears on hover (300ms delay) on desktop Chrome/Safari
- [ ] Chip does not appear when user is actively scrolling (pointermove cancels timer)
- [ ] Normal tap still works correctly when chip is not visible
- [ ] Chip fades in (200ms); instant if `prefers-reduced-motion: reduce`
- [ ] Chip only renders when `article.reason` is truthy (no empty chip)
- [ ] No layout shift — chip appears inline, does not push footer down by more than chip height
- [ ] Dark mode: chip text readable against `#0D0D0F` background
- [ ] Chip dismissed when card is scrolled out of view (IntersectionObserver already present)
