# Fix a TODO

Argument: a TODO id (e.g. `step-001`). Work one task end to end. Questions go through `AskUserQuestion`.

## Step 1 — Locate
Find `TODO/<id>-*.md` (`ls TODO`). If missing or ambiguous, list the candidates and ask. If it is already in
`TODO/done/`, say so and stop.

## Step 2 — Read and confirm scope
Read the TODO fully, plus any file it references and the `ROADMAP.md` row. Check its **Testing** section names
a spec or fixture and its **Acceptance** section names scenarios. If the spec is vague, tighten it with the
user before coding. Anything user-visible (a flag, output format, message) needs its exact wording in the spec.

## Step 3 — Preflight
Run `/test`. If the baseline is red, stop and report. Don't build on a failing tree.

## Step 4 — RED / GREEN
Tests first (see `/tdd`): failing, then minimum code. Re-run the original reproduction steps of any closed
finding in the same subsystem, not just the new spec.

## Step 5 — Full verification
Run `/test` again, all stages. Red outranks everything: use the escalation ladder in `/test`.

## Step 6 — Drive the acceptance scenarios
Run each `ACCEPTANCE.md` scenario touching the changed subsystem with the real CLI (`run-step23mf` skill), read
the 3MF back, and report PASS/FAIL per scenario. A FAIL here blocks closing the task. One-off judgment calls
no scenario covers go in `TODO/VERIFY.md`, kept short.

## Step 7 — Docs
Update `README.md`, `docs/` and `--help` for anything user-visible. Examples must run.

## Step 8 — Retire
`git mv TODO/<id>-*.md TODO/done/`. Move its row out of `TODO/ROADMAP.md` and add a one-line entry (date,
commit subject) to `TODO/ROADMAP-DONE.md`, creating it if needed.

## Step 9 — Commit
Hand off to `/commit`, naming the TODO id and the file move. Never push.

## Report
TODO id, what changed, test counts, acceptance PASS/FAIL per scenario, files touched, anything deferred.
