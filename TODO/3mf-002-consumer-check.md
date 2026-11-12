# 3mf-002 — Check names and colors in real 3MF consumers

**Milestone:** M2 Full fidelity · **Depends on:** cli-001 · **Status:** closed as partial. WarpCad observed; Cura, Quick Look and the slicers still open (see `docs/compatibility.md` and `TODO/VERIFY.md` rows 1–5). Decisions recorded 2026-11-09: core-002 A, core-003 A.

**Decided 2026-11-09:** close as partial, so core-002 and core-003 can proceed. The outstanding consumer checks move to `TODO/VERIFY.md`. Nothing is committed, and no npm publish until everything works.

## Goal

"Colors kept" only counts if the programs people open 3MF in show them. Find out which consumers honor object
`basematerials`, per-triangle `p1` and `components` names **before** core-002 and core-003 choose an encoding.

## Spec

1. Generate probe files with the M1 CLI, plus two files hand-built in a throwaway script under `out/`:
   - **object colors**: `ASSEMBLY` as written by M1.
   - **triangle colors**: `CUBE_FACES_ALL` with each triangle given `pid`/`p1` by hand.
   - **components**: `ASSEMBLY` with the two `L_BRACKET_ASSEMBLY_ASM` groups written as named
     `<components>` objects.
2. Open each probe in every consumer available on this machine (check `/Applications`): PrusaSlicer, Bambu Studio,
   OrcaSlicer, Cura, macOS Preview/Quick Look, WarpCad (`../warpcad`, Import 3MF). Windows 3D Viewer is
   included if a Windows machine is available.
3. Record a matrix in `docs/compatibility.md`: consumer and version × {object names, object colors, triangle
   colors, component names, component hierarchy}, each ✅ / ❌ / partial, with a sentence on what "partial" means.
4. **Decision gate.** From the matrix, write the recommendation for core-002 (per-triangle `p1` vs. one object per
   color) and core-003 (components vs. flat) into those files' "Open question" sections. Then ask the user to
   choose. Don't implement either encoding here.

The probe script isn't committed. If a consumer needs vendor metadata to show colors (for example, Bambu/Orca
read their own `paint_color` or `Metadata/` config), note what it would need. Supporting vendor metadata is a
new task, not part of this one.

## Testing

No spec. This is a manual research task. Per CLAUDE.md, the screenshots or observations it gathers are the
evidence. Put one-off device or app quirks in `TODO/VERIFY.md`.

## Docs

`docs/compatibility.md` (new), linked from `README.md`.

## Acceptance

Scenarios 1–3 are re-driven in each consumer, which is the round-trip check CLAUDE.md asks for.
