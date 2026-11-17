# Review: Scheduled Refresh

> Spec: [01-spec.md](01-spec.md)
> Implementation: [02-implementation.md](02-implementation.md)
> QA: [03-qa.md](03-qa.md)
> Date: 2026-11-17
> Review #: 1
> Verdict: **PASS**

## Verdict Summary

The implementation meets all 19 acceptance criteria. I verified this against the diff, the new modules and the tests, and re-ran tsc, unit tests, build and e2e myself. All four checks pass. No CRITICAL or MAJOR issues. Six MINOR issues remain: edge cases in the piggyback concurrency, Settings save robustness and radiogroup keyboard behaviour. None of them blocks shipping.

## Acceptance Criteria Check

| # | Criterion | Spec Met? | QA Proven? | Notes |
|---|-----------|-----------|------------|-------|
| 1 | `refreshMode` / `refreshDailyTime` columns with defaults | Yes | N/A (check-result) | `prisma/schema.prisma:63-64`, defaults `manual` / `07:00` |
| 2 | GET preferences and GET news return both fields | Yes | Partly | `dbToPreferences()` and `src/app/api/news/route.ts:47-48`. HP-4 proves the preferences GET. The news GET is proven by code inspection and tsc only |
| 3 | PUT validates and returns 400 for invalid values | Yes | Yes (unit) | `validateRefreshPrefsInput` is called first in PUT (`route.ts:108`). Unit tests cover `hourly`, `7:00`, `25:00`, 5 |
| 4 | Backup round-trip | Yes | N/A (check-result) | `backup-db.ts` copies whole rows. `coerceRow` filters by the runtime schema. `PREFERENCE_FIELDS_NOT_IMPORTED` does not contain the new fields |
| 5 | Manual never due | Yes | Yes (unit) | |
| 6 | Interval rule incl. clamp 15 | Yes | Yes (unit) | 59/60 min boundary and clamp tested |
| 7 | Daily 07:00 incl. catch-up | Yes | Yes (unit) | All spec cases present, plus a manual refresh after the slot |
| 8 | Invalid time never due, unknown mode = manual | Yes | Yes (unit) | |
| 9 | Single-flight `refreshNews()` | Yes | Yes (integration) | Gated `fetchAllFeeds` mock. Same promise identity and one fetch. A fresh run after settle |
| 10 | Kill switch, one timer on double start | Yes | Yes (unit) | |
| 11 | Tick → refresh → piggyback, 15 min backoff | Yes | Yes (unit) | Boundary `FAILURE_BACKOFF_MS - 1` vs `FAILURE_BACKOFF_MS` tested |
| 12 | `POST /api/news/refresh` unchanged | Yes | Code inspection | Response shape unchanged. Piggyback errors are now swallowed and no longer reach the 500 path. This is an improvement |
| 13 | Pref change effective at next tick | Yes | Yes (unit) | `tick()` reads prefs and AppState every run |
| 14 | Manual default UI | Yes | Yes (e2e HP-1) | |
| 15 | Interval UI, 5 options, `aria-pressed`, copy | Yes | Yes (e2e HP-2 x5) | |
| 16 | Daily UI, labelled input 07:00, catch-up copy | Yes | Yes (e2e HP-3) | Copy matches `00-ux-design.md` exactly |
| 17 | Daily 07:30 survives save and reload | Yes | Yes (e2e HP-4) | Asserts PUT 200 body and the state after reload |
| 18 | tsc, test, build, e2e pass | Yes | Yes | Re-run independently, see below |
| 19 | README and CLAUDE.md updated | Yes | N/A | Both describe the modes, local time, catch-up, cost and the kill switch |

## Issues

### CRITICAL

None.

### MAJOR

None.

### MINOR

**[MINOR] Piggyback can run twice when a tick joins an in-flight manual refresh**
- **File:** `src/lib/scheduler.ts:82`, `src/app/api/news/refresh/route.ts:12`
- **What:** Suppose a manual refresh is running and the tick finds the schedule due. The tick then joins the same promise, as designed. After that, both callers run `runPostRefreshTasks()`. `isImapPollDue()` reads `lastImapPoll`, and `pollImap()` writes it only at the end (`imap-poller.ts:219`). Both checks therefore return true, and `pollImap()` / `detectAndPush()` start twice in parallel. Example: Daily is set to 07:00 and the user taps refresh at 06:59.
- **Why it matters:** The second run duplicates the IMAP work. It can also hit the unique URL constraint on insert, or send a duplicate breaking-news push. Two quick manual taps already had this race before this feature, but the scheduler makes it more likely. The calls are fire-and-forget and errors are logged, so no data is lost.
- **Suggested fix:** Make `runPostRefreshTasks()` single-flight, with the same `globalThis` promise pattern as `refreshNews()`. Alternatively, run the piggyback only in the caller that started the refresh.

**[MINOR] Clearing the Daily time blocks the whole Settings save**
- **File:** `src/app/settings/page.tsx:1744`, `src/app/api/preferences/route.ts:108`
- **What:** When the user clears the time input, the page sends `refreshDailyTime: ''`. The PUT then rejects the whole body with 400, so no other preference is saved either. The page shows only the generic "Failed to save" message. Impl and QA already reported this.
- **Why it matters:** The user does not see which field caused the failure, and unrelated changes are lost.
- **Suggested fix:** Add `required` to the input and keep the last valid value when the input is empty. Or show the API error text next to the time input.

**[MINOR] A legacy `refreshIntervalMins` below 15 blocks every Settings save**
- **File:** `src/app/api/preferences/route.ts:108`, `src/app/settings/page.tsx:985`
- **What:** The Settings page always sends `refreshIntervalMins`. Before this change, the API accepted any value. A row that holds a value below 15 now makes every Settings save return 400, even in Manual mode. The old UI offered 30 min at minimum, so only a direct API call or a backup import could have stored such a value.
- **Why it matters:** The probability is low. If it happens, though, the user cannot save any preference from the Settings page.
- **Suggested fix:** On load, set the page state to `Math.max(prefs.refreshIntervalMins, 15)`. Alternatively, send `refreshIntervalMins` only in Interval mode.

**[MINOR] The radiogroup does not follow the WAI-ARIA radio keyboard pattern**
- **File:** `src/app/settings/page.tsx:1688`
- **What:** The three `role="radio"` buttons are all separate tab stops. Arrow keys do not move the selection.
- **Why it matters:** Screen-reader users expect radio behaviour: one tab stop and arrow keys to change the selection. The spec prescribed this markup, so this is a spec-level gap, not an implementation error.
- **Suggested fix:** Use a roving `tabIndex` (0 on the checked radio, -1 on the others) and an `onKeyDown` handler for the arrow keys. Or use native `<input type="radio">` elements with styled labels.

**[MINOR] An invalid `refreshDailyTime` disables the schedule without a log line**
- **File:** `src/lib/scheduler.ts:65`
- **What:** A malformed time can reach the DB through a backup import. In that case, `isRefreshDue` returns false on every tick, and nothing is logged.
- **Why it matters:** The user has Daily active in the UI, but no refresh ever runs, and the log gives no hint why.
- **Suggested fix:** In `tick()`, log one warning when the mode is `daily` and `parseDailyTime` returns null. Rate-limit the warning, for example once per process or once per distinct value.

**[MINOR] Tick state is module-scoped, the start guard is global**
- **File:** `src/lib/scheduler.ts:27-28`
- **What:** `tickRunning` and `lastFailureAt` are module-level variables. `__smartbriefSchedulerStarted` lives on `globalThis`. QA found the same. After a dev hot reload, the old timer keeps calling the old module, so the behaviour stays consistent. The production server (`next start`) is not affected.
- **Why it matters:** The design is inconsistent with the stated reason for using `globalThis`. There is no functional defect today.
- **Suggested fix:** Optional. Move both fields onto `schedulerGlobal`.

## Spec Compliance

All eight steps are implemented as specified. The documented deviations are justified:
- QA owns the e2e and `.feature` files. QA created both, and they match the Gherkin Impact scenario list one-to-one.
- The pure `validateRefreshPrefsInput` helper makes AC3 testable as a unit.
- The route awaits `runPostRefreshTasks()`, which awaits only the due-checks. This is the same as the old route.
- The exported `tick()` and a test reset hook enable the runtime tests.

There is no scope creep. The changed `refreshIntervalMins` defaults (60 → 360) and the initial state of the Settings page follow Decision 1 and Step 3. `node-cron` is untouched, as specified. Decision 10 is respected: no BDD runner was added.

## Code Quality

The pure logic follows the `retention.ts` split: exported constants, no Prisma import, and fixed local-time `NOW` values in the tests so they pass in any time zone. The string-enum preference follows `moodPreset` and fails closed to `manual`. The single-flight wrapper is small and correct: `.finally` clears the slot on both resolve and reject, and it is stored on `globalThis`. The tick never throws: the DB read, the refresh and the piggyback are all caught. `runRefresh()` always writes `lastRefreshed` on success, including the no-new-articles path. The Claude calls degrade gracefully and do not throw. A broken feed or a missing key therefore produces no retry loop every minute. Only real exceptions trigger the 15-minute backoff, which is the intended design.

The tests check behaviour. The single-flight test uses a gated mock and asserts promise identity. The backoff test hits the exact boundary. The e2e spec runs serially and restores Manual in `afterAll`, so it does not affect other spec files.

`npm run build` printed no `[scheduler]` line. The instrumentation does not start the tick during the build, so a build cannot trigger a refresh.

## QA Assessment

QA routed every AC to a sensible venue. The e2e scenarios make real assertions: radio `aria-checked`, the exact copy, `aria-pressed` exclusivity across all five options, and the PUT response body plus the state after reload. HP-2 is an outline that covers the new "6 hours" option. QA's minor observations are confirmed above. The QA verdict PASS matches the code.

## Independent Check Results

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Lint | `npx tsc --noEmit` | Pass | exit 0 |
| Unit Tests | `npm test` | Pass | 7 files, 160 tests |
| Build | `npm run build` | Pass | exit 0. Run with `ANTHROPIC_API_KEY=''` against the worktree `dev.db`. No scheduler activity during the build |
| E2E Tests | `npm run e2e` | Pass | 13/13. Throwaway `prisma/e2e.db` on :3103 with `SMARTBRIEF_SCHEDULER=off` |

The live DB and the launchd service on :3000 were not touched.

## Summary for Fix Mode

The verdict is PASS, so no fix is required. These issues are optional follow-ups:

1. [MINOR] Make `runPostRefreshTasks()` single-flight, so that a tick that joins a manual refresh does not start the IMAP poll or the breaking-news detection twice.
2. [MINOR] Keep the Daily time input from sending `''`: add `required` and fall back to the last valid value.
3. [MINOR] Clamp a legacy `refreshIntervalMins` below 15 on load in Settings, so the page never sends a value the API rejects.
4. [MINOR] Add a roving tabindex and arrow-key handling to the "Refresh mode" radiogroup.
5. [MINOR] Log one warning when Daily mode has an unparseable time.
6. [MINOR] Move `tickRunning` and `lastFailureAt` onto `globalThis`, so they are consistent with the start guard.
