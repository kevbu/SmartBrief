# SmartBrief — Metrics & Measurement Plan

*Last updated: 2026-05-28*

---

## Constraint

SmartBrief has **zero external analytics**. No telemetry, no tracking pixels, no third-party services. All measurement is derived from the local SQLite database. Every metric is defined as a concrete SQL query or manual test.

---

## Active Metrics

### 1. Feedback interaction rate

**Definition:** % of read articles where the user submitted at least one feedback action.

```sql
SELECT
  CAST(COUNT(DISTINCT af.articleId) AS FLOAT) /
  CAST(COUNT(DISTINCT a.id) AS FLOAT) * 100 AS interaction_rate_pct
FROM Article a
LEFT JOIN ArticleFeedback af ON a.id = af.articleId
WHERE a.readAt >= datetime('now', '-7 days');
```

**Target:** ≥15%
**Review cadence:** Weekly.

---

### 2. Weekly Recap usage rate

**Definition:** % of weeks where the user opened the recap screen at least once.

```sql
SELECT
  COUNT(DISTINCT strftime('%Y-%W', created_at)) AS weeks_with_recap_view,
  CAST(
    (julianday('now') - julianday((SELECT MIN(created_at) FROM AppEvent WHERE action = 'recap_viewed'))) / 7
  AS INTEGER) AS total_weeks_since_launch,
  ROUND(
    COUNT(DISTINCT strftime('%Y-%W', created_at)) * 100.0 /
    CAST(
      (julianday('now') - julianday((SELECT MIN(created_at) FROM AppEvent WHERE action = 'recap_viewed'))) / 7
    AS INTEGER), 1
  ) AS usage_rate_pct
FROM AppEvent
WHERE action = 'recap_viewed';
```

**Target:** ≥50% of weeks
**Review cadence:** Monthly.

---

### 3. Feed satisfaction ratio

**Definition:** Ratio of "more-like-this" to "less-like-this" signals over rolling 14 days.

```sql
SELECT
  SUM(CASE WHEN action = 'more-like-this' THEN 1 ELSE 0 END) AS more_count,
  SUM(CASE WHEN action = 'less-like-this' THEN 1 ELSE 0 END) AS less_count,
  ROUND(
    CAST(SUM(CASE WHEN action = 'more-like-this' THEN 1 ELSE 0 END) AS FLOAT) /
    NULLIF(SUM(CASE WHEN action = 'less-like-this' THEN 1 ELSE 0 END), 0),
  2) AS satisfaction_ratio
FROM FeedbackSignal
WHERE createdAt >= datetime('now', '-14 days')
  AND action IN ('more-like-this', 'less-like-this');
```

**Target:** Ratio improves ≥20% vs pre-learning baseline after 4 weeks.
**Review cadence:** Bi-weekly.

---

### 4. Push notification open rate

**Definition:** % of sent notifications where the user tapped to open.

```sql
SELECT
  COUNT(*) AS total_sent,
  SUM(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END) AS total_opened,
  ROUND(SUM(CASE WHEN openedAt IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS open_rate_pct
FROM NotificationLog
WHERE sentAt >= datetime('now', '-30 days');
```

**Target:** ≥40%
**Review cadence:** Monthly.

---

### 5. Newsletter ingestion activity

**Definition:** Number of newsletter articles ingested in the past 7 days.

```sql
SELECT COUNT(*) AS newsletters_this_week
FROM Article
WHERE source LIKE '%newsletter%'
  AND fetchedAt >= datetime('now', '-7 days');
```

**Target:** ≥1 per active week
**Review cadence:** Weekly spot check.

---

## Performance Metrics

Run via `npm run perf` (Lighthouse CLI, mobile 4G):

| Metric | Target | How to measure |
|--------|--------|---------------|
| FCP | < 1.5s | `npm run perf` |
| LCP | < 2.5s | `npm run perf` |
| CLS | < 0.1 | `npm run perf` |
| TBT | < 200ms | `npm run perf` |
| `/api/news` response | < 300ms | Browser DevTools Network |

See `docs/performance-audit-q2-2026.md` for the baseline run results.

---

## Admin Endpoint (Unscheduled)

A `/admin/metrics` page (password-protected, same auth as main app) would surface these queries as a plain table — approximately 1 day of work. Currently unscheduled.

---

## Metrics Not Tracked

| Metric | Why not tracked |
|--------|----------------|
| Daily active users | Single-user app — not meaningful |
| Session length / time in app | Deliberately not tracked; maximising time is against product principles |
| Story click-through rate | Would require tracking external URLs opened — out of scope for privacy model |
