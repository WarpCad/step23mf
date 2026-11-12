# core-003 — Assembly hierarchy and repeated instances

> **Outcome note.** Shipped as specified, encoding A, with three small choices the spec left open. Group children are tagged
> refs (`{ part: i }` or `{ group: i }`) rather than bare numbers, so a part index can never be read as a group index. A
> multi-part node with no name is called `Assembly N`, since the spec gave no fallback. No `--flat` flag was added: the spec
> offered it as an option, not a requirement, and B is still one change away if the slicer rows say grouping is lost. Writer
> output for single parts and flat files is byte-identical to M1. `ASSEMBLY` now writes 4 groups and 1 build item.

**Milestone:** M2 Full fidelity · **Depends on:** cli-001, 3mf-002 (decision gate) · **Status:** done (encoding A,
decided 2026-11-09)

## Goal

An assembly keeps its structure, so a user can tell the two `L_BRACKET_ASSEMBLY_ASM` instances apart and see which
parts belong to which sub-assembly.

## What the reader allows (checked 2026-11-08, occt-import-js 0.0.23)

- **Transforms are already applied.** Every mesh arrives in world coordinates, and the node tree carries no
  matrices. There are no transforms to keep.
- **Instances are already duplicated.** Both `L_BRACKET_ASSEMBLY_ASM` instances arrive as 7 separate meshes
  each. Sharing one mesh between instances would mean detecting rigidly equal meshes, which is out of scope for
  this task. If it turns out to matter for file size, file it against `docs/decisions/step-reader.md`
  (`opencascade.js` exposes instancing).
- **Some nesting is lost.** The sub-parts inside `L_BRACKET_ASSEMBLY_ASM` are not child nodes. They are 7 meshes
  on one node, all named `SOLID`.

## Open question (decide before starting; 3mf-002 writes its recommendation here)

- **A. Group with 3MF components (proposed default).** Each assembly node becomes an `<object type="model"
  name="<node>">` with a `<components>` element referencing its parts' mesh objects. Each top-level node becomes
  a build item. Slicers then treat an assembly as one multi-part object, which keeps the relative positions
  needed for a multi-material print.
- **B. Stay flat (M1 behavior).** One build item per part. Every consumer lists the parts, but grouping is lost
  and a slicer may lay them out separately.
- Either can be the default with the other behind a flag (`--flat` or `--group`). The flag would need its own
  usage text.

**Decided 2026-11-09: A** (chosen by the user at the 3mf-002 decision gate, on the provisional recommendation below.
Slicer rows in `docs/compatibility.md` are still open, so whether slicers keep the grouping is accepted, not measured.)

**3mf-002 recommendation (provisional, 2026-11-09): A.** The `components` probe shows WarpCad reading each bracket's
seven sub-parts with their own names, so the component data is intact on the consumer side. But WarpCad flattens the
hierarchy and shows no group node, so this gives no evidence that a slicer keeps the grouping. That needs the
PrusaSlicer, Bambu Studio and OrcaSlicer rows in [`docs/compatibility.md`](../docs/compatibility.md), which are not
filled in yet. Until they are, A is the default only because it matches the spec. **The user still chooses.**

## Spec (written for A; rewrite if B is chosen)

- Extend `Scene` with `groups: { name, children: (partIndex | groupIndex)[] }[]` and `roots`. `buildScene` creates
  a group for each node that has two or more part descendants. A node with a single part descendant doesn't
  become a group; its name goes to that part, as in core-001.
- The unnamed root (`""`) never becomes a group. If it has a single child, that child is the top level.
- In `write3mf`, mesh objects come first, then component objects in post-order (a 3MF object may only reference
  ids defined before it). Components have no transform. Build items reference root groups and any ungrouped
  parts.
- **Naming change:** with groups available, part names no longer need the ` (k)` suffix to stay unique within a
  group. Keep the suffix anyway, because consumers that flatten components still need distinct names.
- Deep nesting (5+ levels), a group whose children are all skipped (empty: drop it), and a single-part file (no
  group at all, so output is identical to M1).

## Testing

- `test/scene.spec.js`: group creation rules, root collapsing, and the empty-group drop, on hand-built trees.
- `test/threemf.spec.js`: id ordering (every referenced id is defined earlier), build items, and component
  names escaped.
- `test/scene.fixture.spec.js`: `ASSEMBLY` gives root `AS1_PE_ASM` with children `PLATE`,
  `L_BRACKET_ASSEMBLY_ASM` ×2 (7 parts each) and `ROD_ASM` (3 parts). The total triangle count equals the
  reader's.

## Docs

`docs/usage.md` gets an "Assemblies" section. `docs/limitations.md` explains that instances are written as copies.

## Acceptance

Scenario **2** in each consumer from 3mf-002, plus 1 as a regression check (single parts unchanged).
