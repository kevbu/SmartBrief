# Review: Theme override (System / Light / Dark)

> Spec: [01-spec.md](01-spec.md)
> Implementation: [02-implementation.md](02-implementation.md)
> QA: [03-qa.md](03-qa.md)
> Date: 2026-11-16
> Review #: 1
> Verdict: **PASS**

## Verdict Summary

The diff implements all six spec steps in the specified files, with one documented and justified deviation (theme-color meta ownership). Every AC except the live-OS half of AC5 is proven in a production build. The only failing check is `test-cmd`, which fails because Jest is not installed. This is pre-existing, and the Gate 2 spec excluded it explicitly (Decisions: "No unit test … Adding a test runner is out of scope"). The review skill's rule says a pre-existing failure is MAJOR → FAIL. I did not apply that rule here, because fix mode cannot resolve the failure without reversing an approved scope decision. It is escalated to Gate 3 instead (see MAJOR, pre-existing).

## Acceptance Criteria Check

| # | Criterion | Spec Met? | QA Proven? | Notes |
|---|-----------|-----------|------------|-------|
| 1 | Appearance first, stored choice highlighted | Yes | Yes | `settings/page.tsx:1106`; `ThemeToggle` syncs in `useEffect` |
| 2 | Instant switch to Light with OS dark | Yes | Yes | `setThemePreference` sets `dataset.theme` synchronously |
| 3 | No wrong-theme frame on reload | Yes | Yes | Script is first `<head>` child, before CSS/body |
| 4 | Dark with OS light; `dark:` utilities apply | Yes | Yes | `darkMode: ['selector', '[data-theme="dark"]']` |
| 5 | Light/Dark fixed; System follows OS live | Yes (code) | Partial | Live `change` path not testable via CDP emulation |
| 6 | theme-color follows theme | Yes | Yes | Single meta owned by script |
| 7 | Storage failure → System, no errors | Yes | Yes | try/catch in `pref()`, `readThemePreference`, `setThemePreference` |
| 8 | No hydration warning | Yes | Yes | `suppressHydrationWarning` on `<html>` |
| 9 | tsc + build | Yes | Yes | Re-run below |

## Issues

### CRITICAL

None.

### MAJOR

**[MAJOR, pre-existing, out of scope by approved spec] `test-cmd` cannot run**
- **File:** `CLAUDE.md` Workflow Config (`test-cmd`), `package.json` (no `jest`)
- **What:** `node --experimental-vm-modules node_modules/.bin/jest …` → `Cannot find module …/node_modules/.bin/jest`. Jest was never a dependency.
- **Why it matters:** The repo's only unit test (`importance-score.test.ts`) never runs. Every pipeline run reports a red test check.
- **Suggested fix:** Separate change: add `jest` + `ts-jest` (or switch to `vitest`) with a `test` script, and update `test-cmd`. Not this feature.

### MINOR

**[MINOR] Resolve logic duplicated in the init-script string**
- **File:** `src/lib/theme.ts:63-69` vs `:21-28`
- **What:** `pref()`/`apply()` inside `THEME_INIT_SCRIPT` re-implement `parseThemePreference`/`resolveTheme`. Constants are shared via `JSON.stringify`; the logic is not.
- **Why it matters:** Future edits could drift (e.g. adding a fourth mode in one place only).
- **Suggested fix:** Leave it. The script must be dependency-free. The duplication is 2 lines and sits next to the originals.

**[MINOR] System-mode live follow not machine-verified**
- **File:** `src/lib/theme.ts:67-68`
- **What:** The `matchMedia` change listener is correct by reading, but untested.
- **Suggested fix:** Manual check after deploy: with System selected, toggle macOS appearance.

**[MINOR] `.claude/launch.json` is an untracked local dev artifact**
- **File:** `.claude/launch.json`
- **What:** Points at a scratchpad DB path. It must not be committed.
- **Suggested fix:** Exclude it from the ship commit.

**[MINOR] Theme switch animates controls for 200 ms**
- **File:** `src/components/ThemeToggle.tsx:62`, also existing settings buttons
- **What:** `transition-colors duration-200` makes controls fade between palettes while the background flips instantly.
- **Suggested fix:** None needed. This matches existing component behaviour.

## Spec Compliance

All six steps are present in the specified files. No files outside the spec are touched (no `package.json`, `prisma/`, `scripts/` changes). The deviation (`viewport.themeColor` removed; script owns the meta) is documented, and the duplicate-meta evidence justifies it. No scope creep.

## Code Quality

`ThemeToggle` mirrors `MoodPresetToggle` classes, `aria-pressed` and icon style exactly. It uses semantic tokens only. The init script is ES5 and fully guarded. React diffs `<html data-theme="light">` against its previous props, not the DOM, so layout re-renders (e.g. `router.refresh`) do not reset the attribute. CSS has a single source for dark tokens.

## QA Assessment

No e2e stack exists, so QA ran an independent browser pass on the production build (`next start`). It confirmed persistence across reload, script placement on 3 routes, a single theme-color meta, and a clean console. The evidence is concrete (computed colours, attribute values). The live OS-change gap is honestly reported.

## Independent Check Results

| Check | Command | Result | Notes |
|-------|---------|--------|-------|
| Lint | `npx tsc --noEmit` | Pass | exit 0 |
| Unit Tests | `node --experimental-vm-modules node_modules/.bin/jest src/lib/importance-score.test.ts` | Fail (pre-existing) | `Cannot find module …/node_modules/.bin/jest` |
| Build | `npm run build` | Pass | Pre-existing "inferred workspace root" warning |
| E2E Tests | — | N/A | Not configured |

## Summary for Fix Mode

No fix round. The verdict is PASS. The pre-existing `test-cmd` failure goes to Gate 3 and file-findings.
