---
argument-hint: "[batch size]"
---

# Run the TODO Backlog (fixed batch, go/no-go)

Work the backlog one task at a time, pausing at a fixed batch size. Use with `/loop /run-todos` or by hand.
Questions go through `AskUserQuestion`. The batch size is a fixed task count (default **3**), set in
`TODO/BUDGET.md`; don't replace it with a token estimator.

## Standing authorization
Running this skill authorizes commits, not pushes. A scheduled or looped run may commit unattended. It must
still print each commit message and acceptance result, and it never pushes.

## Step 0 — Start cold
Read `CLAUDE.md`, `TODO/ROADMAP.md`, `TODO/BUDGET.md` (create it with the default batch and an empty
append-only Runner Log if absent) and `git status`. If the tree has uncommitted changes you didn't make, stop
and ask.

## Step 1 — Batch room
Count tasks done in the current batch from the Runner Log. If the batch is full, go to Step 6.

## Step 2 — Pick the next candidate
The first `ROADMAP.md` row whose dependencies are done and whose TODO file has a concrete Testing section. Skip
any task marked blocked or needing a user decision, and list it for Step 6.

## Step 3 — Milestone boundary
If the task finishes a milestone, the batch ends there so a human can run the CLI on real STEP files for five
free-form minutes (several real assemblies, odd colors, unnamed parts). Ask for that, then continue on a go.

## Step 4 — Run exactly one TODO
Spawn one foreground `Agent` (`subagent_type: "claude"`) briefed with the TODO id and the `/fix-todo` steps.
The agent can't ask the user: it returns questions, and you ask and continue it with `SendMessage`. After it
reports, verify its claim yourself: run `/test` fresh (don't trust "green"), check `git log -1 --stat`, and
spot-check one acceptance scenario by running the CLI. A mismatch means the task isn't done.

## Step 5 — Log the tick
Append to `TODO/BUDGET.md`'s Runner Log: UTC timestamp, task id, result (done / blocked / failed), test counts,
commit hash.

## Step 6 — Check in
Report: tasks done this batch, what's next, blockers. Ask: **Go** (another batch, Recommended), **Change batch
size**, **Explain more**, **Pause**. Under `/loop`, stop at a full batch until the user answers.
