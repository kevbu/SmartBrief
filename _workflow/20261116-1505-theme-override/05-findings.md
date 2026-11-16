# Findings Filed: Theme override (System / Light / Dark)

> Workflow: `_workflow/20261116-1505-theme-override/`
> Date: 2026-11-16
> Repo: kevbu/SmartBrief
> Shipped PR: https://github.com/kevbu/SmartBrief/pull/23
> gh auth: OK

## Issues Created

| Issue | Title | Kind | Severity | Source |
|-------|-------|------|----------|--------|
| #24 (https://github.com/kevbu/SmartBrief/issues/24) | [bug] test-cmd cannot run: Jest is not installed | bug | major | review |
| #25 (https://github.com/kevbu/SmartBrief/issues/25) | [test-debt] No e2e framework configured; UI behaviour is verified manually only | test-debt | — | qa |
| #26 (https://github.com/kevbu/SmartBrief/issues/26) | [follow-up] public/manifest.json colours predate the editorial palette | enhancement | — | scope |

## Skipped (already existed)

None.

## Failed

None.

## Not Filed

- System-mode live OS follow (review MINOR / QA minor): this is a one-time manual check for Kevin after deploy, not tracked work.
- Duplicated resolve logic in `THEME_INIT_SCRIPT` (review MINOR): the review recommends leaving it as is.
- `.claude/launch.json` untracked (review MINOR): handled. It was kept out of the commit.
- 200 ms control fade on theme switch (review MINOR): no action needed. It matches the existing behaviour.
- Other out-of-scope items (header toggle, DB-synced theme, dark palette redesign): deferred by choice at Gate 1. Kevin did not approve filing them.
