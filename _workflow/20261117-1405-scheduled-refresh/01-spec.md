# Feature: Scheduled Refresh

> Source: Manual request ("jeden Morgen automatisch eine aktualisierte Ansicht ... neben dem fixen Intervall auch einen Schedule, in meinem Fall every morning at 7am"), `00-feature-brief.md`, `00-ux-design.md`
> Date: 2026-11-17
> Depth: standard (about 10 files, follows existing patterns, no new subsystem)

## Context

The user wants a fresh briefing every morning without tapping refresh and waiting one to two minutes. Today `refreshIntervalMins` is stored and shown in Settings, but nothing reads it: `src/lib/scheduler.ts` is an empty stub since da29b06 removed the node-cron scheduler to stop background API costs. This feature brings back server-side refresh as an explicit opt-in, with two modes: a fixed interval and a daily time (default 07:00), with catch-up after sleep.

## Requirements

- New preference `refreshMode`: `manual` (default) | `interval` | `daily`.
- New preference `refreshDailyTime`: `HH:MM`, default `07:00`, server local time.
- Existing `refreshIntervalMins` is the interval for mode `interval`.
- A server-side tick runs once per minute. It reads the preferences and `AppState.lastRefreshed` on every tick and decides with a pure function whether a refresh is due.
- Interval mode: due when `lastRefreshed` is null or `now >= lastRefreshed + interval`.
- Daily mode: due when the most recent daily slot (today at `HH:MM` if already passed, else yesterday at `HH:MM`) is after `lastRefreshed`, or `lastRefreshed` is null. This gives catch-up: if the Mac sleeps at 07:00, the refresh runs on the first tick after wake. A manual refresh after the slot satisfies that day's slot.
- Manual mode: never due.
- Single-flight: scheduled and manual refresh share one in-flight promise. A second call while one runs gets the same result and never starts a second Claude run.
- A scheduled refresh also runs the IMAP poll and breaking-news detection, with the same `isImapPollDue()` / `isDetectDue()` gates as `POST /api/news/refresh`.
- Failure backoff: after a failed scheduled refresh, the tick does not retry for 15 minutes (in-memory). Otherwise a broken feed or API would trigger a Claude-billed retry every minute.
- The tick registers once per process (`globalThis` guard, survives dev hot reload).
- Env kill switch `SMARTBRIEF_SCHEDULER=off` disables the tick. Playwright sets it. Prevents the e2e server and a local `npm run dev` against the live DB from refreshing on their own.
- Settings "Auto-Refresh" section per `00-ux-design.md`: mode radiogroup (Manual / Interval / Daily), interval grid only in Interval mode, labelled time input only in Daily mode, mode-dependent description, cost hint. Saved through the existing "Save Preferences" button.
- New fields round-trip through `GET/PUT /api/preferences`, `GET /api/news` preferences and backup export/import.
- Changes take effect at the next tick without a restart.

**Out of scope:**

- Waking the Mac from sleep (`pmset`). README note only.
- Several daily times, weekday rules.
- Client-side auto-refresh, "briefing ready" push.
- Showing the next scheduled run in the UI.
- Persisting failure backoff across restarts.

## Decisions

1. **"6 hours" option added** to `REFRESH_OPTIONS` (value 360). It is the DB default and the old scheduler value, so existing rows show an active option. No data migration.
2. **Time input accepts any minute** (no `step`). Simpler; the tick resolution is one minute anyway.
3. **Mode stored as a string column** (`refreshMode String @default("manual")`), same as `moodPreset` / `depthMode`. Invalid values are treated as `manual` by the parser (fail closed = no cost).
4. **Invalid `refreshDailyTime`** (not `HH:MM`, hour > 23, minute > 59) is rejected by `PUT /api/preferences` with 400, and treated as "never due" by the scheduler if it reaches the DB another way (backup import).
5. **Interval clamp:** the scheduler treats `refreshIntervalMins < 15` as 15. Guards against a bad value causing near-continuous Claude calls.
6. **Kill switch over e2e-only logic:** `SMARTBRIEF_SCHEDULER=off` is generic and also protects a dev server that shares the live DB. The default (unset) is "on".
7. **Single-flight lives in `news-aggregator.ts`**: the current `refreshNews()` body is renamed to a private `runRefresh()`; exported `refreshNews()` wraps it with a module-level promise. Every caller (route, scheduler) gets the guard for free.
8. **Shared post-refresh piggyback**: the IMAP and breaking-news calls move from the route into an exported helper so route and scheduler do not duplicate them.
9. **Time zone** = server local time (`Date#setHours`). DST is handled by the local-time constructor. Docker users set `TZ`. Documented in README.
10. **Gherkin:** the repo has no `features/` tree. E2E lives in plain Playwright specs under `e2e/`. Per the venue model, this spec authorizes a new journey file `features/settings-auto-refresh.feature` and its implementation `e2e/settings-auto-refresh.spec.ts` (sibling pattern: `e2e/appearance.spec.ts`). No BDD runner is introduced; the `.feature` is the journey contract.

## Current State

- `src/instrumentation.ts`: calls `startBackgroundRefresh()` from `src/lib/scheduler.ts` once in the Node runtime.
- `src/lib/scheduler.ts`: empty stub. Git history b89a74f shows the removed node-cron version (no catch-up, fixed 6h).
- `src/lib/news-aggregator.ts`: `refreshNews()` (line 19) runs fetch, insert, Haiku sentiment, Sonnet clusters, prune, sets `AppState.lastRefreshed`. No concurrency guard. Also upserts default prefs with `refreshIntervalMins: 60` in two places (lines ~146, ~262) and in `ensureDefaultPreferences()`.
- `src/app/api/news/refresh/route.ts`: calls `refreshNews()`, then fire-and-forget `pollImap()` / `detectAndPush()` behind `isImapPollDue()` / `isDetectDue()`.
- `prisma/schema.prisma`: `UserPreferences.refreshIntervalMins Int @default(360)`, `quietHoursStart String @default("22:00")` (pattern for `HH:MM` strings). `AppState.lastRefreshed DateTime?`.
- `src/types/index.ts`: `UserPreferences` interface (line 46).
- `src/app/api/preferences/route.ts`: `dbToPreferences()`, `GET` upsert-create, `PUT` field-by-field `updateData`.
- `src/app/api/news/route.ts` (~line 37): builds a `UserPreferences` object from the DB row with fallbacks.
- `src/app/settings/page.tsx`: `REFRESH_OPTIONS` (line 630), state `refreshInterval` (line 696), load (line 796), save payload (line 974), Auto-Refresh section (line ~1670). Quiet-hours `<input type="time">` at line ~1636.
- `src/lib/backup-db.ts`: copies whole preference rows and filters via `coerceRow` against the runtime schema, so new columns round-trip without code changes (verify only).
- `src/lib/push-dispatcher.ts` `isQuietHours()`: existing `HH:MM` parsing pattern (local time, minutes since midnight).
- `src/lib/retention.ts` + `retention.test.ts`: structural template for pure logic + Vitest test with fixed `NOW`.
- `playwright.config.ts`: e2e web server env block (`DATABASE_URL`, `SMARTBRIEF_PASSWORD`, `ANTHROPIC_API_KEY`).
- `README.md` line 56: "There is no background schedule."

## Implementation Steps

### Step 1 — Schema and types

**Files:** `prisma/schema.prisma` (modify), `src/types/index.ts` (modify)

- Add to `UserPreferences`: `refreshMode String @default("manual")` and `refreshDailyTime String @default("07:00")`, next to `refreshIntervalMins`.
- In `src/types/index.ts` add `export type RefreshMode = 'manual' | 'interval' | 'daily'` and the two fields on the `UserPreferences` interface.
- Run `npm run db:push` locally. Existing rows get `manual`, so nothing changes for the running install until the user opts in.

### Step 2 — Pure scheduling logic

**Files:** `src/lib/refresh-schedule.ts` (create), `src/lib/refresh-schedule.test.ts` (create)

Pure functions, no Prisma import (same split as `retention.ts`):

- `parseRefreshMode(raw: unknown): RefreshMode` — unknown values → `manual`.
- `parseDailyTime(raw: unknown): { hours: number; minutes: number } | null` — strict `^\d{2}:\d{2}$`, hours 0–23, minutes 0–59.
- `mostRecentDailySlot(now: Date, time: {hours, minutes}): Date` — today at that local time if `<= now`, else the same time yesterday. Uses local-time setters.
- `isRefreshDue(input: { mode, intervalMins, dailyTime, lastRefreshed: Date | null, now: Date }): boolean` — rules from Requirements; interval clamped to a minimum of 15 (export `MIN_INTERVAL_MINS = 15`); invalid daily time → false.
- `isBackoffActive(lastFailureAt: Date | null, now: Date): boolean` — true within `FAILURE_BACKOFF_MS = 15 min`.
- `isSchedulerEnabled(env: string | undefined): boolean` — false for `off`, `false`, `0` (case-insensitive, trimmed).

Tests (fixed `NOW`, built with the local-time `Date` constructor so they pass in any TZ):

- manual is never due, also with `lastRefreshed = null`.
- interval: null → due; `lastRefreshed` 59 min ago with 60 → not due; 60 min ago → due; interval 5 → treated as 15.
- daily 07:00: now 06:59, last refresh yesterday 07:01 → not due; now 07:00, last refresh yesterday 07:01 → due; now 07:30, last refresh 07:05 today → not due; now 14:00 after sleep, last refresh yesterday → due (catch-up); manual refresh at 06:50 today, now 07:00 → due; null → due.
- daily slot just after midnight: time `00:00`, now 00:00 → slot is now.
- invalid daily times (`7:00`, `24:00`, `07:60`, `''`, `undefined`) → `parseDailyTime` null, `isRefreshDue` false.
- `parseRefreshMode('bogus')` → `manual`.
- backoff boundaries; `isSchedulerEnabled` for `undefined`, `'on'`, `'off'`, `' OFF '`, `'0'`, `'false'`.

### Step 3 — Single-flight refresh and shared piggyback

**Files:** `src/lib/news-aggregator.ts` (modify), `src/app/api/news/refresh/route.ts` (modify)

- In `news-aggregator.ts`: rename the current body of `refreshNews()` to an internal `runRefresh()`. Exported `refreshNews()` keeps its signature: if a module-level `inFlight` promise exists, return it; else assign `runRefresh().finally(() => { inFlight = null })` and return it. Store the promise on `globalThis` (same reason as the tick guard: dev hot reload can load the module twice).
- Change the default `refreshIntervalMins: 60` in the three create-upserts in this file to `360`, so code defaults match the schema default and the new "6 hours" option. Same for `GET`/`PUT` creates in Step 4.
- The shared piggyback helper `runPostRefreshTasks()` lives in `src/lib/scheduler.ts` (Step 5), not in `news-aggregator.ts`, to keep the aggregator free of IMAP and push imports. The route imports it from there.
- The route calls `refreshNews()` then `runPostRefreshTasks()` (fire-and-forget, errors logged, same messages as today). Response shape unchanged.

### Step 4 — Preferences API and feed API

**Files:** `src/app/api/preferences/route.ts` (modify), `src/app/api/news/route.ts` (modify)

- `dbToPreferences()`: add both fields, `refreshMode` through `parseRefreshMode`, `refreshDailyTime` with fallback `'07:00'`.
- `PUT`: accept `refreshMode` only if it is one of the three values, else 400 `"Invalid refreshMode"`. Accept `refreshDailyTime` only if `parseDailyTime` succeeds, else 400 `"refreshDailyTime must be HH:MM"`. Accept `refreshIntervalMins` only as an integer ≥ 15, else 400.
- `GET`/`PUT` create blocks: `refreshIntervalMins` default 360; new fields fall back to schema defaults.
- `src/app/api/news/route.ts`: add both fields to the built `preferences` object (`refreshMode` via `parseRefreshMode(prefsDb?.refreshMode)`, `refreshDailyTime ?? '07:00'`), fallback interval 360.

### Step 5 — Scheduler

**Files:** `src/lib/scheduler.ts` (modify), `src/instrumentation.ts` (unchanged, verify)

- `runPostRefreshTasks()`: moved logic from the route (IMAP poll + breaking-news detect, each behind its due-check, fire-and-forget with `console.error`).
- `startBackgroundRefresh()`:
  - Return early with one log line if `!isSchedulerEnabled(process.env.SMARTBRIEF_SCHEDULER)`.
  - Return early if `globalThis.__smartbriefSchedulerStarted` is set; else set it.
  - `setInterval(tick, 60_000)` plus one `tick()` shortly after start (e.g. `setTimeout(tick, 5_000)`), so a restart after 07:00 catches up without waiting a minute. Call `.unref()` on the timers.
- `tick()`:
  - Skip if a tick is already running (in-memory flag) or backoff is active.
  - Read `UserPreferences` (id `default`) and `AppState.lastRefreshed`. Missing prefs row → do nothing.
  - If `isRefreshDue(...)`: log `[scheduler] refresh due (mode=..., last=...)`, `await refreshNews()`, then `runPostRefreshTasks()`. On error: log, set `lastFailureAt = now`.
  - All errors caught; the tick never throws.
- Keep `node-cron` out of this file. Do not remove the dependency (out of scope).

### Step 6 — Settings UI

**Files:** `src/app/settings/page.tsx` (modify)

- `REFRESH_OPTIONS`: add `{ value: 360, label: '6 hours' }`. The grid stays `grid-cols-2` as the UX doc requires. With five items, the last one sits alone in the third row.
- New state `refreshMode` (default `'manual'`) and `refreshDailyTime` (default `'07:00'`). Load from `prefs` next to line 796; add both to the save payload next to line 974.
- Section subtitle: "When SmartBrief fetches and analyses new articles".
- Mode group: `role="radiogroup" aria-label="Refresh mode"`, `grid grid-cols-3 gap-2`, three buttons `role="radio"` with `aria-checked`, same classes as the interval buttons.
- Description line (`text-xs text-ink-muted`) per `00-ux-design.md` copy. `{n}` = the active option label in lower case ("every 1 hour"); for an interval value not in the list, fall back to "{n} min".
- Interval mode: existing grid, add `aria-pressed` to each button.
- Daily mode: sub-panel `rounded-lg bg-well/60 p-3` with `<label htmlFor="refresh-daily-time">Every day at</label>` and `<input id="refresh-daily-time" type="time">` using the quiet-hours input classes.
- Interval and Daily: muted hint "Each refresh uses Claude."
- Only semantic tokens (`ink`, `ink-soft`, `ink-muted`, `well`, `well-strong`, `line`, `card`, `paper`). No emoji.

### Step 7 — Backup round-trip check

**Files:** `src/lib/backup.test.ts` (modify, only if a fixture lists preference fields explicitly)

- `backup-db.ts` copies whole rows and filters by runtime schema, so no code change is expected. If `backup.test.ts` has a preference fixture with a field list, add `refreshMode` / `refreshDailyTime` and assert `coerceRow` keeps them. If not, no change; the implementation report states this as a check-result.

### Step 8 — E2E config, journey, docs

**Files:** `playwright.config.ts` (modify), `features/settings-auto-refresh.feature` (create), `e2e/settings-auto-refresh.spec.ts` (create), `README.md` (modify), `CLAUDE.md` (modify)

- `playwright.config.ts`: add `SMARTBRIEF_SCHEDULER: 'off'` to `webServer.env`.
- `.feature` + `.spec.ts`: see Gherkin Impact.
- README line 56: replace "There is no background schedule." with a short paragraph: Auto-Refresh in Settings (Manual default, Interval, Daily), runs only while the computer is on, catches up after wake, uses server local time (`TZ` in Docker), each refresh costs Claude calls, `SMARTBRIEF_SCHEDULER=off` disables it.
- CLAUDE.md: add a "Scheduled refresh" paragraph under Architecture (tick, modes, catch-up, single-flight, kill switch, pure logic in `src/lib/refresh-schedule.ts`).

## Patterns to Follow

- **Pure logic + Vitest:** `src/lib/retention.ts` / `src/lib/retention.test.ts`. Same split: pure, exported constants, env parser with validity, fixed `NOW` in tests.
- **"Is due?" check against `AppState`:** `isImapPollDue()` in `src/lib/imap-poller.ts`, `isDetectDue()` in `src/lib/breaking-news-detector.ts`. The new check is the same idea, but pure (inputs passed in).
- **`HH:MM` local-time parsing:** `isQuietHours()` in `src/lib/push-dispatcher.ts`.
- **String enum preference:** `moodPreset` / `depthMode` in schema, types and `src/app/api/preferences/route.ts`.
- **Settings button group with ARIA:** Theme group in Settings (tested by `e2e/appearance.spec.ts` via `getByRole('group', { name: 'Theme' })` and `aria-pressed`).
- **E2E spec:** `e2e/appearance.spec.ts`.
- Differs from the old b89a74f scheduler: no node-cron, preference-driven, catch-up, single-flight, off by default.

## Acceptance Criteria

Data and API
- [ ] AC1: `UserPreferences` has `refreshMode` (default `manual`) and `refreshDailyTime` (default `07:00`); an existing DB row reads as `manual` after `db:push`.
- [ ] AC2: `GET /api/preferences` and `GET /api/news` return `refreshMode` and `refreshDailyTime`.
- [ ] AC3: `PUT /api/preferences` stores valid values and returns 400 for `refreshMode: 'hourly'`, `refreshDailyTime: '7:00'` / `'25:00'`, and `refreshIntervalMins: 5`.
- [ ] AC4: Backup export contains both fields; import restores them.

Scheduling logic (unit)
- [ ] AC5: `isRefreshDue` returns false in manual mode for any input.
- [ ] AC6: Interval mode is due exactly when `now - lastRefreshed >= max(interval, 15) min`, or `lastRefreshed` is null.
- [ ] AC7: Daily mode at 07:00 is due at 07:00 when the last refresh was before today's 07:00, is not due again later that day after a refresh at or after 07:00, and is due at 14:00 when the last refresh was the previous day (catch-up).
- [ ] AC8: An invalid daily time is never due; an unknown mode parses as manual.

Runtime
- [ ] AC9: Two concurrent `refreshNews()` calls run the pipeline once and resolve to the same result (unit test with mocked `runRefresh` dependencies, or integration test following `news-aggregator.integration.test.ts`).
- [ ] AC10: With `SMARTBRIEF_SCHEDULER=off` the scheduler registers no timer; calling `startBackgroundRefresh()` twice registers one timer.
- [ ] AC11: A due tick calls `refreshNews()` and then the IMAP / breaking-news piggyback; a failed tick suppresses further attempts for 15 minutes.
- [ ] AC12: `POST /api/news/refresh` behaves as before (same response shape, piggyback still runs).
- [ ] AC13: A changed mode or time takes effect at the next tick without a restart (tick reads prefs each time; verified by code inspection in the impl report).

Settings UI (e2e)
- [ ] AC14: Auto-Refresh shows a radiogroup "Refresh mode" with Manual / Interval / Daily; Manual is checked by default and shows "Only when you tap refresh."; no interval grid or time input is visible.
- [ ] AC15: Choosing Interval shows the five interval options (incl. "6 hours") with `aria-pressed` on the active one, and the description "Every … while your computer is on." plus "Each refresh uses Claude."
- [ ] AC16: Choosing Daily shows a time input labelled "Every day at" with value `07:00` and the description mentioning catch-up after wake.
- [ ] AC17: Daily mode with time 07:30, saved and reloaded, shows Daily checked and `07:30`.

Checks
- [ ] AC18: `npx tsc --noEmit`, `npm test`, `npm run build` and `npm run e2e` pass.
- [ ] AC19: README and CLAUDE.md describe modes, local-time rule, catch-up, cost and the kill switch.

## Gherkin Impact

**Affected `.feature` files:**

- `features/settings-auto-refresh.feature` — choosing and saving the auto-refresh mode in Settings _(NEW FILE — see "New file justification")_

**Extensions:**

- None. No `.feature` file exists in the repo yet.

**New file justification:**

- `features/settings-auto-refresh.feature` is correct because the repo has no `features/` tree at all and the Auto-Refresh settings journey is user-observable. Closest existing journey: `e2e/appearance.spec.ts` covers the theme choice in Settings, a different journey (visual theme, client-only, no server preference). Implementation: `e2e/settings-auto-refresh.spec.ts`, modelled on `e2e/appearance.spec.ts`. No BDD runner is added; the `.feature` is the journey contract and the spec implements its scenarios one-to-one by title.
- Initial scenarios:
  - `HP-1 - Manual is the default and shows no schedule controls` (AC14)
  - `HP-2 - Interval mode shows the interval options and the cost hint` (AC15) — Scenario Outline over `30 min | 1 hour | 2 hours | 4 hours | 6 hours`, asserting `aria-pressed` on the clicked option
  - `HP-3 - Daily mode shows a labelled time input prefilled with 07:00` (AC16)
  - `HP-4 - Daily time survives save and reload` (AC17)
- The e2e server runs with `SMARTBRIEF_SCHEDULER=off`, so saving Daily never triggers a real refresh.

**Routed away from Gherkin:**

- AC1, AC13, AC19 → impl check-result.
- AC2, AC3, AC4, AC9, AC10, AC11, AC12 → unit / integration tests (Vitest; API and runtime behaviour not visible in the UI without a real refresh).
- AC5–AC8 → unit tests in `src/lib/refresh-schedule.test.ts`.
- AC18 → impl check-result (commands).

**Prune candidates:**

- None.

## Workflow Config

| Key           | Value                 |
| ------------- | --------------------- |
| workflow-dir  | _workflow             |
| test-cmd      | npm test              |
| lint-cmd      | npx tsc --noEmit      |
| build-cmd     | npm run build         |
| e2e-cmd       | npm run e2e           |
| e2e-framework | playwright            |
| tdd           | (not set)             |
| branch-prefix | feature/              |
| base-branch   | main                  |
