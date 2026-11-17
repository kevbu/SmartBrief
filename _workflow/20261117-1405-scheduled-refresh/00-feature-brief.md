# Feature Brief: Scheduled Refresh

## What it does
The server refreshes the news on its own, either on a fixed interval or once a day at a set time (e.g. 07:00), so a fresh briefing is ready when the user opens the app.

## Why it's valuable
Today `refreshIntervalMins` is saved in Settings but nothing reads it. The user must tap refresh and wait one to two minutes for Claude to score and cluster. A daily morning refresh removes that wait for the main use case (morning briefing).

## Context from the code
- `src/lib/scheduler.ts` is an empty stub. `src/instrumentation.ts` already calls `startBackgroundRefresh()` once at server start (Node runtime).
- A scheduler existed before (b89a74f: node-cron every 6h + refresh on stale startup). Commit da29b06 removed it **on purpose, to stop background API costs**.
- `UserPreferences.refreshIntervalMins` has DB default 360, but the Settings UI only offers 30/60/120/240. No field says "manual".
- `refreshNews()` has no concurrency guard. A scheduled and a manual refresh can run at the same time and double the Claude calls.
- The app runs as a launchd agent on a Mac. The Mac may sleep at 07:00. A plain cron job then misses the slot.

## In scope
1. New preference **refresh mode**: `manual` (default) | `interval` | `daily`.
2. New preference **daily time** (`HH:MM`, default `07:00`, server local time).
3. Server-side scheduler in `scheduler.ts`: a one-minute tick that decides whether a refresh is due. Pure "is due?" logic in its own function with unit tests.
4. **Catch-up:** if the Mac slept or the server was down at 07:00, the refresh runs at the next tick after wake/start, as long as no refresh happened since the 07:00 slot. Same for interval mode (due = last refresh + interval).
5. **Single-flight guard** around `refreshNews()`: scheduled and manual refresh share one in-flight promise. No double runs.
6. The scheduled refresh also runs the IMAP poll and breaking-news detection, like the manual route does.
7. Settings "Auto-Refresh" section: choose Manual / Interval / Daily. Interval shows the existing 30m–4h options. Daily shows a time picker. Short hint: "Runs only while your computer is on. Each refresh uses Claude."
8. Settings changes take effect without a server restart (the tick reads the preferences every time).

## Out of scope
- Waking the Mac from sleep (`pmset schedule wake`). Catch-up on wake covers the use case. Could be a README note.
- Several daily times or weekday rules ("only Mon–Fri").
- Client-side auto-refresh in the browser.
- Push notification "your briefing is ready".
- Showing the next scheduled run in the UI (nice to have, defer unless cheap).

## UI changes
Yes. Settings, "Auto-Refresh" section only.

## Known constraints
- **Cost:** default stays `manual`, so nothing changes for existing installs until the user opts in. Existing rows get `manual` through the schema default.
- Time zone = the server's local time zone. On a Mac that is the user's time zone. In Docker it is UTC unless `TZ` is set. Document that.
- `node-cron` is installed but not needed: the minute tick with "is due?" logic handles catch-up, cron does not.
- Next.js dev mode with hot reload may register the tick twice. Guard with a `globalThis` flag.
- Schema change → `npm run db:push`; `deploy-local.sh` handles that on deploy.
- e2e tests run on their own dev server; the scheduler must stay inactive there (mode `manual` in the throwaway DB is enough).
