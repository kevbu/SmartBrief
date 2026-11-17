# Review: Backup export and import

> Spec: [01-spec.md](01-spec.md) · Impl: [02-implementation.md](02-implementation.md) · QA: [03-qa.md](03-qa.md)
> Date: 2026-11-17
> Reviewer: independent subagent (given spec + code only), findings re-checked by orchestrator
> Verdict: PASS_WITH_NOTES

Note: `codebase-review` is a whole-repo audit. For this gate a diff-scoped adversarial review was run instead, as in earlier runs.

## Verified sound
- Never deletes; all writes in one interactive transaction; URL-based id remap correct; re-import creates 0 rows.
- Export reads only the five allow-listed models; no AppState, PushSubscription or env values.
- `src/proxy.ts` matcher covers `/api/backup/*`.
- `coerceRow` keeps only dmmf-known keys, so `__proto__` / `constructor` keys are dropped.

## Findings

| # | Severity | Location | Issue | Resolution |
|---|---|---|---|---|
| 1 | MINOR | `backup.ts` article promotion | Promotion copied the whole backup row, incl. `criticalPushedAt`, `isRead`, `severity`. Could clear the local push dedup guard → duplicate breaking push | Fixed: promotion copies `isSaved` + `saved*` columns only. Test added |
| 2 | MINOR | `backup.ts` createdAt clamp | On a device with zero top stories, imported saved stories become the feed's current batch until a refresh creates stories | Deferred: fix belongs in `/api/news` / `selectCurrentBatch` (outside this run's file surface). Candidate follow-up |
| 3 | MINOR | validation | Rows missing required columns passed validation and failed in Prisma with 500 | Fixed: dmmf-based required / non-nullable check before the transaction → 400. Test + QA |
| 4 | MINOR | preferences import | Skipped the ratio-sum rule of `PUT /api/preferences` | Fixed: same rule in `validateBackup`. Range checks: PUT has none either, so parity reached |
| 5 | NIT | `settings/page.tsx` | `NewsletterIngestSection` kept stale `hiddenSources` after import | Fixed: `key={importVersion}` |
| 6 | NIT | `planKeyedUpserts` | Idempotent re-import reported weights as updated | Fixed: identical rows count as unchanged and are not written |
| 7 | NIT | import route | Without Content-Length the body is buffered before the 20 MB check | Accepted: single-user app behind auth |
| 8 | NIT | `validateBackup` | Crafted file with one id for two URLs could misroute story references | Fixed: duplicate article/story ids rejected |

## Gate 3 decision
Approved by orchestrator (autonomous mode). Reason: no BLOCKER/MAJOR; findings 1, 3, 4, 5, 6, 8 fixed and re-verified (tsc, 46/46 tests, build, regression QA on fresh DB C). 2 and 7 are documented follow-ups.
