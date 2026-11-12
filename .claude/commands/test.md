---
model: haiku
---

# Run All Tests

Run the full suite from the repo root and report clean pass/fail. Anything that needs "run the tests" invokes
this skill (`/test`) rather than hand-rolling commands.

## Who runs this
Test output is mechanical and can be large. If you are not Haiku, spawn one `Agent`
(`subagent_type: "claude"`, `model: "haiku"`, foreground) to run the stages and reply with only the report
below. Haiku never fixes anything; a failure goes back to the caller. Stop at the first red stage.

## Stages
1. `npm run typecheck` — must exit 0.
2. `npm test` — `vitest run`, the full suite. Never truncate its output with `head`/`tail` before reading the
   summary line; a truncated read once hid failures. Log such a discovery with `/troubleshoot`.
3. **Acceptance smoke (only when the caller asks, or a task changed conversion output):** run
   `TODO/ACCEPTANCE.md` scenarios with the real CLI (`run-step23mf` skill) and report PASS/FAIL each.

## Report format
```
typecheck: PASS | FAIL (n errors)
unit:      PASS n/n | FAIL k of n — <test ids>
acceptance: not run | 1 PASS, 2 FAIL …
skipped:   <stages not run because an earlier stage was red>
```
Include the first failure message for each red test, not the whole log.

## Escalation when red
Two fix attempts at the task's model tier, one at Opus, then stop and report. A fixer must find the root cause,
never loosen an assertion or tolerance, skip or delete a test, and must list every file it touched.
