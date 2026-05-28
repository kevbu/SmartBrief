# SmartBrief — Product Documentation

> **Mission:** Stay informed. Stay balanced. Stay sane.

*Last updated: 2026-05-28*

---

## Document Index

| Document | Purpose |
|----------|---------|
| **This file** | Product overview, personas, roadmap, design principles |
| [docs/backlog.md](backlog.md) | Story point estimates, value÷effort prioritisation, full backlog |
| [docs/open-decisions.md](open-decisions.md) | Open and resolved product decisions |
| [docs/qa-checklist.md](qa-checklist.md) | Browser/device/feature checklist for every release |
| [docs/metrics.md](metrics.md) | SQLite queries for every success metric |
| [docs/infrastructure.md](infrastructure.md) | Docker, env vars, Node.js version, VAPID, IMAP notes |
| [docs/prds/newsletter-ingestion.md](prds/newsletter-ingestion.md) | Newsletter ingestion spec (backend built; IMAP UI open) |
| [docs/prds/push-notifications.md](prds/push-notifications.md) | Push notifications spec (fully shipped) |
| [docs/performance-audit-q2-2026.md](performance-audit-q2-2026.md) | Q2 Lighthouse audit — fixes applied and baseline recorded |

---

## 1. Product Overview

SmartBrief is a self-hosted personal news app that aggregates the sources you care about and delivers them as a calm, focused daily briefing — without the anxiety spiral that comes with mainstream news feeds.

**Core differentiator:** The only personal news app that combines multi-language (EN + DE) aggregation, AI sentiment balancing, AI story clustering, finite session design, and full self-hosting — in one product.

---

## 2. The Problem

Most news apps are optimised for engagement, not wellbeing:
- They surface the most alarming headlines to maximise clicks
- They show the same story ten times from ten different outlets
- They never signal when you have read enough
- Result: readers feel informed but anxious, or overwhelmed and numb

SmartBrief flips this model: finite briefings, AI-balanced sentiment, zero infinite scroll.

---

## 3. Value Proposition

| For | Who | SmartBrief | Unlike |
|-----|-----|------------|--------|
| Informed individuals | Want to follow world events without doomscrolling | Delivers a finite, AI-balanced briefing from trusted sources | Perplexity / Apple News / Google News |
| German-speaking readers | Follow both German and English media | Combines EN + DE sources in one unified feed | No competitor does this well |
| Privacy-conscious users | Do not want their reading habits sold | Fully self-hosted, no tracking, no ads | Every mainstream news app |

---

## 4. User Personas

### Primary — Kevin, the Informed Professional
- **Age:** 30s, works in tech/business
- **Reading habits:** Morning on iPhone, lunch on iPad
- **Motivation:** Stay well-informed; avoid anxiety from doom-scrolling
- **Sources:** German (Spiegel, Handelsblatt, Zeit) + English (Wired, BBC)
- **Wants:** Quality over quantity, positive/negative balance, no cross-source repetition
- **Pain point:** Perplexity News is great but leaves him feeling depressed
- **Jobs-to-be-done:** Know what happened today; feel done when briefing ends

### Secondary — The Casual but Curious Reader
- Checks news a few times a week, not every day
- Wants to catch up quickly without missing major stories
- Values the "briefing complete" signal
- Prefers Constructive mood preset
- **Jobs-to-be-done:** Quick catch-up without overwhelm

### Tertiary — The Deep Diver
- Uses Deep mode to read full AI summaries before clicking through
- Actively manages source list (disables tabloids, adds niche outlets)
- Uses Saved articles heavily to queue long reads
- **Jobs-to-be-done:** Evaluate story depth before committing time

---

## 5. User Journey

### Primary — Morning Briefing (Kevin)

```
Wake up
  ↓
Open SmartBrief (PWA on iPhone home screen)
  ↓
"Good morning — your briefing has 15 stories"
  ↓
Scan feed — TopStory clusters at the top (multi-source AI brief)
  ↓
Tap a story → Detail sheet slides up
  • 3–5 AI bullet points
  • "Read at BBC" / "Read at Reuters" buttons
  ↓
Continue scrolling — Bright Spots tab for uplifting news
  ↓
"Briefing complete ✓" — session ends, no infinite scroll
  ↓
Optional: save articles for later reading
  ↓
Close app — feeling informed, not overwhelmed
```

### Secondary — Weekly Catch-Up (Casual Reader)

```
Open app after 3 days away
  ↓
Briefing auto-sized to Constructive preset
  ↓
Scan major stories, skip niche topics
  ↓
"Briefing complete ✓"
  ↓
Close — up to speed, no guilt
```

---

## 6. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend + API | Next.js 16 (App Router) + TypeScript | Single codebase, excellent mobile performance |
| Styling | Tailwind CSS v3 | Mobile-first, no runtime CSS |
| Database | SQLite via Prisma | Zero external services, simple self-hosting |
| AI — sentiment scoring | Claude Haiku (claude-haiku-4-5) | Fast, cheap batch scoring |
| AI — story briefs + bullets | Claude Sonnet (claude-sonnet-4-6) | Best quality for synthesis |
| News sources | RSS feeds | Free, no API keys, reliable |
| Deployment | Docker + docker-compose | One command deploy anywhere |
| Reverse proxy | Nginx Proxy Manager | Free HTTPS via Let's Encrypt |

---

## 7. Privacy Model

- **No accounts.** Single-user app; all preferences stored locally in SQLite.
- **No telemetry.** Zero data sent anywhere except to RSS feeds and the Anthropic API (article text only, for summarisation).
- **No ads.** No third-party scripts, no tracking pixels.
- **Your server.** You own the data. Shut it down and it's gone.

---

## 8. Feature Set

### Shipped

| Feature | Description |
|---------|-------------|
| Multi-source story clusters | Claude groups same-story articles across sources into synthesised cluster cards |
| AI bullet points | Tap any article → bottom sheet with 3–5 factual bullets (Claude Haiku, cached) |
| Sentiment balance | Every article scored −1 to +1; feed enforces configurable pos/neu/neg ratio |
| Mood presets | One-tap: Balanced (40/40/20), Constructive (60/35/5), Hard News (20/40/40) |
| Session mode | Finite briefing of 5–30 articles; progress bar + complete screen when done |
| Topic tabs | All · Tech & AI · Science & Health · Business · World · Bright Spots |
| Source toggle | Enable/disable individual sources, grouped by category and language (EN/DE) |
| Self-hosted | Docker + docker-compose; SQLite; no external dependencies |
| Password protection | Cookie-based login; 30-day session |
| PWA | Install to iPhone/iPad home screen; standalone app feel |
| Auto-refresh | Configurable interval (30m–4h); manual refresh button |
| Bright Spots tab | Dedicated feed of only positive/uplifting stories |
| Bias labels | Source labelled Center / Center-Left / Center-Right |
| Save & read later | Bookmark articles; dedicated Saved tab |
| Article feedback | Per-card: More like this / Less like this / Too negative / Off-topic / Hide source |
| German sources | Spiegel, Zeit, Tagesschau, Heise, t3n, Handelsblatt, Süddeutsche Zeitung |
| Dark mode | Full OS-level dark mode across all surfaces |
| Weekly news-diet recap | Topic mix %, sentiment %, bias spread over the past 7 days |
| Feedback learning | Signals adapt feed composition; source + topic weight decay |
| "Why am I seeing this?" | Per-card reason chip in skim mode |
| Learned Preferences UI | Settings screen surfacing boosted/suppressed sources + topics |
| Push notifications | Breaking news alerts — opt-in, daily cap, quiet hours, history log |
| Newsletter ingestion | Webhook + IMAP pipeline; per-service setup guides; source management UI |

### Open (Unscheduled)

| Feature | Value | Effort | Notes |
|---------|-------|--------|-------|
| IMAP configuration UI | 2 | 2 | Backend exists; UI missing |
| Weekly AI coaching summary | 3 | 2 | v2 of Recap; adds Haiku API cost/week |
| 4-week trend view in Recap | 3 | 2 | Needs 4 weeks of data to be useful |
| Push end-of-day digest | 3 | 2 | Different UX contract from breaking news |
| OPML import | 2 | 2 | Power-user feature |
| PWA offline mode | 3 | 4 | Service Worker complexity |
| `/admin/metrics` page | 3 | 1 | Surfaces SQLite metrics without manual queries |

---

## 9. Roadmap

| Version | Status | Key Features |
|---------|--------|-------------|
| v1.0 | ✅ Shipped | Core RSS, Claude synthesis, sentiment, PWA, Docker |
| v1.1 (Q2 2026) | ✅ Shipped | Feedback UX polish, source management, dark mode, performance audit |
| v1.2 (Q3 2026) | ✅ Shipped | Weekly Recap, Feedback Learning, "Why am I seeing this?" |
| v1.3 (Q4 2026) | ✅ Shipped | Push notifications, newsletter ingestion, story clustering |

**Maintenance backlog:**
- Next.js 14 → 16 upgrade — completed 2026-05-28
- IMAP configuration UI — unscheduled

---

## 10. Design Principles

1. **Finite over infinite.** Every session has a defined end. Users should feel done, not guilty.
2. **Calm over alarming.** Sentiment balance is a feature, not a filter. Negative news has its place; dominance does not.
3. **Transparent over opaque.** Bias labels, sentiment scores, and source attribution are always visible.
4. **Private by default.** No data leaves the user's server except article text to the Anthropic API.
5. **Simple over powerful.** One-tap presets before advanced sliders. Defaults should work for most users without configuration.
6. **No engagement hacks.** No streaks, no social proof, no infinite scroll, no push by default.
