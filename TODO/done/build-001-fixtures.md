# build-001 — Test fixtures and a 3MF read-back helper

**Milestone:** M1 First conversion · **Depends on:** nothing · **Status:** done

## Goal

Every later task needs real STEP inputs with known names, colors and units, and a way to read a produced 3MF
back in a spec. Build both first so no task invents its own.

## Spec

### Fixtures

Default taken: **use the STEP files that ship inside `occt-import-js` in place; copy none of them.** They live
under `node_modules/occt-import-js/test/testfiles/`, are pinned by `package-lock.json`, and their licensing
(GrabCAD terms for some, the LGPL repo for others) stays theirs because nothing is copied into this MIT repo.

`test/fixtures/index.js` exports absolute paths, one constant per fixture:

| Constant | Source | What it proves | Known facts (checked 2026-11-08 with occt-import-js 0.0.23) |
|---|---|---|---|
| `CUBE_MM` | `cube-units/cube-mm.step` | single colored part, mm | 1 mesh, node `Cube`, linear color `0.6038…` = sRGB `#CCCCCC`, 1000 mm cube |
| `CUBE_IN` | `cube-units/cube-in.step` | inch → mm | same cube authored in inches; max coordinate ≈ 1000 mm |
| `CUBE_M` | `cube-units/cube-m.step` | metre → mm | max coordinate 1000 mm |
| `CUBE_FACES` | `cube-fcstd/cube.step` | per-face colors, some null | 6 faces: red, null, null, blue, null, `0,0.402,0` (= `#00AA00`) |
| `CUBE_FACES_ALL` | `cube-fcstd/cube2.step` | 6 distinct face colors | every face colored |
| `ROUNDED` | `rounded-cube/rounded-cube.step` | curved faces, welding | 98 vertices, 44 unique |
| `ASSEMBLY` | `cax-if/as1_pe_203.stp` | named assembly, repeated sub-assembly | 18 meshes; nodes `AS1_PE_ASM` › `PLATE`, `L_BRACKET_ASSEMBLY_ASM` ×2, `ROD_ASM`; every mesh is named `SOLID` |

Self-authored fixtures in `test/fixtures/` (small, MIT, checked in):

- `not-step.step`: the text `hello`.
- `empty.step`: zero bytes.
- Truncated and unnamed inputs are **derived in memory at test time**, never stored. `truncate(path, n)` returns
  the first `n` bytes (4000 bytes of `CUBE_FACES` fails with "unexpected end of file"). `blankNames(path)` blanks
  every `PRODUCT(...)` name and shape name. Both live in `test/fixtures/index.js`.

`test/fixtures/README.md` records each fixture's source, purpose and the facts above.

A fixture spec (`test/fixtures.spec.js`) fails if any path in `index.js` doesn't exist. That catches an
`occt-import-js` upgrade that moves its test files.

### 3MF read-back helper

`test/helpers/read3mf.js`, test-only:
`read3mf(bytes) → { entries: string[], contentTypes: string, rels: string, unit, metadata: Record<string,string>,
materials: { id, bases: { name, displaycolor }[] }[], objects: { id, name, type, pid?, pindex?,
vertices: number[][], triangles: { v: number[], pid?, p1? }[], components?: { objectid, transform? }[] }[],
build: { objectid, transform? }[] }`.

- Uses `fflate`'s `unzipSync` (already a dependency) and a small attribute-regex XML reader. **No new
  dependency.**
- Plus `meshStats(object) → { triangles, openEdges, signedVolume }`. `openEdges` counts undirected edges used by
  anything other than exactly two triangles, and `signedVolume` uses the divergence theorem. core-001 and
  3mf-001 use these to assert watertightness and outward winding.

### Acceptance file

Add a fixture column to `TODO/ACCEPTANCE.md` that maps each scenario to the constants above. Change "Fixtures
live in `test/fixtures/`" to point at `test/fixtures/README.md`.

## Testing

- `test/fixtures.spec.js`: every exported path exists. `truncate` returns `n` bytes. `blankNames` output contains
  no non-empty `PRODUCT('` name.
- `test/helpers/read3mf.spec.js`: round-trips a hand-built minimal 3MF made with `zipSync` in the spec, covering
  one object, one `basematerials`, one per-triangle `p1` and one components object. `meshStats` on a hand-built
  tetrahedron gives `openEdges 0` and `signedVolume` `toBeCloseTo(1/6)`. On a tetrahedron with one face removed
  it gives `openEdges 3`. With all faces flipped it gives a negative volume. With zero triangles it gives 0.

## Docs

`test/fixtures/README.md` only. Nothing user-facing.

## Acceptance

None re-driven: there is no CLI yet. This task makes scenarios 1–7 runnable.
