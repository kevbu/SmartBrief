# PRD — SmartBrief Q3 Feedback Learning

## 1. Executive Summary

We're completing the feedback learning layer in SmartBrief — a self-hosted personal news PWA — so that both explicit feedback (More/Less like this, Too negative, etc.) and implicit reading behavior (opens, skips) shape the topic composition of each briefing. This sprint adds topic-level preference weighting to the feed ranking algorithm, wires implicit engagement signals, explains each article's appearance to the user, surfaces a Learned Preferences UI, and fixes a temporal bug in the Weekly Recap that makes the stats unreliable. The result: Kevin sees concrete evidence that the app is learning from him, can inspect and correct what it learned, and trusts the weekly stats he reads.

---

## 2. Problem Statement

Kevin needs a way to see SmartBrief actually learning his topic preferences over time — through both explicit feedback and implicit reading behavior — because today only source-level signals are tracked and applied, which means weeks of feedback produces no visible improvement in topic relevance, leaving him uncertain whether the personalization system is worth trusting.

**Root causes:**
- `TopicWeight` Prisma model exists but is never queried or applied in `balance-filter.ts`
- `FeedbackSignal` model exists but is only written by explicit feedback actions; article opens/skips are not instrumented
- `Article.readAt` field does not exist — Recap page uses `fetchedAt` as a proxy, making weekly stats measure "when articles arrived" not "when Kevin read them"
- No UI surfaces current learned weights; no reset path exists

---

## 3. Target Users & Personas

**Primary — Kevin (sole user)**
- Self-hosted, single-user instance; privacy-first, no external analytics
- Reads morning briefings on iPhone; occasional iPad at lunch
- Gives explicit feedback; wants the feed to improve without manual curation
- Trusts systems he can inspect and override; distrusts black boxes

**Jobs-to-be-done:**
- "Get a briefing that reflects what I care about today, not just what's most recent"
- "Understand why the app showed me this article"
- "See that last week's feedback actually changed something this week"
- "Fix it when the app learned something wrong"

---

## 4. Strategic Context

**Why this sprint:** Q2 shipped source-level learning + feedback UX polish. Q3 completes the learning loop: topic-level weighting + implicit signals = a feed that provably adapts. Without this, the feedback system is a feature demo rather than a core differentiator.

**Why now:** All data models are in place (TopicWeight, FeedbackSignal in schema). The source-weight pattern in `src/lib/source-weights.ts` is a clean template to replicate. Implementation risk is low; integration effort is 4–5 days.

**No external dependencies.** All computation is local SQLite; no new libraries required.

---

## 5. Solution Overview

### Deliverable 1 — Recap Temporal Bug Fix (prerequisite)
Add `readAt DateTime?` to `Article` model. Set it when `isRead = true` via the read API route. Update Recap route to `WHERE readAt >= since AND readAt IS NOT NULL`. This is a prerequisite for all other Recap accuracy work.

### Deliverable 2 — Topic Weight Integration
Extend `balance-filter.ts` to compute a `preference_score` that blends source weights (already live) and topic weights (new), then apply:

```
preference_score = Σ(source_signals_decay) + Σ(topic_signals_decay)
final_rank = recency_rank × (1 + preference_weight × preference_score)
```

Sentiment balance (mood preset) is enforced **after** preference scoring — the mood preset allocates buckets; preference scoring sorts within each bucket.

Build `src/lib/topic-weights.ts` modelled on `src/lib/source-weights.ts`. Decay: exponential, half-life 14 days. Auto-delete signals > 90 days old on app startup.

### Deliverable 3 — Implicit Signals
In `ArticleCard` / article detail component:
- Article opened (detail sheet shown) → write `FeedbackSignal { type: 'read', weight: +0.2, topic, sourceId }`
- Article visible in viewport for > 5 seconds without open → write `FeedbackSignal { type: 'skip', weight: -0.1, topic, sourceId }`

Use `IntersectionObserver` for visibility tracking; 5s timer starts on intersection, cancels on open or scroll away.

### Deliverable 4 — "Why am I seeing this?"
Each `ArticleCard` shows a reason chip on tap-hold (mobile) or hover (desktop). Reason is computed server-side when articles are fetched:

| Condition | Reason string |
|-----------|---------------|
| topicWeight > 0.15 | "You like [Topic]" |
| sourceWeight > 0.15 | "Source boosted by your feedback" |
| topicWeight < −0.10 | (article would be suppressed — shouldn't appear) |
| isBreaking = true | "Breaking news" |
| default | "Relevant to [Topic]" |

Reason is a new optional field on the article API response; not persisted.

### Deliverable 5 — Learned Preferences UI
New collapsible section in Settings page: **"What SmartBrief has learned"**

- Top 3 boosted topics (highest positive topicWeight)
- Top 3 suppressed topics (most negative topicWeight)
- Suppressed sources (sourceWeight ≤ −0.5 or hidden)
- Per-entry "Reset" button (deletes signals for that topic/source)
- "Reset all learning" button at bottom with confirmation dialog: "This will delete all learned preferences. Your explicit feedback (hide source, etc.) will also be cleared. Are you sure?"

---

## 6. Success Metrics

| Metric | Target |
|--------|--------|
| Feed assembly time with preference scoring | < 300ms |
| Recap render time | < 800ms |
| Recap stats accuracy | Reflects actual read dates (visual verification) |
| Topic weight applied to feed | Verified: changing a topic signal moves its articles up/down in feed |
| Implicit signal write rate | > 80% of article opens produce a `read` signal within 1s |
| Learned Preferences visible | Settings shows populated weights after ≥ 5 feedback actions |

**Guardrails:**
- Lighthouse FCP must not regress below 1.5s on simulated 4G
- Mood preset sentiment balance must still be respected (topic preference never overrides sentiment ratio)

---

## 7. User Stories & Requirements

### Epic Hypothesis
We believe that completing topic-level preference learning (signals + ranking + transparency UI) will make Kevin notice the feed improving week-over-week and trust that his feedback is being used — measured by him being able to see accurate learned weights in Settings and observe topic mix shifting toward preferred topics.

---

### Story 1 — Recap shows when I actually read articles (not when they were fetched)

**Acceptance criteria:**
- [ ] `Article` model has `readAt DateTime?` field (nullable)
- [ ] `POST /api/articles/[id]/read` sets `readAt: new Date()` alongside `isRead: true`
- [ ] Recap query uses `WHERE readAt >= $since AND readAt IS NOT NULL`
- [ ] Existing articles without `readAt` show in empty state for historical weeks (no fabricated data)
- [ ] Prisma migration runs cleanly; no data loss

---

### Story 2 — Topic preferences are applied to my feed

**Acceptance criteria:**
- [ ] `src/lib/topic-weights.ts` exists, modelled on `source-weights.ts`
- [ ] `FeedbackSignal` writes for explicit feedback update topic weights
- [ ] `balance-filter.ts` reads topic weights and blends them into `preference_score`
- [ ] Feed ranking formula: `final_rank = recency_rank × (1 + preference_weight × preference_score)`
- [ ] Sentiment balance enforced **after** preference scoring (test: giving 5× "Less like this" on Tech articles does not remove all Tech from a feed configured for 40% neutral)
- [ ] Feed assembly completes in < 300ms (verify with `console.time` in dev)
- [ ] Decay function: `weight × 0.5^(daysSince/14)` applied at query time

---

### Story 3 — Reading and skipping articles are tracked as implicit signals

**Acceptance criteria:**
- [ ] Opening an article detail sheet writes `FeedbackSignal { type: 'read', weight: 0.2, topic, sourceId }`
- [ ] An article visible in viewport for > 5 consecutive seconds without open writes `FeedbackSignal { type: 'skip', weight: -0.1, topic, sourceId }`
- [ ] IntersectionObserver used; timer starts at intersection, cancels on scroll-away or open
- [ ] Duplicate signals de-duped: max 1 read + 1 skip signal per article per session
- [ ] Signals written async (fire-and-forget); never block article open interaction
- [ ] API endpoint: `POST /api/articles/[id]/signal` accepts `{ type: 'read' | 'skip' }`
- [ ] `feedback_signals` table indexed on `(topic, created_at)` and `(source_id, created_at)`

---

### Story 4 — I can see why each article appeared in my feed

**Acceptance criteria:**
- [ ] Each `ArticleCard` has a "Why?" trigger: tap-hold on mobile, hover tooltip on desktop
- [ ] Reason computed in `/api/news` response, added as `reason` field to article DTO
- [ ] Reason strings (in priority order): "Breaking news" → "You like [Topic]" → "Source boosted by your feedback" → "Relevant to [Topic]"
- [ ] Tooltip dismisses on tap-outside or focus-away
- [ ] Reason shown in article detail sheet as well (secondary text line)
- [ ] `reason` field is never null — always has a fallback

---

### Story 5 — I can see and reset what SmartBrief has learned

**Acceptance criteria:**
- [ ] Settings page has "What SmartBrief has learned" section (collapsible, collapsed by default)
- [ ] Shows top 3 boosted topics (topicWeight > 0), top 3 suppressed topics (topicWeight < 0), and hidden/suppressed sources
- [ ] Each entry shows: label + weight bar + "Reset" button
- [ ] Tapping "Reset" deletes all `FeedbackSignal` rows for that topic/source; reloads list
- [ ] "Reset all learning" button at section bottom; tapping opens confirmation dialog
- [ ] Confirmation dialog: "Delete all learned preferences? This clears topic boosts, source boosts, and hidden sources. Can't be undone." — two buttons: Cancel / Delete
- [ ] After reset, section shows "No preferences learned yet"
- [ ] If < 3 weighted topics exist, show only those available (no placeholder rows)

---

## 8. Out of Scope

- **Sentiment-level learning** — `effectiveNegativeRatio()` adjustment already exists; no changes this sprint
- **Cross-device sync** — self-hosted, single-device; not applicable
- **Explanation ML model** — reason strings are rule-based, not AI-generated
- **Push notification UI** — Q4 scope
- **Newsletter ingestion UI** — Q4 scope
- **Next.js 14 → 16 upgrade** — post-Q3 maintenance sprint
- **"Why am I seeing this?" for Top Stories** — Top Stories are AI-synthesized clusters; reason logic doesn't map cleanly; deferred

---

## 9. Dependencies & Risks

| Item | Notes |
|------|-------|
| Prisma migration for `readAt` | Must run `prisma migrate dev`; backward-compatible (nullable field) |
| `feedback_signals` indexes | Add during migration; needed for <300ms query performance |
| `IntersectionObserver` | Supported in all target browsers (Chrome, Safari iOS/iPadOS) |
| No new npm packages | All patterns replicated from existing code |

**Risks:**

| Risk | Mitigation |
|------|-----------|
| Skip signal fires too aggressively (every slow scroll) | De-dup to max 1 skip per article per session; only fire if visible > 5s continuously |
| Topic preference overrides sentiment balance | Enforce sentiment filter first, then preference-sort within each bucket |
| `readAt` migration corrupts existing data | Field is nullable; existing rows get NULL (expected); only new reads get timestamps |

---

## 10. Open Questions

All resolved:

| Question | Decision |
|----------|----------|
| Should preference_weight be exposed to user? | Yes — already in Advanced Settings as "Learning strength" (Low/Med/High) |
| Should implicit signals be opt-out? | No — single user, self-hosted; no privacy concern; keep simple |
| Should "Why?" be always visible or on demand? | On demand (tap-hold / hover) — keeps card UI clean |
| Should Reset per-topic delete source signals too? | No — topic reset deletes topic signals; source reset deletes source signals; independent |
