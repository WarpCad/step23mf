# Test fixtures

Every spec and acceptance run takes its STEP inputs from here, so no task invents its own. Import the paths
from `index.js`; don't hard-code them.

## STEP files used in place

These ship inside `occt-import-js` under `node_modules/occt-import-js/test/testfiles/`. They are **not copied**
into this MIT repository: `package-lock.json` pins them, and their licensing stays with their authors (the
`occt-import-js` repository, LGPL-2.1; the `cax-if/` files come from the CAx-IF STEP library,
<https://www.cax-if.org/cax/cax_stepLib.php>, per that folder's `source.txt`). `fixtures.spec.js` fails if an
upgrade moves any of them.

Facts below were checked on 2026-11-08 with occt-import-js 0.0.23 (`ReadStepFile(bytes, null)`, default
tessellation). Colors are the linear values OCCT reports; sRGB is the converted value.

| Constant | Source (under `testfiles/`) | What it proves | Known facts |
|---|---|---|---|
| `CUBE_MM` | `cube-units/cube-mm.step` | single colored part, mm | 1 mesh; node and mesh named `Cube`; color linear `0.6038…` (all channels) = sRGB `#CCCCCC`; no face colors; 1000 mm cube, max coordinate 1000 |
| `CUBE_IN` | `cube-units/cube-in.step` | inch → mm | same cube authored in inches; max coordinate 1000 mm |
| `CUBE_M` | `cube-units/cube-m.step` | metre → mm | same cube authored in metres; max coordinate 1000 mm |
| `CUBE_FACES` | `cube-fcstd/cube.step` | per-face colors, some null | 1 mesh `Cube`, 10 mm; 6 face colors: `1,0,0` (red), null, null, `0,0,1` (blue), null, `0,0.402,0` (= sRGB `#00AA00`) |
| `CUBE_FACES_ALL` | `cube-fcstd/cube2.step` | 6 distinct face colors | 1 mesh `Cube`, 10 mm; every face colored, all six different |
| `ROUNDED` | `rounded-cube/rounded-cube.step` | curved faces, welding | 1 mesh `Body`; 98 vertices, 44 unique positions, 84 triangles |
| `ASSEMBLY` | `cax-if/as1_pe_203.stp` | named assembly, repeated sub-assembly | 18 meshes; tree `AS1_PE_ASM` › `PLATE`, `L_BRACKET_ASSEMBLY_ASM` (7 meshes) ×2, `ROD_ASM` (3 meshes); every mesh is named `SOLID`; max coordinate 3810 |

**OCCT invents `SOLID`.** The string `'SOLID'` appears nowhere in `as1_pe_203.stp`: OCCT names an unnamed solid
after its shape type. A non-empty mesh name from the reader is therefore not proof that anyone authored it, and
the real part names in this file sit on the assembly nodes.

## Self-authored fixtures (MIT, checked in)

| Constant | File | Contents |
|---|---|---|
| `NOT_STEP` | `not-step.step` | the text `hello` |
| `EMPTY` | `empty.step` | zero bytes |

## Inputs derived at test time

Never stored; built in memory by `index.js`. Both return `Uint8Array`.

- `truncate(path, n)` returns the first `n` bytes. `truncate(CUBE_FACES, 4000)` fails to parse ("unexpected end
  of file").
- `blankNames(path)` blanks the id and name of every `PRODUCT(...)` and `NEXT_ASSEMBLY_USAGE_OCCURRENCE(...)`, and
  the name of every shape entity (`MANIFOLD_SOLID_BREP`, `*SHAPE_REPRESENTATION` and similar). Every other byte is
  unchanged. `blankNames(ASSEMBLY)` still parses into 18 meshes, and OCCT reads every node name as empty.

An acceptance run drives the real CLI, which reads files, so write a derived input to a temp file first:

```sh
node --input-type=module -e "
import { writeFileSync } from 'node:fs';
import { CUBE_FACES, truncate } from './test/fixtures/index.js';
writeFileSync('/tmp/truncated.step', truncate(CUBE_FACES, 4000));"
```

## 3MF read-back

`test/helpers/read3mf.js` (test-only) unzips a produced 3MF and returns its parts, materials, objects and
build items. `meshStats(object)` gives `{ triangles, openEdges, signedVolume }` for asserting a mesh is closed
(`openEdges` 0) and wound outward (`signedVolume` > 0).
