# core-001 — Build the scene: names, sRGB colors, welded meshes

**Milestone:** M1 First conversion · **Depends on:** step-001 · **Status:** done

## Goal

Turn the raw reader result into the format-neutral scene the 3MF writer consumes. Every rule about names and
colors lives here, as pure functions.

## Spec

`src/scene.js`: `buildScene(result: OcctResult) → { scene: Scene, warnings: string[] }`.

```
Scene = { parts: Part[] }
Part  = { name: string, color: string | null,          // '#RRGGBB', object default
          positions: Float64Array,                      // millimetres, welded, xyz triplets
          triangles: Uint32Array,                       // index triplets into positions
          faceColors: (string | null)[] | null }        // per-triangle, filled by core-002; null in M1
```

### Order

Depth-first over `root`. Within a node, its own `meshes` (in index order) come before its `children`. This
order is the output order, which keeps output deterministic.

### Names

1. A part's base name is the nearest non-empty node name, starting at the node that owns the mesh and walking up
   to the root.
2. If every node name on that path is empty, use the mesh's own `name`, unless it is empty or the STEP
   placeholder `SOLID`.
3. If still nothing: `Part N`, where N is the 1-based position in output order.
4. When one node owns more than one mesh, suffix ` (k)` with k = 1…n in mesh order. Example: `ASSEMBLY`
   gives `L_BRACKET_ASSEMBLY_ASM (1)` … `(7)`.
5. Otherwise, names are verbatim: no trimming, no case change, no sanitizing (the writer escapes XML). Two
   different nodes with the same name keep the same name. core-003 groups them so they can be told apart.

### Colors

`occt-import-js` returns **linear** RGB in 0–1. OCCT converts STEP's sRGB on read: `COLOUR_RGB(0.8,…)` comes back
as `0.6038…`. CLAUDE.md requires the source sRGB values, so convert back here:

- `linearToSrgb(c)`: `c <= 0.0031308 ? 12.92c : 1.055·c^(1/2.4) − 0.055`, then clamp to 0–1, scale by 255,
  round half up, and format as two uppercase hex digits.
- `Part.color` = the mesh `color` converted, or `null` if absent. M1 ignores `brep_faces` colors (core-002).

### Geometry

- **Weld** coincident vertices within a part by exact coordinate equality. occt emits each B-rep face's
  vertices separately: the cube has 24 vertices, 8 of them unique, so unwelded output has open edges in every
  slicer. Don't weld across parts.
- After welding, **drop degenerate triangles** (any two indices equal). 3MF forbids them.
- **No axis swap.** STEP and 3MF are both Z-up. Don't apply three.js's Y-up convention.
- Reject non-finite coordinates: drop the part with a warning.

### Warnings

Plain sentences, returned and never printed here:

- `skipped N part(s) with no triangles`
- `skipped "<name>": coordinates are not finite numbers`
- `"<name>" is not watertight (N open edges); a slicer may need to repair it`

## Testing

`test/scene.spec.js`, using hand-built `OcctResult` objects (no WASM):

- `linearToSrgb`: `0.6038273572921753` → `CC`, `0.4019778072834015` → `AA`, `0.21223075687885284` → `7F`.
  Also 0 → `00`, 1 → `FF`, the knee 0.0031308, and values just outside 0–1 clamp.
- Names: nearest ancestor; empty-path fallback to mesh name; `SOLID` ignored; `Part N` numbering; ` (k)`
  suffixes; verbatim `A & <B> "C"`; two nodes with the same name.
- Weld: a 24-vertex cube gives 8 vertices and 12 triangles. Welding never merges `0` with `-0`
  incorrectly (document the choice). A zero-area triangle is dropped. An empty mesh is skipped with a warning.
  NaN gives a warning.
- Huge coordinates (1e9 mm) survive unchanged.

`test/scene.fixture.spec.js` (real WASM): with `meshStats` from build-001, every part of `CUBE_MM`, `ROUNDED`
and `ASSEMBLY` has `openEdges === 0` and `signedVolume > 0` (outward winding). If a fixture still has open edges
after exact welding, **stop and record it**: switching to a tolerance weld is a decision for the user, not a
silent change.

`CUBE_MM` → 1 part `Cube`, `#CCCCCC`. `ASSEMBLY` names match rule 4, and `PLATE` is `#00FF00`.

## Docs

None user-facing yet (docs-001 covers naming and color rules). Add a `TROUBLESHOOTING.md` entry: "occt-import-js
colors are linear RGB."

## Acceptance

Scenarios 1, 2 and 6 once cli-001 lands.
