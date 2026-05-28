# PRD — Push Notifications

*Status: **Shipped** (v1.3, 2026) | Owner: PM Agent | Last updated: 2026-05-28*

---

## Status

Fully shipped. All components listed below are in production.

| Component | Status | Location |
|-----------|--------|----------|
| Subscription management (subscribe/unsubscribe) | ✅ Shipped | `POST/DELETE /api/push/subscribe` |
| VAPID key auto-generation + storage | ✅ Shipped | `src/lib/push-vapid.ts`, stored in `AppState` |
| Breaking news detector | ✅ Shipped | `src/lib/breaking-news-detector.ts` |
| Push dispatcher with quiet hours | ✅ Shipped | `src/lib/push-dispatcher.ts` |
| Detection endpoint | ✅ Shipped | `GET /api/push/detect` |
| Daily cap enforcement | ✅ Shipped | `UserPreferences.pushDailyCap` |
| Notification history log | ✅ Shipped | `NotificationLog` model + Settings → Notifications → History |
| Opt-in flow + explanation screen | ✅ Shipped | Settings → Notifications |
| Settings UI (quiet hours, daily cap, toggle) | ✅ Shipped | Settings → Notifications |
| VAPID subject bug fix | ✅ Fixed | Uses `NEXT_PUBLIC_APP_URL` |

---

## How Detection Works

The detector uses a three-gate qualification system:

1. **Urgency gate** — article published within the last 2 hours
2. **Coverage gate** — ≥3 distinct sources cover articles clustering together within a 30-minute window
3. **Severity gate** — `Article.severity = 'critical'` (set by Claude Haiku during scoring)

**Clustering** uses Jaccard similarity on title tokens (≥0.2 threshold, stop-words removed).

**Dispatch schedule** — piggybacked on news refreshes (every 5 minutes when app is open). An `isDetectDue()` guard prevents over-execution.

**Quiet hours** — enforced server-side in the dispatcher. Default: 22:00–07:00.

**Daily cap** — default 2 per day, range 1–3. Configurable in Settings.

---

## Out of Scope (deferred to v2)

- Topic filter per notification
- End-of-day digest notification
- User-configurable significance threshold (decided: no — daily cap is sufficient)
