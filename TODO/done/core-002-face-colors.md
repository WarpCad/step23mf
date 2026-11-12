# core-002 — Per-face colors

**Milestone:** M2 Full fidelity · **Depends on:** cli-001, 3mf-002 (decision gate) · **Status:** done, uncommitted
(encoding A, decided 2026-11-09)

> **Shipped (2026-11-10).** Encoding A, as specified. `buildScene` maps each B-rep face range onto the pre-weld
> triangles, the weld carries each surviving triangle's original index, and `Part.faceColors` is set only when a
> triangle differs from `Part.color`. `write3mf` writes `pid="1" p1="k"` on those triangles and adds face colors to the
> basematerials group in first-use order. Two choices the spec left open: the clamp warning reads
> `face F-L of "NAME" is outside its N triangles; clamped to A-B` (or `...; ignored` when nothing is left), and a
> coverage tie compares first appearance in triangle order. Unit tests: 156 pass. Slicer rows in `docs/compatibility.md`
> are still open under 3mf-002, so which consumers show per-face colors is not measured.

## Goal

A STEP part whose faces have different colors keeps those colors in the 3MF.

## Open question (decide before starting; 3mf-002 writes its recommendation here)

- **A. Per-triangle properties (proposed default).** One object per part. Triangles whose color differs from the
  object's get `pid="1" p1="<k>"`. This is the 3MF core way of doing it, keeps one object per STEP part, and
  produces the smallest output. Some slicers may ignore it.
- **B. Split by color.** One object per (part, color), named `<part> [#RRGGBB]`. Every consumer shows it, but one
  part becomes several objects with open edges where the colors meet.
- A could be the default with B behind `--split-colors`. That would add a flag and its usage text.

**Decided 2026-11-09: A** (chosen by the user at the 3mf-002 decision gate, on the provisional recommendation below.
Slicer rows in `docs/compatibility.md` are still open, so the risk below is accepted, not measured.)

**3mf-002 recommendation (provisional, 2026-11-09): A.** WarpCad, the only consumer observed so far, ignores every
color, so it says nothing about A versus B. A stays the default because it is the 3MF core encoding and keeps one
object per part. The open risk is the one written above: a slicer that ignores `p1` would show A as one color. Before
deciding, read the PrusaSlicer, Bambu Studio and OrcaSlicer rows in [`docs/compatibility.md`](../docs/compatibility.md),
which are not filled in yet. If a slicer ignores `p1`, B becomes the default. **The user still chooses.**

## Spec (written for A; rewrite if B is chosen)

In core-001's `buildScene`, fill `Part.faceColors`:

- `brep_faces[i]` covers triangles `first`…`last` **inclusive**, as triangle indices into the mesh before welding.
  The weld and degenerate-drop steps must carry the face color along with each surviving triangle.
- A face's color resolves in this order: its own `color`, then the mesh `color`, then `#808080`. The `#808080`
  fallback applies only when at least one face of the part has a color. A part with no face colors and no mesh
  color stays uncolored (`color: null`, `faceColors: null`), as in M1.
- `Part.color` (the object default) is the mesh color if present. Otherwise it is the resolved color that
  covers the most triangles, with ties going to the earliest face.
- If every triangle resolves to `Part.color`, `faceColors` stays `null` and the output is unchanged from M1.

In `write3mf`, a triangle gets `pid="1" p1="<k>"` only when its color differs from the object's `pindex`. The colors
used by faces go into the same `basematerials` group, deduplicated, in first-use order.

Degenerate cases: a face range outside the triangle count (clamp it and warn), an empty face (`first > last`),
every face null with no mesh color (uncolored, see above), and one face covering the whole mesh.

## Testing

- `test/scene.spec.js`: range mapping across the weld, the resolution chain, the default-color choice and its
  tie-break, and the all-same case giving `null`.
- `test/threemf.spec.js`: `p1` is written only where the color differs, and the materials are deduplicated.
- `test/scene.fixture.spec.js`: `CUBE_FACES` gives an object default of `#CCCCCC` (the mesh color), with faces
  `#FF0000`, `#0000FF` and `#00AA00` on 2 triangles each and the 6 null-face triangles following the default.
  `CUBE_FACES_ALL` has 6 distinct colors and 12 triangles.

## Docs

`docs/usage.md` (docs-001) gets a "Per-face colors" section. `docs/compatibility.md` notes which consumers show it.

## Acceptance

Scenario **3**, plus 1 and 2 as a regression check (single-color parts must still produce byte-identical
output to before this task).
