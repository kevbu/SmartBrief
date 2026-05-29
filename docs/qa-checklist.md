# SmartBrief — QA Release Checklist

*Last updated: 2026-05-28*

Run this checklist before merging any sprint to `main`. Check every item that applies to the release. Items marked **[CORE]** must pass on every release, no exceptions.

---

## 1. Environment

- [ ] **[CORE]** App starts cleanly from `docker compose up -d` on a fresh clone
- [ ] **[CORE]** No errors or warnings in Docker logs at startup
- [ ] **[CORE]** Prisma migrations run without errors on first boot
- [ ] Environment variables documented in `docker-compose.yml` or `.env.example` are current
- [ ] SQLite database file is created at the expected path on first run

---

## 2. Authentication

- [ ] **[CORE]** Login page loads and accepts the correct password
- [ ] **[CORE]** Wrong password is rejected (no crash, clear error message)
- [ ] **[CORE]** Session persists across page refreshes (30-day cookie)
- [ ] **[CORE]** Accessing any route without a valid session redirects to login
- [ ] Logout clears the session cookie and redirects to login

---

## 3. Core Briefing Flow

- [ ] **[CORE]** Feed loads and displays articles on first visit
- [ ] **[CORE]** "Briefing complete ✓" screen appears when all articles are read
- [ ] **[CORE]** Progress bar advances correctly as articles are read
- [ ] **[CORE]** Tapping an article opens the detail sheet with AI bullet points
- [ ] **[CORE]** "Read at [source]" links are present and point to correct URLs
- [ ] Topic tabs (All / Tech & AI / Science & Health / Business / World / Bright Spots) all load without error
- [ ] Manual refresh button triggers a feed reload
- [ ] Auto-refresh fires at the configured interval (spot-check with a short interval)

---

## 4. Story Clusters

- [ ] **[CORE]** TopStory cluster cards appear at the top of the feed
- [ ] **[CORE]** Cluster card shows source count, bullet-point summary, and sentiment
- [ ] Tune-feed and save buttons on cluster cards function correctly
- [ ] Articles included in a cluster are excluded from the individual article list

---

## 5. Article Feedback

- [ ] **[CORE]** All five feedback actions are accessible: More like this / Less like this / Too negative / Off-topic / Hide source
- [ ] **[CORE]** Feedback selection produces immediate visual confirmation
- [ ] Undo toast appears within 5 seconds and functions correctly
- [ ] "Hide source" collapses all cards from that source in the current session
- [ ] Feedback is persisted — reloading the page does not reset feedback state
- [ ] Events are written to the `feedback_signals` table (confirm via SQLite)

---

## 6. Source Management

- [ ] **[CORE]** Source settings screen loads and shows all sources grouped by language + category
- [ ] **[CORE]** Toggling a source off removes its articles from the next feed refresh
- [ ] Toggle state persists after page reload
- [ ] "Enable all / Disable all" per group works correctly

---

## 7. Mood Presets & Sentiment Balance

- [ ] **[CORE]** All three presets load correctly: Balanced / Constructive / Hard News
- [ ] Switching presets updates the feed composition on next refresh
- [ ] Sentiment scores are present on articles (confirm at least one article has a non-null score)

---

## 8. Save & Read Later

- [ ] **[CORE]** Bookmarking an article adds it to the Saved tab
- [ ] Saved articles persist across sessions
- [ ] Removing a saved article removes it from the Saved tab

---

## 9. Weekly Recap

- [ ] **[CORE]** Recap screen loads and shows topic mix, sentiment, bias, feedback summary
- [ ] "This Week" card appears on briefing complete screen
- [ ] On Sunday/Monday, "This Week" card is promoted to top of complete screen
- [ ] Empty state displays correctly with <3 days of `readAt` data
- [ ] `recap_viewed` event is logged when the screen is opened

---

## 10. Feedback Learning

- [ ] "Why am I seeing this?" reason chip visible on article cards in skim mode
- [ ] Learned Preferences settings screen shows boosted/suppressed topics and sources
- [ ] "Reset all" clears feedback signals (confirm via SQLite)
- [ ] Learning strength slider (Low/Medium/High) affects feed ranking
- [ ] "Learn from my feedback" toggle works — off reverts to pre-learning behaviour

---

## 11. Push Notifications

- [ ] No push permission prompt fires without explicit user action in Settings
- [ ] Push subscription stored in `push_subscriptions` table after opt-in
- [ ] Test notification can be sent via Settings → Notifications → Test
- [ ] Daily cap is enforced (cannot receive more than configured max per day)
- [ ] Quiet hours are respected
- [ ] Notification history log shows last 30 entries

---

## 12. Newsletter Ingestion

- [ ] Webhook setup UI shows correct URL and secret in Settings → Sources → Newsletters
- [ ] Per-service setup guides (n8n, Zapier, Make, Mailgun) are accessible
- [ ] Newsletter sources appear in Settings → Sources after first ingestion
- [ ] Ingested articles appear in the feed on next refresh
- [ ] Duplicate newsletter submissions do not create duplicate articles

---

## 13. Performance

- [ ] **[CORE]** Lighthouse FCP < 1.5s (Mobile, simulated 4G)
- [ ] **[CORE]** No Lighthouse score regression vs. last baseline (LCP, CLS, TBT)
- [ ] `/api/news` response time < 300ms for a cached feed (DevTools Network tab)
- [ ] No layout shift (CLS) during article card load

---

## 14. Browser & Device Matrix

Test the primary user journey (open app → read briefing → mark complete) on each:

| Browser / Device | Must pass |
|-----------------|-----------|
| Chrome (desktop, latest) | **[CORE]** |
| Safari (iPhone, latest iOS) | **[CORE]** |
| Safari (iPad, latest iPadOS) | **[CORE]** |
| Firefox (desktop, latest) | Recommended |
| Chrome (Android) | Recommended |

---

## 15. PWA

- [ ] **[CORE]** App installs to iPhone home screen and launches in standalone mode
- [ ] App icon and splash screen display correctly on iPhone
- [ ] App installs to iPad home screen and displays correctly in landscape and portrait

---

## 16. Dark Mode

- [ ] **[CORE]** Dark mode activates when the device OS is set to dark
- [ ] All text is legible in dark mode
- [ ] All UI elements (buttons, cards, tabs, modals) render correctly in dark mode
- [ ] Sentiment/bias labels and progress bar are visible in dark mode

---

## 17. Responsive Layout

- [ ] Feed cards display correctly at iPhone SE width (375px)
- [ ] Feed cards display correctly at iPad width (768px)
- [ ] Article detail sheet does not overflow at any tested width
- [ ] Source settings UI is usable on iPhone without horizontal scroll

---

## 18. Sign-Off

| Area | Tester | Date | Pass/Fail |
|------|--------|------|-----------|
| Core briefing flow | | | |
| Story clusters | | | |
| Feedback | | | |
| Source management | | | |
| Weekly Recap | | | |
| Push notifications | | | |
| Performance (Lighthouse) | | | |
| Safari iPhone | | | |
| Dark mode | | | |

**Release approved by:** _______________  **Date:** _______________
