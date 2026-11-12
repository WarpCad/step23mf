# step23mf — Project Instructions

A command line tool that converts STEP files to 3MF, keeping part colors and names.
MIT licensed. Part of the WarpCad family (`../warpcad`), but independent: no shared code, no AGPL.

> **Status:** converts single parts, per-face colors and assemblies (as 3MF component groups). Open work is in `TODO/ROADMAP.md`, finished work in `TODO/done/`. The
> `.claude/commands/*` workflows read this file as the source of truth, so correct it when reality diverges.

## Verification

Unit tests prove the code matches its author's expectations, not that the output opens correctly.

- **`TODO/ACCEPTANCE.md` holds the named end-to-end scenarios.** The AI drives them by running the real CLI
  against real STEP files and inspecting the produced 3MF (unzip it, read `3D/3dmodel.model`), not by
  re-running a spec. Report PASS/FAIL per scenario.
- **Every task re-drives the scenarios touching what it changed**, and a regression there outranks the
  task's own green tests.
- **A closed finding's subsystem stays a regression surface.** When a new task extends it, re-run the
  finding's original reproduction too.
- **Round-trip check.** Output claims ("colors kept", "names kept") are checked by reading the 3MF back,
  and by opening it in a real consumer (PrusaSlicer, Cura, Windows 3D Viewer, WarpCad) when one is at hand.

## Stack

| Concern | Choice | Record |
|---|---|---|
| Language | Plain JavaScript (ESM), JSDoc types checked by `tsc --noEmit` | Committed |
| Runtime | Node >= 20 | Committed |
| STEP reader | `occt-import-js` (OpenCascade WASM, LGPL-2.1 dependency) | `docs/decisions/step-reader.md` |
| 3MF writer | `fflate` (zip) plus hand-written XML | Committed |
| Tests | Vitest | Committed |
| Release | release-it (`npm run release`) | `docs/decisions/release-tool.md` |

Version pins live in `package.json`. Don't copy them here.

## Structure

- `bin/step23mf.js` — executable shim. Calls `main()`, nothing else.
- `src/cli.js` — argument parsing and exit codes. No conversion logic.
- `src/` — one module per concern (STEP reading, scene model, 3MF writing). Pure functions where possible:
  the converter takes bytes in and returns bytes out, and only `cli.js` touches the filesystem.
- `test/` — `*.spec.js` next to the concern, `test/fixtures/` for small STEP files.
- `docs/` — user documentation and `docs/decisions/` records.

## Conventions

- **Types:** every exported function has a JSDoc signature. `npm run typecheck` must pass.
- **Units are explicit.** 3MF declares its unit; write `millimeter` and say so wherever a number crosses a
  module edge. STEP lengths are converted at the reader boundary, never later.
- **Colors:** keep the source sRGB values untouched. 3MF `displaycolor` is `#RRGGBB` or `#RRGGBBAA`.
- **Names:** keep names verbatim (XML-escape them, don't sanitise). Unnamed parts get a stable
  `Part N` fallback so output is deterministic.
- **Determinism:** the same input produces byte-identical output. Fixed zip timestamps, stable ordering.
- **Numerical code gets numerical tests** with explicit tolerances, and degenerate cases: empty shape, zero
  triangles, repeated instances, huge coordinates, non-manifold input.
- **Mock at the boundary:** the filesystem and the WASM reader. A unit test never needs a real STEP parse
  unless it is a fixture test, and those use small files.
- **Errors:** user mistakes (missing file, not a STEP file) print one clear line to stderr and exit 1 or 2.
  A stack trace is a bug.
- **Dependencies:** ask before adding one. Prefer MIT/BSD/Apache. LGPL is accepted only for the STEP reader,
  as a non-bundled dependency.

## Library decisions

When choosing or re-evaluating a dependency, `docs/decisions/<name>.md` includes several real options
compared on features, size, stars, open-to-closed issue ratio, release recency and maintainer count, plus a
rejection table giving each runner-up's specific reason for losing. Re-run the health check when a deferred
dependency is about to be pulled in.

## Working files

- `TODO/ROADMAP.md` — ordered open work. `TODO/<id>-<slug>.md` — one file per task. `TODO/done/` — closed.
- `TODO/ACCEPTANCE.md` — the scenarios the AI drives.
- `TODO/VERIFY.md` — short queue for one-off manual checks. Create it when first needed.
- `TROUBLESHOOTING.md` — non-obvious root causes. Read before debugging, append via `/troubleshoot`.
- `CHANGELOG.md` — release history. Create it at the first release.

## Commits and pushing

- Conventional-commit style (`feat(step): …`). Scopes: `cli`, `step`, `3mf`, `core`, `docs`, `build`.
- **Never push without an explicit request.** Commit locally and say it is not pushed.
- **No GitHub Actions run automatically.** Minutes cost money. Both workflows are `workflow_dispatch` only: `ci.yml`
  (the OS × Node matrix, run by hand when a change touches WASM loading or paths) and `release.yml`. Never add a
  `push`, `pull_request`, `schedule` or other automatic trigger.
- **Pushing is gated locally.** `.githooks/pre-push` (installed by `npm install` via `scripts/install-hooks.mjs`) runs
  `npm test` and `npm run typecheck` on the pushed commit, and refuses the push if either fails, if the tree has
  uncommitted tracked changes, or if the pushed commit isn't `HEAD`. `git push --no-verify` skips it.
- Authorship follows the global git config; check `git config user.email` before the first commit.

## Releasing

- `npm run release` runs `release-it` (`.release-it.json`, `docs/decisions/release-tool.md`). It runs the tests and
  typecheck, bumps `package.json`, writes `CHANGELOG.md` from conventional commits, commits, tags `vX.Y.Z`, pushes,
  creates the GitHub release and publishes to npm.
- **It pushes, tags and publishes. Run it only when the user asks for a release, and pass the version they chose.**
  `npm run release -- --dry-run` shows every step without changing anything; use it first.
- A local publish needs `npm login`. Provenance comes from the CI release workflow, not from this command.
- Needs a clean working tree on `main` with an upstream. The GitHub release needs `GITHUB_TOKEN`; without it,
  release-it prints a link to create the release by hand.

## Asking the user

Every question goes through `AskUserQuestion`, never as plain text. Your global CLAUDE.md
(`~/.claude/CLAUDE.md`) holds the full rules: the "Explain more" and "Defer"/"Pause" options, the
standalone-question requirement, and the subagent restriction. They apply here without exception.
