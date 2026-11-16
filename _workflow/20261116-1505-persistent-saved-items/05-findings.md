# Findings Filed: Persistent saved items and safe local DB

> Workflow: `_workflow/20261116-1505-persistent-saved-items/`
> Date: 2026-11-16
> Repo: kevbu/SmartBrief
> Shipped PR: https://github.com/kevbu/SmartBrief/pull/27
> gh auth: OK

## Issues Created

| Issue | Title | Kind | Severity | Source |
|-------|-------|------|----------|--------|
| #28 (https://github.com/kevbu/SmartBrief/issues/28) | [bug] importance-score recency-decay test fixture uses one category | bug | minor | review |
| #29 (https://github.com/kevbu/SmartBrief/issues/29) | [bug] Re-saving a rebuilt cluster duplicates it on /saved | bug | minor | review |
| #30 (https://github.com/kevbu/SmartBrief/issues/30) | [follow-up] Track savedAt so /saved sorts by save time | enhancement | – | scope |
| #31 (https://github.com/kevbu/SmartBrief/issues/31) | [follow-up] Article retention policy that keeps saved items and saved-story references | enhancement | – | scope |
| #32 (https://github.com/kevbu/SmartBrief/issues/32) | [follow-up] Export and import settings and saved items as a file | enhancement | – | scope |
| #33 (https://github.com/kevbu/SmartBrief/issues/33) | [follow-up] docs/infrastructure.md documents the retired VPS setup | documentation | – | review |

## Skipped (already existed)

- Jest not installed, `test-cmd` cannot run (review #7) → matched open issue #24
- No e2e coverage for saved journey (QA "Scenarios Deliberately Not Added") → matched open issue #25

## Failed

None.

## Not Filed

- Review findings 1–5: fixed in Fix Round 1.
- Review nits (`res.ok` on unsave, h2 spacing): marked "no action" in review.
- Scope items not deferred: theme/dark mode (separate session, PR #23), Docker paths, running the migration inside the pipeline.
