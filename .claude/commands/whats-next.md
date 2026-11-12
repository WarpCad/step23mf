# What's Next — where the TODO list stands

Read-only briefing. Report; don't fix. Questions go through `AskUserQuestion`.

**Principle: the files win over the summaries.** Where `ROADMAP.md` and the TODO files disagree, the TODO file's
own text is right, and the disagreement is a finding.

1. **Read cold:** `CLAUDE.md`, `TODO/ROADMAP.md`, every `TODO/*.md`, `TODO/done/` (names only), `TODO/BUDGET.md`,
   `TODO/VERIFY.md`, and `git log --oneline -15`.
2. **Inventory:** each open task with its status, dependencies, and whether its spec is concrete (named test,
   named fixture, exact CLI text and 3MF content).
3. **Consistency (report only):** a ROADMAP row without a file, a file without a row, a done task still on the
   roadmap, a TODO whose dependency is itself unfinished, a task with no Testing or Acceptance section.
4. **Questions that need the user:** decisions a task is blocked on (flag names, default behavior, dependency
   choices, license-sensitive additions).
5. **Briefing (plain output):** Where things stand · Ready to run, in order · Blocked · Not yet scoped ·
   Consistency problems · Questions that need you.
6. **Ask for the decision:** options such as **Run the next task** (Recommended), **Answer the open questions**,
   **Explain more**, **Pause**. Act on the answer: `/fix-todo <id>`, or edit the blocked TODO files with the
   user's decisions. Don't start work the user didn't pick.
