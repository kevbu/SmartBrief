# Implementation: Scheduled Refresh

> Spec: [01-spec.md](01-spec.md)
> Date: 2026-11-17
> Mode: normal
> Status: DONE_WITH_CONCERNS

## Summary

Server-side scheduled refresh is back as an explicit opt-in with three modes (Manual default, Interval, Daily with catch-up after sleep). A one-minute tick reads the preferences on every run and asks a pure `isRefreshDue()`. `refreshNews()` is now single-flight, the IMAP / breaking-news piggyback is shared between route and scheduler, and Settings has a new mode radiogroup. The concern is only scope ownership: the `.feature` file and the e2e spec from Step 8 are left to qa-engineer (see Deviations).

## Steps Completed

### Step 1 — Schema and types

**Files modified:**

- `prisma/schema.prisma` — `refreshMode String @default("manual")`, `refreshDailyTime String @default("07:00")` on `UserPreferences`.
- `src/types/index.ts` — `RefreshMode` type; both fields on `UserPreferences`.

`prisma db push` ran against the throwaway `prisma/dev.db` (`DATABASE_URL=file:./dev.db`), never the live DB. Existing rows read `manual`.

### Step 2 — Pure scheduling logic

**Files created:**

- `src/lib/refresh-schedule.ts` — `parseRefreshMode`, `isRefreshMode`, `parseDailyTime`, `mostRecentDailySlot`, `isRefreshDue`, `isBackoffActive`, `isSchedulerEnabled`, `validateRefreshPrefsInput`; constants `MIN_INTERVAL_MINS = 15`, `FAILURE_BACKOFF_MS = 15 min`, `DEFAULT_DAILY_TIME`, `REFRESH_MODES`.
- `src/lib/refresh-schedule.test.ts` — 50 tests.

### Step 3 — Single-flight refresh and shared piggyback

**Files modified:**

- `src/lib/news-aggregator.ts` — old body renamed to private `runRefresh()`. Exported `refreshNews()` returns the in-flight promise from `globalThis.__smartbriefRefreshInFlight` if one exists, else starts a run and clears the slot in `.finally`. The three default-pref creates use `refreshIntervalMins: 360`.
- `src/app/api/news/refresh/route.ts` — calls `refreshNews()` then `await runPostRefreshTasks()`. Response shape unchanged.

### Step 4 — Preferences API and feed API

**Files modified:**

- `src/app/api/preferences/route.ts` — `dbToPreferences()` returns both fields (`parseRefreshMode`, fallback `07:00`). `PUT` runs `validateRefreshPrefsInput()` first and returns 400 with `Invalid refreshMode`, `refreshDailyTime must be HH:MM` or `refreshIntervalMins must be an integer of at least 15`. Create defaults: interval 360, mode `manual`, time `07:00`.
- `src/app/api/news/route.ts` — `preferences` object carries both fields; interval fallback 360.

### Step 5 — Scheduler

**Files modified:**

- `src/lib/scheduler.ts` — `runPostRefreshTasks()` (IMAP + breaking-news, each behind its due-check, fire-and-forget, never throws), exported `tick(now?)`, `startBackgroundRefresh()` (kill switch, `globalThis.__smartbriefSchedulerStarted` guard, `setTimeout(tick, 5s)` + `setInterval(tick, 60s)`, both `.unref()`), test-only `__resetSchedulerForTests()`.

`src/instrumentation.ts` unchanged; it already calls `startBackgroundRefresh()` once in the Node runtime.

**Files created:**

- `src/lib/scheduler.test.ts` — 9 tests, DB / aggregator / IMAP / push mocked.

### Step 6 — Settings UI

**Files modified:**

- `src/app/settings/page.tsx` — `REFRESH_OPTIONS` gets `6 hours` (360). New `REFRESH_MODE_OPTIONS`, state `refreshMode` / `refreshDailyTime`, loaded from prefs and sent in the save payload. Section per UX doc: subtitle, `role="radiogroup" aria-label="Refresh mode"` with three `role="radio"` buttons (`aria-checked`), mode description, interval grid only in Interval mode with `aria-pressed`, Daily sub-panel `bg-well/60` with `<label htmlFor="refresh-daily-time">Every day at</label>` and `<input type="time">`, hint "Each refresh uses Claude." for Interval and Daily. Initial `refreshInterval` state 360 (was 60) to match the schema default.

### Step 7 — Backup round-trip check

No change. `backup-db.ts` copies whole preference rows and filters with `coerceRow` against the runtime Prisma schema (`fieldSpec('UserPreferences')`); `PREFERENCE_FIELDS_NOT_IMPORTED` is only `id`, `pushEnabled`, `updatedAt`. `backup.test.ts` has no preference fixture with a field list. Both new string fields therefore export and import unchanged. An invalid `refreshDailyTime` arriving via import is treated as "never due" by the scheduler.

### Step 8 — E2E config, docs

**Files modified:**

- `playwright.config.ts` — `SMARTBRIEF_SCHEDULER: 'off'` in `webServer.env`.
- `README.md` — "There is no background schedule." replaced with modes, computer-on rule, catch-up, local time / `TZ`, cost, kill switch.
- `CLAUDE.md` — new "Scheduled refresh" paragraph under Architecture.

Not created here: `features/settings-auto-refresh.feature`, `e2e/settings-auto-refresh.spec.ts` (see Deviations).

## Tests Added

- `src/lib/refresh-schedule.test.ts` — mode / time parsing, daily slot, interval + clamp, daily incl. catch-up, manual refresh before/after slot, 00:00 slot, invalid times, backoff boundaries, kill-switch values, PUT validation (AC3 cases).
- `src/lib/scheduler.test.ts` — kill switch registers no timer; double start registers one interval; due tick → refresh + piggyback; piggyback due-checks respected; not due / manual / no prefs row → no refresh; mode change picked up at next tick (AC13); failure backoff 15 min; tick never throws on DB error.
- `src/lib/news-aggregator.integration.test.ts` — new "single-flight" case: two concurrent calls share one promise, `fetchAllFeeds` called once, same result; next call after settle starts a fresh run.

## Deviations from Spec

### E2E journey files (Step 8)

- **Spec said:** create `features/settings-auto-refresh.feature` and `e2e/settings-auto-refresh.spec.ts`.
- **Found:** the implementation skill assigns `.feature` files and the e2e tree to qa-engineer exclusively.
- **Did instead:** left both to qa-engineer. Scenarios HP-1 to HP-4 are listed in the spec's Gherkin Impact. Only the `SMARTBRIEF_SCHEDULER: 'off'` env line was added to `playwright.config.ts`, because it is a safety guard for the e2e server, not a scenario.

### PUT validation as a pure helper

- **Spec said:** validate `refreshMode`, `refreshDailyTime`, `refreshIntervalMins` in `PUT /api/preferences`.
- **Did instead:** the checks live in `validateRefreshPrefsInput()` in `refresh-schedule.ts`, and the route calls it. Same messages and 400 status. This makes AC3 unit-testable without a route harness.

### Refresh route awaits the due-checks

- **Spec said:** the route calls `runPostRefreshTasks()` fire-and-forget.
- **Did instead:** `await runPostRefreshTasks()`. The helper only awaits `isImapPollDue()` / `isDetectDue()` (same as the old route) and starts the poll / detection without awaiting them. Behaviour is identical to before; it never throws.

### Exported `tick()` and test reset hook

- Not named in the spec. `tick(now?)` is exported and `__resetSchedulerForTests()` added so AC10 / AC11 can be unit-tested with an injected clock.

## Check Results

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx tsc --noEmit` | Pass |
| Tests | `npm test` | Pass (7 files, 160 tests) |
| Build | `npm run build` | Pass |
| E2E | `npm run e2e` | Not run (qa-engineer step) |

## Acceptance Criteria

- [x] AC1: schema fields with defaults; `db push` on a throwaway DB reads `manual` for existing rows.
- [x] AC2: `GET /api/preferences` (`dbToPreferences`) and `GET /api/news` return both fields (code inspection; tsc enforces the `UserPreferences` shape).
- [x] AC3: 400 for `hourly`, `7:00`, `25:00`, interval 5 (unit tests on `validateRefreshPrefsInput`, used by the route).
- [x] AC4: backup round-trip via generic row copy + `coerceRow` (Step 7 check-result).
- [x] AC5–AC8: `refresh-schedule.test.ts`.
- [x] AC9: single-flight integration test.
- [x] AC10: `scheduler.test.ts` (kill switch, double start).
- [x] AC11: `scheduler.test.ts` (refresh → piggyback, 15-minute backoff).
- [x] AC12: route keeps response shape; piggyback via the shared helper with the same due-checks.
- [x] AC13: `tick()` reads prefs and `AppState` on every run (code inspection + "picks up a changed mode" test).
- [ ] AC14–AC17: UI implemented per UX doc; e2e verification pending in the QA step.
- [ ] AC18: tsc, test, build pass; `npm run e2e` is for the QA step.
- [x] AC19: README and CLAUDE.md updated.

## Discovered Issues

- `node-cron` stays in `package.json` though nothing imports it (out of scope per spec).
- Clearing the time input in Daily mode sends `''`, which the API rejects with 400; the page then shows the generic "Failed to save" state. Acceptable, but a field-level message would be nicer.
- `UserPreferences.refreshIntervalMins` was previously never read; rows created by older code may hold 60. That value is valid and shows "1 hour" as active.

## Fix Round 1

> Review: [04-review.md](04-review.md) (verdict PASS, optional MINOR follow-ups)
> Date: 2026-11-17
> Trigger: user request "Fix 1–3, then ship". Scope is review recommendations 1–3. Items 4–6 stay out of scope.

### Issues Addressed

1. **Piggyback can run twice when a tick joins an in-flight manual refresh** — `src/lib/scheduler.ts`: `runPostRefreshTasks()` now runs each task through `runPostRefreshTask()`. It claims a per-task slot (`imap`, `detect`) synchronously before the due-check, kept on `globalThis` (`__smartbriefPostRefreshInFlight`) like the other single-flight guards. A second caller skips a task whose slot is taken. The slot is released when the task settles, or at once when the task is not due or the due-check throws. The caller still awaits only the due-checks; the poll and detection stay fire-and-forget, so the `POST /api/news/refresh` response timing is unchanged. `__resetSchedulerForTests()` also clears the slots.
2. **Clearing the Daily time blocks the whole Settings save** — `src/app/settings/page.tsx`: the time input is `required`, and `onChange` keeps the last valid value via the new pure helper `nextDailyTimeInput(input, previous)` in `src/lib/refresh-schedule.ts`. The page can no longer send `''` or a partial value.
3. **A legacy `refreshIntervalMins` below 15 blocks every Settings save** — `src/app/settings/page.tsx`: on load, the page state is set to `clampIntervalMins(prefs.refreshIntervalMins, 360)` (new pure helper in `src/lib/refresh-schedule.ts`). It raises values below `MIN_INTERVAL_MINS` to 15, rounds non-integers (the API requires an integer) and falls back to 360 for non-numeric values.

### Decisions

- Single-flight covers the task run, not only `runPostRefreshTasks()` as a whole. Reason: the due-checks resolve quickly while `pollImap()` writes `lastImapPoll` only at its end. A guard around the due-check phase alone would let a slightly later second caller start the poll again.
- The two tasks still run their due-checks in sequence (IMAP, then detect), as before.
- The clamp happens on load in the page, not in the API. The API validation (`validateRefreshPrefsInput`) is unchanged.

### Tests Added

- `src/lib/scheduler.test.ts` — `runPostRefreshTasks`: two concurrent callers start each task once; a third caller during a running poll skips it; the slot frees after the task settles; a tick that joins a manual run does not repeat the piggyback; the slot frees when not due, when the due-check throws and when the task rejects.
- `src/lib/refresh-schedule.test.ts` — `nextDailyTimeInput` (valid, cleared, partial, out of range) and `clampIntervalMins` (pass-through, below minimum, non-integer, non-numeric fallback).

### Files Modified

- `src/lib/scheduler.ts`
- `src/lib/scheduler.test.ts`
- `src/lib/refresh-schedule.ts`
- `src/lib/refresh-schedule.test.ts`
- `src/app/settings/page.tsx`

### Updated Check Results

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npx tsc --noEmit` | Pass (exit 0) |
| Tests | `npm test` | Pass (7 files, 170 tests) |
| Build | `npm run build` | Pass (exit 0). Run with `DATABASE_URL=file:./dev.db` (worktree DB), `ANTHROPIC_API_KEY=''`, `SMARTBRIEF_SCHEDULER=off` |

E2E was not run (qa-engineer scope). No e2e file was touched. `e2e/settings-auto-refresh.spec.ts` HP-4 fills a valid `07:30`, which `nextDailyTimeInput` accepts, so no breakage is expected. The live DB and the launchd service on :3000 were not touched. Nothing committed.

### Remaining (out of scope for this round)

Review items 4 (radiogroup keyboard pattern), 5 (warning for unparseable Daily time) and 6 (tick state on `globalThis`).
