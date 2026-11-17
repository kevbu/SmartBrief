# Review: Scheduled Refresh

> Spec: [01-spec.md](01-spec.md)
> Implementation: [02-implementation.md](02-implementation.md) (incl. Fix Round 1)
> QA: [03-qa-2.md](03-qa-2.md)
> Previous review: [04-review.md](04-review.md)
> Date: 2026-11-17
> Review #: 2
> Verdict: **PASS**

## Verdict Summary

Fix Round 1 resolves review items 1 to 3 in the code, not only in the report. I re-read `scheduler.ts`, `refresh-schedule.ts`, the Settings diff, the route diffs and the new tests, and re-ran tsc, unit tests, build and e2e. All four pass. All 19 acceptance criteria are still met. The fixes add two new MINOR issues (a hung piggyback task now blocks that task for the process lifetime; the time input snaps back on a partial edit). Review items 4 to 6 stay open by decision. No CRITICAL or MAJOR issues.

## Prior Issues Status

| # (04-review.md) | Issue | Status | Evidence |
|---|---|---|---|
| 1 | Piggyback runs twice when a tick joins a manual refresh | Resolved | `src/lib/scheduler.ts:48-83`: per-task slot claimed synchronously before the first `await` (`:55-56`), released on task settle (`:64-66`) or at once when not due / due-check throws (`:71`). Tests `scheduler.test.ts:136-185` cover concurrent callers, a third caller during a running poll, tick + manual, and slot release on not-due, throw and reject |
| 2 | Clearing the Daily time blocks the whole save | Resolved | `src/app/settings/page.tsx` time input is `required`, `onChange` goes through `nextDailyTimeInput(next, prev)` (`refresh-schedule.ts:42-44`). The page can no longer send `''`. Proven by e2e EC-1 (PUT 200, body `daily` / `08:15`) |
| 3 | Legacy `refreshIntervalMins < 15` blocks every save | Resolved | Load uses `clampIntervalMins(prefs.refreshIntervalMins, 360)` (`refresh-schedule.ts:50-53`, page load ~line 806). Raises to 15, rounds, falls back for non-numbers. Unit-tested; the e2e path cannot seed the state (API rejects it), which is a sound routing decision |
| 4 | Radiogroup has no roving tabindex / arrow keys | Open (out of fix scope) | Unchanged. Still MINOR |
| 5 | Invalid Daily time disables the schedule silently | Open (out of fix scope) | `scheduler.ts:97-104` still returns without a log line. Still MINOR |
| 6 | `tickRunning` / `lastFailureAt` module-scoped | Open (out of fix scope) | `scheduler.ts:26-27`. Now even more inconsistent: the start guard and the piggyback slots are on `globalThis`, the tick state is not. Still MINOR, no defect under `next start` |

## Acceptance Criteria Check

| # | Criterion | Spec Met? | QA Proven? | Notes |
|---|-----------|-----------|------------|-------|
| 1 | Columns with defaults `manual` / `07:00` | Yes | N/A (check-result) | `prisma/schema.prisma` unchanged since review 1 |
| 2 | GET preferences and GET news return both fields | Yes | Partly | `dbToPreferences()`, `src/app/api/news/route.ts`. HP-4 reload proves the preferences GET |
| 3 | PUT 400 for invalid values | Yes | Yes (unit) | `validateRefreshPrefsInput` runs first in PUT. Unchanged by the fix round |
| 4 | Backup round-trip | Yes | N/A (check-result) | Generic row copy + `coerceRow` |
| 5 | Manual never due | Yes | Yes (unit) | |
| 6 | Interval rule incl. clamp 15 | Yes | Yes (unit) | |
| 7 | Daily 07:00 incl. catch-up | Yes | Yes (unit) | |
| 8 | Invalid time never due, unknown mode = manual | Yes | Yes (unit) | |
| 9 | Single-flight `refreshNews()` | Yes | Yes (integration) | `news-aggregator.ts` wrapper unchanged by the fix round |
| 10 | Kill switch, one timer on double start | Yes | Yes (unit) | |
| 11 | Tick → refresh → piggyback, 15 min backoff | Yes | Yes (unit) | Piggyback now also single-flight per task |
| 12 | `POST /api/news/refresh` unchanged | Yes | Code inspection | Response shape unchanged. The route awaits only the due-checks; the tasks stay fire-and-forget |
| 13 | Pref change effective at next tick | Yes | Yes (unit) | `tick()` reads prefs and AppState every run |
| 14 | Manual default UI | Yes | Yes (e2e HP-1) | |
| 15 | Interval UI, 5 options, `aria-pressed`, copy | Yes | Yes (e2e HP-2 x5) | |
| 16 | Daily UI, labelled input 07:00, catch-up copy | Yes | Yes (e2e HP-3) | |
| 17 | Daily 07:30 survives save and reload | Yes | Yes (e2e HP-4) | |
| 18 | tsc, test, build, e2e pass | Yes | Yes | Re-run independently, see below |
| 19 | README and CLAUDE.md updated | Yes | N/A | Unchanged since review 1 |

## Issues

### CRITICAL

None.

### MAJOR

None.

### MINOR

**[MINOR] A hung piggyback task blocks that task for the rest of the process lifetime (new, from fix 1)**
- **File:** `src/lib/scheduler.ts:61-66`
- **What:** The slot is released only in `.finally` after `run` settles. `pollImap()` has `connectionTimeout` / `greetingTimeout` (`imap-poller.ts:69-70`), but no bound on the whole fetch. `detectAndPush()` has no timeout at all. If either never settles, every later `runPostRefreshTasks()` skips that task until the server restarts. Before the fix, a hang affected only one run. QA run 2 reported the same.
- **Why it matters:** Newsletter ingestion or breaking-news pushes stop silently. Nothing logs that the slot is stuck.
- **Suggested fix:** Store a claim timestamp instead of a boolean, and treat a slot older than a bound (for example 10 minutes) as stale: log a warning and reclaim it.

**[MINOR] Daily time input snaps back on a partial edit (new, from fix 2)**
- **File:** `src/app/settings/page.tsx` (time input `onChange`), `src/lib/refresh-schedule.ts:42-44`
- **What:** In Chromium, a `type="time"` input reports `''` while any segment is empty. `nextDailyTimeInput` then keeps the previous value, and React restores the controlled DOM value. Backspacing the hour segment to retype it therefore snaps straight back to the old time. EC-1 confirms the snap-back (`fill('')` → value stays `08:15`). Typing over a segment still works.
- **Why it matters:** Small editing friction. Save safety, the goal of the fix, is achieved.
- **Suggested fix:** Optional. Keep the raw input in local state and validate only on save (disable Save or show a field error while the time is incomplete).

**[MINOR] Radiogroup keyboard pattern (carried over, review 1 item 4)** — unchanged, see [04-review.md](04-review.md).

**[MINOR] No log line when Daily mode has an unparseable time (carried over, review 1 item 5)** — `src/lib/scheduler.ts:97-104`, unchanged.

**[MINOR] Tick state module-scoped while other guards are global (carried over, review 1 item 6)** — `src/lib/scheduler.ts:26-27`, unchanged.

## Spec Compliance

The fix round stayed inside its declared scope (review items 1 to 3). Five files changed, all listed in the Fix Round 1 report and confirmed in the diff. The two new pure helpers (`nextDailyTimeInput`, `clampIntervalMins`) follow the `retention.ts` pattern and sit next to the other refresh logic. The API validation was not loosened: the clamp happens only on Settings load, so `PUT` still returns 400 for invalid input as AC3 requires. The per-task granularity of the piggyback guard is justified in the report: a guard around the due-check phase alone would not cover a poll that writes `lastImapPoll` only at its end. No scope creep.

## Code Quality

`runPostRefreshTask()` is correct for its purpose. The check and the claim happen synchronously before the first `await`, so two callers in the same tick cannot both claim. The `started` flag plus `finally` releases the slot on every non-started path, including a throwing due-check. Errors are logged and never reach the caller, so the route's 200 path and the tick's never-throws contract both hold. `__resetSchedulerForTests()` clears the new slots, so tests stay isolated.

The new tests check behaviour, not wiring. The concurrency test uses a gated `pollImap` mock and checks the call count for a third caller and after release. The tick + manual test uses a never-resolving poll so the slot stays claimed. The helper tests cover cleared, partial and out-of-range input plus non-integer and non-numeric clamp input.

## QA Assessment

QA run 2 added EC-1 for the user-visible part of fix 2. It makes real assertions: the input value after clearing, the description copy, the PUT status and body, and the "Saved" state. Fixes 1 and 3 were routed to unit tests with a stated reason; both reasons are sound. The open observation on hung tasks is confirmed above. The QA verdict PASS matches the code.

## Independent Check Results

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Lint | `npx tsc --noEmit` | Pass | exit 0 |
| Unit Tests | `npm test` | Pass | 7 files, 170 tests |
| Build | `npm run build` | Pass | exit 0. Run with `DATABASE_URL=file:./dev.db` (worktree DB), `ANTHROPIC_API_KEY=''`, `SMARTBRIEF_SCHEDULER=off` |
| E2E Tests | `npm run e2e` | Pass | 14/14 (HP-1, HP-2 x5, HP-3, HP-4, EC-1, appearance x4, smoke). Throwaway `prisma/e2e.db` on :3103, `SMARTBRIEF_SCHEDULER=off` |

The live DB and the launchd service on :3000 were not touched.

## Summary for Fix Mode

The verdict is PASS, so no fix is required. Optional follow-ups:

1. [MINOR] Add a staleness bound to the piggyback slots (claim timestamp, reclaim after about 10 minutes with a warning).
2. [MINOR] Validate the Daily time on save instead of snapping the input back on partial edits.
3. [MINOR] Roving tabindex and arrow keys for the "Refresh mode" radiogroup.
4. [MINOR] Log one warning when Daily mode has an unparseable time.
5. [MINOR] Move `tickRunning` and `lastFailureAt` onto `globalThis`.
