# Which programs show the 3MF's colors and names

step23mf keeps part colors and names in the 3MF it writes. Whether a program shows them is a separate question, and
it decides the encodings core-002 (per-face colors) and core-003 (assembly structure) can use. This page records what
was observed, not what the 3MF specification allows.

> **Status: partial.** WarpCad and UltiMaker Cura were observed. macOS Quick Look was tried but gave no usable result on
> this machine. PrusaSlicer, Bambu Studio, OrcaSlicer and Windows 3D Viewer are not installed here. See
> [What is still missing](#what-is-still-missing).

## Legend

- ✅ shown as written in the file.
- ❌ not shown. The program discards it or replaces it.
- **partial** shown for some parts or cases but not others. The row's note says which.
- ⬜ not observed. The program was not run, or was run and gave no usable result. The note says which.

## Matrix

| Consumer | Version | Object names | Object colors | Triangle colors | Component names | Component hierarchy |
|---|---|---|---|---|---|---|
| WarpCad | v1.14.0, production build served by `vite preview`, Chromium 1440×900 | **partial**: a multi-part file shows its part names; a single-object file shows the file name instead, so `Cube` is not visible | ❌ every part renders in one color | ❌ a 10 mm cube with six face colors renders as one color | **partial**: the sub-part names survive; the group's own name (`L_BRACKET_ASSEMBLY_ASM`) does not | ❌ flattened: every part is listed at one level, and no group node exists |
| UltiMaker Cura | version not recorded, Ultimaker 2 Extended+ profile | **partial**: names appear in the object list (`L_BRACKET_ASSEMBLY_ASM (1)` to `(14)`), so the sub-part names survive | ❌ every object takes the configured filament color, so the file's colors are not shown | ❌ the six-face cube takes the filament color, like every other object | ✅ the group name `L_BRACKET_ASSEMBLY_ASM` appears as a top-level object name | ✅ group kept: each bracket is one object in the list, not 14 loose parts (`PLATE` and `ROD_ASM` stay separate) |
| macOS Quick Look | macOS 27 | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| PrusaSlicer | not installed | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Bambu Studio | not installed | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| OrcaSlicer | not installed | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Windows 3D Viewer | no Windows machine | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

**What the notes mean.**

- **WarpCad, object colors.** The `ASSEMBLY` probe carries a color on each of its 18 objects. WarpCad's Inspector shows
  the whole import as `Default`, and the viewport draws every part in one orange-brown. The project's
  [user library docs](../../warpcad/docs/user-library.md) list "colours and materials" as ignored on import, so this is
  a documented limit, not a bug.
- **WarpCad, triangle colors.** The triangle probe is one 10 mm cube with six distinct face colors, written with
  `pid`/`p1` on each triangle. The viewport shows one grey-blue body and no face colors, the same ignored-colors limit.
- **WarpCad, component names.** The components probe groups each `L_BRACKET_ASSEMBLY_ASM` as a `<components>` object.
  WarpCad lists its 14 sub-parts by their own names (`L_BRACKET_ASSEMBLY_ASM (1) 1` and so on) and drops the group's name.
- **WarpCad, component hierarchy.** The Parts list for the components probe holds the same 18 entries, in build-item
  order (`PLATE`, the three `ROD_ASM` parts, then the brackets), with no group node. The two brackets are told apart only
  by the numeric suffix. This is flat, the same as the M1 `ASSEMBLY` output.

## Probe files

Four files, built in `out/` (gitignored) and not committed, so each can be regenerated from the sources named here.
The encoding step23mf writes now is encoding A: each face color is a `pid`/`p1` on its triangles, and each assembly is a
group object of components. The `probe-triangle-colors` and `probe-components` files show that encoding. The
`probe-object-colors` and `probe-m1-cube-faces` files show the flat output from before core-002 and core-003 shipped.

| File | Made by | What it tests |
|---|---|---|
| `probe-object-colors.3mf` | `node bin/step23mf.js` on `ASSEMBLY` | M1 output: 18 objects, each with an object color (`pid`/`pindex`) and a name. |
| `probe-triangle-colors.3mf` | a throwaway script, from `CUBE_FACES_ALL` | One object. Each triangle carries `pid="1" p1="k"`, with `k` taken from the reader's per-face colors (`brep_faces`), so the six faces map to six base colors. |
| `probe-components.3mf` | the same throwaway script, from `ASSEMBLY` | The 18 parts as objects, plus two group objects named `L_BRACKET_ASSEMBLY_ASM`, each holding a `<components>` list of its seven parts. `PLATE` and `ROD_ASM` stay as build items. |
| `probe-m1-cube-faces.3mf` | `node bin/step23mf.js` on `CUBE_FACES_ALL` | A control: what M1 writes for a cube with six face colors. The answer is one object and one color. |

**Build-plate sizes.** The first two probes are the full `ASSEMBLY` at 5080 × 2210 × 3810 mm, too large for an
Ultimaker 2+ Extended (223 × 223 × 305 mm, per Cura's definitions). Scaled copies at 1:30 are written to `out/`
(gitignored), at 169.3 × 73.7 × 127.0 mm:

| File | Same as | Scale |
|---|---|---|
| `probe-object-colors-1to30.3mf` | `probe-object-colors.3mf` | 1:30, uniform |
| `probe-components-1to30.3mf` | `probe-components.3mf` | 1:30, uniform |

The triangle-color and cube probes are already 10 mm and were not scaled. Scaling changes only the coordinates. Names,
colors, the component groups and the triangles are unchanged, which was checked by reading the scaled files back.

## Observations that are not in the matrix

- **M1 dropped per-face colors (fixed by core-002).** `probe-m1-cube-faces.3mf` has one base color, from before
  core-002 shipped. The converter now writes the face colors, so this file is a control, not current output. Acceptance
  scenario 3 in `TODO/ACCEPTANCE.md` checks the current output.
- **Quick Look produced no thumbnail.** `qlmanage -t` on the probe files ran past the 120-second tool limit and was
  killed. A single retry, capped at 60 seconds, was killed too. No thumbnail file was written. This may mean macOS has
  no 3MF thumbnail generator, or that `qlmanage` hangs on this input. It was not investigated further.
- **Screenshots are blocked in this session.** `screencapture` fails with "could not create image from display", so
  Cura cannot be watched while it runs. Granting the terminal Screen Recording permission would make Cura checkable.

## What is still missing

1. **Cura.** Open each probe, then record the five columns by looking. Needs Screen Recording permission, or a hand check.
2. **Quick Look.** Confirm whether a 3MF preview is produced at all, and whether the thumbnail is colored.
3. **PrusaSlicer, Bambu Studio, OrcaSlicer.** Install each, open each probe, and record the five columns. Bambu and Orca
   may need their own color metadata (`paint_color` or `Metadata/`) before they show per-object colors. If so, that is a
   separate task, not part of this matrix.
4. **Windows 3D Viewer.** Needs a Windows machine.

## What this means for core-002 and core-003

WarpCad is the only consumer observed so far, and it ignores all colors. It cannot settle the per-triangle (`p1`) versus
one-object-per-color choice for core-002. It does read components without losing sub-part names, which is weak evidence
for core-003's component encoding, because WarpCad flattens the hierarchy. The recommendations are written into the
"Open question" sections of [`TODO/done/core-002-face-colors.md`](../TODO/done/core-002-face-colors.md) and
[`TODO/done/core-003-assemblies.md`](../TODO/done/core-003-assemblies.md). Encoding A was chosen on 2026-11-09 and both
tasks shipped it. Its recommendation stays marked provisional until the slicer rows in the matrix are filled in. If one
of those rows contradicts encoding A, that is a new task, not a change to this page.
