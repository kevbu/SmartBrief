# Review: Persistent saved items and safe local DB

> Spec: [01-spec.md](01-spec.md) · Impl: [02-implementation.md](02-implementation.md) · QA: [03-qa.md](03-qa.md)
> Date: 2026-11-16
> Reviewer: independent subagent (given spec + code only), findings re-checked by orchestrator
> Verdict: PASS_WITH_NOTES

Note: `codebase-review` is a whole-repo audit. For this gate a diff-scoped adversarial review was run instead.

## Verified sound

- `selectCurrentBatch` + single `batchCreatedAt`; `saved` returned by `/api/news`.
- No other `src/` reader assumes all TopStory rows are the current batch (feedback, save, `articles/[id]?topStoryId` use `findUnique` by id; recap and breaking news never read TopStory).
- `/api/saved` is behind `src/proxy.ts` auth matcher and is dynamic (not prerendered).
- Migration script: `set -u` with empty arrays (bash 3.2), EXIT trap on SIGINT/SIGTERM, awk rewrite keeps other lines, quoting with spaces.

## Findings

| # | Severity | Location | Issue | Fix |
|---|---|---|---|---|
| 1 | MAJOR (security) | `scripts/migrate-db-location.sh` env rewrite | `.env.bak` / `.env.local.bak` land in the main checkout and are NOT gitignored (verified with `git check-ignore`). A later `git add -A` would push secrets to the remote. | Write env backups to `$DATA_DIR/env-backups/` |
| 2 | MINOR | `scripts/deploy-local.sh:58-61` | Comment is wrong: `git pull` replaces the file's inode, bash keeps reading the old one. Consequence: the deploy that pulls this change runs the old script, so no backup on that deploy. | Fix comment; note in PR to run `npm run deploy:local -- --force` once after merge (or back up manually) |
| 3 | MINOR | `scripts/lib/db-path.sh` `backup_db` | `.backup` against the live DB without busy timeout; SQLITE_BUSY under `set -e` aborts the deploy and leaves a partial backup counted in rotation (plausible, not reproduced). | `-cmd '.timeout 5000'`; on failure remove target, warn, return 0 |
| 4 | MINOR | `scripts/migrate-db-location.sh` copy step | Interrupted/failed copy leaves partial `$DST`; next run refuses "Target already exists" without explaining. | Remove `$DST` in the rollback trap while `ROLLBACK=1` |
| 5 | MINOR | `src/lib/news-aggregator.ts:161-175` | `deleteMany` + `createMany` not atomic. Failure or restart between them leaves only saved rows → feed shows the newest saved batch (AC3 broken until next refresh). | `db.$transaction([...])` |
| 6 | MINOR (design) | refresh lifecycle | Saving X, then next refresh rebuilds the same cluster as unsaved X′; saving again duplicates on `/saved`. | Follow-up (match by articleIds overlap) |
| 7 | MINOR (tooling) | `CLAUDE.md` `test-cmd` | Jest not installed; AC7 verified only via shim. `importance-score.test.ts` fixture bug found. | Follow-up issue |
| 8 | Info | DB URL with space | Reviewer flagged as unverified; already verified during implementation (`prisma db push` + `PrismaClient` with `…/App Support Test/t.db`). | None |

Nits (no action): `/saved` drops the card without checking `res.ok` (same as existing article path); h2 uses `mb-3 px-4` vs spec `mb-1` in a `px-4` wrapper.

## Summary for Fix Mode

Recommended before ship: 1 (must), 2, 3, 4, 5. Defer: 6, 7 (file as issues).
