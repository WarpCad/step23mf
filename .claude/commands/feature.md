# Feature Development (TDD Workflow)

Guide a full TDD feature cycle. Follow the phases in order. Every question goes through `AskUserQuestion`.

## PHASE 1 — Discovery: ask first, code never
Print all questions in one message, then ask the long-list prompt from `CLAUDE.md` (Ready to answer, Explain
more, Pause). Don't offer to draft the answers.
1. In one sentence, what should this do for the user?
2. Which layer: CLI surface / STEP reading / scene model / 3MF writing / docs only?
3. What are the success criteria, and how will we see them in the produced 3MF?
4. Degenerate cases: empty shape, zero triangles, unnamed parts, no color, repeated instances, non-manifold or
   self-intersecting input, a truncated or non-STEP file.
5. Is the behavior fixed, or a flag? If a flag: name, default, and how `--help` describes it.
6. Does it replace or extend something that exists?
7. Which 3MF consumers must open the result (PrusaSlicer, Cura, Windows 3D Viewer, WarpCad)?
8. Units and color spaces involved, and where the conversion happens.
9. Performance: largest expected input, memory ceiling, whether output must stay deterministic.
10. Which `TODO/ACCEPTANCE.md` scenario does this extend, or is it a genuinely new capability class?

Restate the answers, including the exact command line a user would type and the exact 3MF content expected,
and ask whether it matches intent.

## PHASE 2 — Research
Read the relevant modules, specs, `CLAUDE.md` and `docs/decisions/`. Summarize what you found and the planned
approach, then ask whether the approach is right before writing tests.

## PHASE 3 — RED
Write failing tests first, each describing one success criterion, with the Phase 1 degenerate cases. Mock the
filesystem and WASM reader at the boundary. A fixture test may use a small STEP file in `test/fixtures/`.
Run them and show the failure. Confirm before implementing.

## PHASE 4 — GREEN
Minimum code to pass. Conversion logic stays out of `cli.js`: it takes bytes in and returns bytes out.
Run `/test` and show the result. All green before continuing.

## PHASE 5 — Acceptance check
Drive the real CLI (`run-step23mf` skill) for the scenarios from Q10 and read the 3MF back. Report PASS/FAIL.
Add a new `ACCEPTANCE.md` entry only for a new capability class (the list stays at 5–10).

## PHASE 6 — Documentation
Update `README.md`, `docs/`, `CLAUDE.md` if commands or conventions changed, and `--help` text. Examples must
run. Summarize what changed.

## PHASE 7 — Commit
Hand off to `/commit`. The body says what the new tests verify, what Phase 5 found, and which docs changed.
