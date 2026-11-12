# Update Documentation

Review recent changes and bring the docs in line with the current behavior.
Questions go through `AskUserQuestion`.

1. **Identify what changed.** `git log --oneline -20`, `git diff HEAD~5..HEAD --name-only`. List new, changed
   and removed options, behaviors and output details. Ask whether anything undocumented by git needs covering.
2. **README.md.** Update usage, options and the supported/unsupported list. Keep it scannable. Every example
   command must actually run; run it.
3. **`docs/`.** Write for the user: exact commands, sample input, what the 3MF contains afterwards, with a
   concrete step-by-step example. Say which units and color conventions apply. Document limits honestly
   (unsupported STEP entities, color-less parts, huge assemblies).
4. **`docs/decisions/`.** If a library choice changed, update its record including the rejection table.
5. **`CLAUDE.md`.** Update when commands, structure, conventions or the Stack table changed. It is the source
   of truth every other skill reads, so a stale entry spreads into every session.
6. **Summary.** List every file changed and why, then ask whether the docs look accurate and complete.
