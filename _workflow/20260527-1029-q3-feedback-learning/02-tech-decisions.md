# Tech Decisions — SmartBrief Q3 Feedback Learning

## Codebase Audit Finding

**The Q3 Feedback Learning sprint is almost entirely already implemented.** Audit of the actual source files revealed:

| PRD Deliverable | Status | Evidence |
|----------------|--------|---------|
| Recap temporal bug (readAt) | ✅ DONE | `schema.prisma:26`, `read/route.ts:14`, `recap/route.ts:24` |
| Topic weights wired to feed ranking | ✅ DONE | `balance-filter.ts:6–26`, `news/route.ts:61–64` |
| Implicit read signal | ✅ DONE | `read/route.ts:17–27` writes FeedbackSignal + upsertTopicWeight |
| Implicit skip signal (IntersectionObserver) | ✅ DONE | `ArticleCard.tsx:44–80`, `page.tsx:357–364`, `signal/route.ts` |
| Signal cleanup >90 days | ✅ DONE | `topic-weights.ts:12–24`, called in `news-aggregator.ts:180` |
| "Why am I seeing this?" server-side | ✅ DONE | `balance-filter.ts:120–157`, `news/route.ts:112–119` |
| "Why am I seeing this?" in detail sheet | ✅ DONE | `ArticleDetail.tsx:161–164` |
| "Why am I seeing this?" in deep mode card | ✅ DONE | `ArticleCard.tsx:186–191` |
| Learned Preferences UI | ✅ DONE | `settings/page.tsx:369–622` (LearnedPreferencesSection) |
| Per-entry topic/source Reset | ✅ DONE | `preferences/learned/route.ts:81–103` |
| Global Reset All with confirmation | ✅ DONE | `settings/page.tsx:590–619` |
| Learning strength (preferenceWeight) | ✅ DONE | `settings/page.tsx:554–587` |

## One Genuine Gap: "Why am I seeing this?" in Skim Mode

`ArticleCard.tsx` line 186 shows `article.reason` conditionally:
```tsx
{depthMode === 'deep' ? (
  <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-300 dark:text-gray-600">
    <span>✦</span>
    <span>{article.reason ?? `From ${article.source} · ...`}</span>
  </p>
) : null}
```

In skim mode (default), `article.reason` is only accessible after opening the detail sheet. The PRD specifies tap-hold (mobile) / hover (desktop) on the card itself.

**Fix:** Add a long-press / hover tooltip to `ArticleCard` that shows `article.reason` regardless of depth mode. Conditionally render — only when `article.reason` is present.

## Bonus Cleanup: Remove Redundant Old "Personalisation" Section

`settings/page.tsx:1364–1412` has an old "Personalisation" section that predates `LearnedPreferencesSection`. It calls `DELETE /api/settings/personalisation` and only tracks source-weight count. The new `LearnedPreferencesSection` at line 1588 supersedes it completely. Delete the old section and remove the `activeWeights` / `showResetConfirm` / `isResetting` / `resetDone` state variables.

## File Change Plan

### 1. `src/components/ArticleCard.tsx` — Add skim-mode reason tooltip

**Approach:** Long-press handler (mobile) + hover state (desktop). No new dependencies.

```
- Add `reasonVisible` state (boolean)
- Add `pointerDown` / `pointerUp` timer for long-press (500ms threshold)
- On hover (desktop): show reason on mouseenter, hide on mouseleave
- Render a small tooltip chip below the description in skim mode when reason is present and reasonVisible
- Only renders when `article.reason` exists (no fallback in skim mode — reason only exists when learning is active and weights exist)
```

Long-press pattern (no library needed):
```tsx
const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
function handlePointerDown() {
  pressTimerRef.current = setTimeout(() => setReasonVisible(true), 500)
}
function handlePointerUp() {
  if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
}
// Dismiss on next tap (toggle)
```

### 2. `src/app/settings/page.tsx` — Remove old Personalisation section

Delete lines 1364–1412 (the old "Personalisation" `<section>` block).

Remove now-unused state:
- `activeWeights` + `setActiveWeights`
- `showResetConfirm` + `setShowResetConfirm`
- `isResetting` + `setIsResetting`
- `resetDone` + `setResetDone`

Remove the `handleResetPersonalisation` function and the `GET /api/settings/personalisation` fetch in the load effect.

## No New Files Required

`topic-weights.ts`, `balance-filter.ts`, `signal/route.ts`, `preferences/learned/route.ts` — all complete. No schema migrations needed (`readAt` already exists with index).

## CLAUDE.md Update

```markdown
## Workflow Config
| Key | Value |
|-----|-------|
| workflow-dir | _workflow |
| dev-cmd | npm run dev |
| test-cmd | npm run test |
| lint-cmd | npm run lint |
| build-cmd | npm run build |
```
