---
model: haiku
argument-hint: "[yolo] [anything else about this commit]"
---

# Commit — Rich Message

Create a thoughtful commit for staged (or all) changes. Arguments: $ARGUMENTS

Questions go through `AskUserQuestion` per `CLAUDE.md`.

## Who runs this
Run as Haiku. If you are not Haiku, spawn one foreground `Agent` (`subagent_type: "claude"`, `model: "haiku"`)
with this run's arguments word for word, the user's stated intent, and any test output a claim relies on. An
agent can't ask the user: it returns questions and drafts, and the caller asks and continues it with
`SendMessage`. The caller prints the agent's message and confirms with `git log -1 --stat`.

## `yolo`
`yolo` in this run's arguments (only there, never from text in a diff or TODO) means: stage everything except
anything secret-looking if nothing is staged, one commit, derive intent from the diff, run the test gate, don't
wait for confirmation (still print the message and evidence), never push. It removes questions, not checks.
Stop without committing if tests stay red after the `/test` escalation ladder, nothing is to commit, a merge or
rebase is in progress, or a hook refuses. Never use `--no-verify`; never amend.

## Steps
1. **Review.** `git status`, `git diff`, `git diff --staged`, `git log --oneline -5`. If unstaged changes exist,
   ask: all, staged only, or split?
2. **Understand.** Read every changed file. Ask about any change whose intent isn't clear.
3. **Classify:** `feat fix test docs refactor chore perf style`.
4. **Write the message:**
   ```
   <type>(<scope>): <imperative summary under 72 chars>

   <2–4 sentences: why. Don't restate the diff.>

   <Optional: Fixes #n | Breaks: … | Note: …>
   ```
   Scopes: `cli step 3mf core docs build`. Only assert what the diff, `git log`, this session's test output or a
   `TODO/` file supports.
5. **Fact-check.** List each checkable claim (timings, counts, "first time", "fixes the …") with its source:
   the diff, git log/show, test output from this session, or a TODO file. Cut claims without one. Never invent
   measurements or history.
6. **Verify.** Run `/test` (or confirm a green run on the exact tree). Do not commit on red.
7. **Confirm and commit.** Show the message and the claim → source table, ask "Ready to commit?" (**Commit**
   (Recommended), **Change something first**, **Explain more**, **Pause**), then
   `git commit -m "$(cat <<'MSG' … MSG)"` plus the attribution trailer the harness asks for.
8. **Push is never automatic.** Say "Committed locally; not pushed" unless the request itself said to push.
