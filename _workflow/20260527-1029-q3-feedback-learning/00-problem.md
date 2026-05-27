# Problem Statement — SmartBrief Q3 Feedback Learning

## Problem Framing Narrative

**I am:** Kevin — a knowledge worker and solo developer running SmartBrief as my daily personal news briefing tool
- I consume news every morning on iPhone, occasionally on iPad at lunch
- I've taken the time to configure mood presets and category preferences, and I actively give feedback (More like this / Less like this / Too negative) because I want the feed to improve
- I care about balance — I don't want a filter bubble, but I do want the irrelevant stuff suppressed
- I self-host because I value privacy; there's no cloud service watching what I read

**Trying to:**
- Have a briefing that gets measurably smarter over time with minimal active effort — so that each morning the feed reflects what I actually find valuable, not just what's recent or popular

**But:**
- The app only learns at the source level — if I say "Less like this" on a Tech article, it doesn't learn that I'm currently less interested in *Tech*, it only slightly suppresses that specific source
- Articles I open and read (strong signal) are treated the same as articles I scroll past without tapping — both are invisible to the learning system
- After weeks of giving feedback, I have no way to see what the app has learned or reset a category that it got wrong
- Every article card looks the same regardless of why it appeared — I can't tell if it showed up because it's breaking news, because I said "More like this" on similar articles, or just because it was recent

**Because:**
- Topic-level weighting (`TopicWeight` model) exists in the database but is never applied in the feed ranking algorithm (`balance-filter.ts`)
- There is no instrumentation for implicit engagement — article opens and scroll-past events aren't written to `FeedbackSignal`
- The Recap page computes stats using `fetchedAt` (when the article was fetched from RSS) instead of `readAt` (when I actually read it), making weekly stats inaccurate
- There is no UI surface that reads back the learned source/topic weights or allows resetting them

**Which makes me feel:**
- Like I'm feeding the machine but it's only half-listening
- Uncertain whether the personalization is working at all, since there's no feedback loop showing me what changed
- Slightly distrustful of the "balanced" label — if the stats are based on fetch time rather than read time, the Recap is measuring the wrong thing

---

## Context & Constraints

- Single-user, self-hosted SQLite app — no multi-tenancy, no sync, all data local
- Must not regress performance: feed assembly target <300ms; Recap render target <800ms
- Sentiment balance (mood preset) must always win over preference scoring — personalization tunes *which* articles within a sentiment bucket, not *whether* a sentiment bucket is represented
- All signal processing at query time (no batch jobs, no background workers)
- Signals >90 days should auto-delete on app startup (cleanup, not a scheduled job)
- No new dependencies — use existing Prisma, Next.js, TypeScript patterns
- The existing `SourceWeight` implementation in `src/lib/source-weights.ts` is the canonical pattern to follow for topic weights

---

## Final Problem Statement

Kevin needs a way to see SmartBrief actually learning his topic preferences over time — through both explicit feedback and implicit reading behavior — because today only source-level signals are tracked and applied, which means weeks of feedback produces no visible improvement in topic relevance, leaving him uncertain whether the personalization system is worth trusting.
