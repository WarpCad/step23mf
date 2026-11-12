# Roadmap (open work)

Run one with `/fix-todo <id>`, or the backlog with `/loop /run-todos`. Each task's file is the source of truth;
this table is the index.

| Order | Id | Milestone | Depends on | Task |
|---|---|---|---|---|
| 6 | 3mf-002 | M2 | cli-001 | Check names and colors in real consumers. Closed as partial 2026-11-09; slicer and Cura checks in `VERIFY.md` |
| 11 | build-002 | M3 ⏸ | docs-001 | Publish to npm (**needs user:** name, repo, account; health check first; last step, after everything works) |

⏸ marks a milestone's last task. `/run-todos` pauses after it for a five-minute free-form hand-test on real STEP
files.

**Milestones.** M1 First conversion: single parts and flat assemblies with names and per-part colors. M2 Full
fidelity: per-face colors, assembly grouping, checked in real consumers. M3 Release: quality flags, docs, npm.
