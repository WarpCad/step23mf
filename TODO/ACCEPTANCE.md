# Acceptance scenarios

A small, fixed set of end-to-end runs the AI drives by hand with the real CLI, not a scripted spec.
Report PASS/FAIL for each. Fixtures and the facts each one carries are listed in `test/fixtures/README.md`;
the Fixtures column names constants from `test/fixtures/index.js`.

| # | Scenario | Fixtures |
|---|---|---|
| 1 | **Single colored part.** Convert one part with one color. Open the 3MF: one object, same name, same color. | `CUBE_MM` |
| 2 | **Named assembly.** Convert an assembly of 3+ named parts. Every part keeps its name and color. | `ASSEMBLY` |
| 3 | **Per-face colors.** Convert a part with faces of different colors. Colors survive. | `CUBE_FACES`, `CUBE_FACES_ALL` |
| 4 | **Bad input.** A missing file, a non-STEP file and a truncated STEP each exit non-zero with a clear message. | a path that doesn't exist, `NOT_STEP`, `EMPTY`, `truncate(CUBE_FACES, 4000)` written to a temp file |
| 5 | **Output path.** Default output sits next to the input; `-o` overrides; an existing output is not clobbered silently. | `CUBE_MM`, copied to a temp directory first |
| 6 | **Units.** The same cube authored in millimetres, metres and inches converts to the same size in millimetres, within a tolerance stated in the report. | `CUBE_MM`, `CUBE_M`, `CUBE_IN` |
| 7 | **Determinism.** Converting the same file twice gives byte-identical 3MF files (`cmp` them). | `ASSEMBLY` |

## Last run

Run by hand with the real CLI, then read back with `unzip -p … 3D/3dmodel.model`. Date 2026-11-09, during `/fix-todo 3mf-002`.

- **build-002 readiness (2026-11-12, installed tarball).** `npm pack`, then `npm i -g --prefix <scratch>`, then every
  scenario driven through the installed `step23mf` 0.1.0 on macOS, Node 24.22.2. **1 PASS:** one object `Cube`,
  `pid="1"`, `#CCCCCC`, `unit="millimeter"`. **2 PASS:** 18 part objects, each with a `pid`, no `SOLID` names, 4 base
  colors, groups `AS1_PE_ASM`, `L_BRACKET_ASSEMBLY_ASM` and `ROD_ASM`. **3 PASS:** `cube.step` has 4 bases and 6 `p1`
  triangles. `cube2.step` has 6 distinct `p1` values over 12 triangles. **4 PASS:** a missing file, `NOT_STEP`,
  `EMPTY` and a 4000-byte truncation each exit 1 with one line. An unknown option exits 2 with the usage text. No stack
  traces. **5 PASS:** the default output sits next to the input, a repeat run is refused, `-f` overwrites, `-o`
  redirects, and a missing folder fails with exit 1. **6 PASS:** mm, in and m all span 1000.000000 mm on each axis
  (tolerance 1e-6 mm). **7 PASS:** `ASSEMBLY` converted twice is identical under `cmp`.

- **docs-001 (2026-11-10 14:07 UTC, docs only).** Scenarios driven by following `docs/usage.md` literally, with the
  CLI installed globally from a packed tarball into a scratch prefix, in a fresh folder. **1 PASS:** `cube-mm.3mf` has
  one object, `Cube`, with `pid="1"` and one base color `#CCCCCC`. **2 PASS:** `as1_pe_203.stp` gives 18 part objects,
  each with a name and a color, and 4 group objects. **3 PASS:** `cube.step` gives 6 triangles with `p1` and 4 base
  colors. **4 PASS:** a missing file, a non-STEP file and a truncated STEP each exit 1 with one clear line. **5 PASS:**
  the default output sits next to the input, a second run without `-f` is refused, `-f` overwrites, and a missing output
  folder fails. The registry install line in `README.md` was not tried, since the package is unpublished (build-002).
- **core-003 re-drive (2026-11-09, assembly groups).** `ASSEMBLY` now writes 4 group objects (the top `AS1_PE_ASM` with 4 children, two `L_BRACKET_ASSEMBLY_ASM` of 7, one `ROD_ASM` of 3) and 1 build item. Scenario **2 PASS**: all 18 part names present as mesh objects, no `SOLID`, and the 4 base colors and `PLATE`'s `#00FF00` are unchanged from before. Scenario **1 PASS** and **3 PASS**: `CUBE_MM` and `CUBE_FACES` output is byte-identical to the pre-change file. Scenario **7 PASS**: `ASSEMBLY` converted twice gives identical bytes. Scenario **4**: only the missing-file case was re-driven (exit 1, one line); the reader is unchanged. Scenario **5** and **6** not touched by this change. The 3mf-002 consumer rows (Cura, slicers) are still open in `VERIFY.md`.

- **1 PASS.** `CUBE_MM` gives one object, `Cube`, with `pid="1"`, and one base color `#CCCCCC`.
- **2 PASS.** `ASSEMBLY` gives 18 objects with their names (`PLATE`, `L_BRACKET_ASSEMBLY_ASM (1)`…) and 4 base colors.
- **3 PASS (after core-002, 2026-11-10).** `CUBE_FACES` gives one object, `#CCCCCC`, with four base colors
  (`#CCCCCC`, `#FF0000`, `#0000FF`, `#00AA00`). Six triangles carry `p1`, two per colored face. The six null-face
  triangles take the object color with no `p1`. `CUBE_FACES_ALL` gives six distinct face colors on all 12 triangles.
- **7 PASS.** `ASSEMBLY` converted twice gives byte-identical output (`cmp`). Re-driven 2026-11-10 after core-002.
- **core-002 re-drive (2026-11-10):** 1 PASS and 2 PASS. 4 only partly: a missing file exits 1 with one line; the non-STEP
  and truncated cases were not re-driven, and the code path is unchanged. `CUBE_IN` and `CUBE_M`
  both span 0 to 1000 mm, within float rounding, for 6 PASS. `CUBE_MM` has no `p1` and one base. `ASSEMBLY` has no
  `p1` and 4 bases, as before. These are checked against the output's own content, not diffed against a saved pre-change
  file. No pre-change copy was kept, so the byte-identity claim is not re-measured.
- **After cli-002 (2026-11-09):** 1 PASS and 7 PASS re-driven. Default output for `CUBE_MM` and `ASSEMBLY` is
  byte-identical to the pre-change files.
- **Consumer re-drive (WarpCad, headless Chromium).** Scenario 2's `ASSEMBLY` probe imported: all 18 part names
  shown, colors not shown (WarpCad ignores colors on import). Scenarios 1 and 3 not yet re-driven in WarpCad. Other
  consumers: see [`docs/compatibility.md`](../docs/compatibility.md).
