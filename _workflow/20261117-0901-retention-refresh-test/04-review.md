# Review: Article retention + DB-backed refresh test

> Date: 2026-11-17
> Reviewer: independent subagent (adversarial, read-only, given the diff and spec, not the orchestrator's conclusions)

## Verdict

PASS_WITH_NOTES. No BLOCKER or MAJOR.

Confirmed: saved articles, articles in saved clusters and in the current batch are never pruned. `FeedbackSignal`, `SourceWeight`, `TopicWeight`, `NotificationLog` are never written. The integration test opens only the temp file (forks pool, isolation on, env set before the Prisma import, Prisma dotenv does not override set env vars). Rows with legacy text timestamps fail safe (TEXT never sorts below INTEGER in SQLite, so they are kept).

## Issues and resolution

| # | Sev | Issue | Resolution |
|---|---|---|---|
| 1 | MINOR | Test guard only compared the env string; a cached `globalThis.prisma` could point elsewhere if isolation were off | Fixed: clear `globalThis.prisma` before import, assert `PRAGMA database_list` file equals the temp path |
| 2 | MINOR | Delete re-checked only `isSaved`; a read landing after selection was still deleted | Fixed: every `deleteMany` repeats the full predicate |
| 3 | MINOR | Unparseable `articleIds` silently protected nothing (fail open) | Fixed: prune skipped with a warning; unit + integration test |
| 4 | MINOR | R8 / R9 not exercised | R8 fixed (trigger-based error test). R9: bulk test added, per-call size not assertable (documented in 03-qa) |
| 5 | MINOR | Unread newsletters are pruned 30 days after ingest | Not changed. Product decision, listed as follow-up |
| 6 | MINOR | Window < 30 days thins 14/30-day recap | Documented in `CLAUDE.md` and `.env.local.example` |
| 7 | INFO | Step-7 merge overwrites a saved cluster's `articleIds`, so dropped originals become prunable | Not changed. Pre-existing merge behaviour, listed as follow-up |

## GATE 3

Approved autonomously 2026-11-17 09:25. Reason: no blocker, fixable notes fixed, the two open notes are product decisions outside #31/#37 and go to the final report. All gates re-run green after the fixes.
