# TDD Cycle — Red → Green

Add a well-tested behavior to existing code using strict Test-Driven Development.
Every question goes through `AskUserQuestion` (see `CLAUDE.md` "Asking the user").

## Step 1 — Clarify the behavior
Ask: (1) the one behavior to test; (2) which module it belongs to; (3) unit test or fixture test (real small
STEP file); (4) expected input and output; (5) degenerate cases: empty shape, zero triangles, repeated
instances, unnamed parts, missing color, a value at a tolerance edge. Restate the behavior as one plain
sentence and get confirmation before writing anything.

## Step 2 — Read the existing code
Read the target module and its neighboring specs: naming style, fixtures, mocks, tolerances. Say where the new
test will go.

## Step 3 — RED
Write **only** the test. Name it `it('describes the behavior', …)`. Float assertions use `toBeCloseTo`.
Mock the filesystem and the WASM reader at their boundary. Run `npx vitest run <file>` and show the failure.
If it passes without implementation changes, stop and ask: the behavior may already exist or the test is wrong.
Confirm "Test is red. Ready to implement?"

## Step 4 — GREEN
Write the minimum code that passes. Run the suite; everything must pass, then run `npm run typecheck`.
Fix regressions before continuing. Confirm "All green."

## Notes
- Full validation: the `test` skill (`/test`). Tests are `test/*.spec.js`.
