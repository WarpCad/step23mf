# Usage

Step-by-step examples for converting STEP files with `step23mf`. Each example gives the command, the exact line it
prints, and how to check the result. Every command here was run against the released code, and each output shown is
what it printed.

## Get the example files

The examples use STEP files that ship with `occt-import-js`, the STEP reader `step23mf` installs as a dependency. After
a global install:

```sh
npm i -g @warpcad/step23mf
EX="$(npm root -g)/@warpcad/step23mf/node_modules/occt-import-js/test/testfiles"
ls "$EX/cax-if/as1_pe_203.stp"
```

The last line prints the path of the example assembly. `as1_pe_203.stp` is also in the CAx-IF STEP library, at
<https://www.cax-if.org/cax/cax_stepLib.php>, if you would rather download it.

## Convert a file

```sh
step23mf "$EX/cax-if/as1_pe_203.stp" -o assembly.3mf
```

It prints:

```
wrote assembly.3mf (18 part(s), 4 color(s))
```

The output is a 3MF file, which is a zip archive. To check it, count its objects in the model file:

```sh
unzip -p assembly.3mf 3D/3dmodel.model | grep -c '<object '
```

The count is 22: the 18 parts, and 4 group objects that hold them (see [Assemblies](#assemblies)).

## Output path and `--force`

Without `-o`, the output goes next to the input, with its `.step` or `.stp` extension replaced by `.3mf`. Any other
name gets `.3mf` added. An existing output file is never overwritten silently:

```sh
cp "$EX/cube-units/cube-mm.step" .
step23mf cube-mm.step
```

```
wrote cube-mm.3mf (1 part(s), 1 color(s))
```

Run the same command again and the converter refuses, prints this line to stderr, and exits with code 1:

```sh
step23mf cube-mm.step; echo "exit $?"
```

```
step23mf: cube-mm.3mf already exists (use --force to overwrite)
exit 1
```

Pass `-f` (or `--force`) to overwrite it:

```sh
step23mf cube-mm.step -f
```

```
wrote cube-mm.3mf (1 part(s), 1 color(s))
```

`-o` picks any other name. The folder it names must already exist. A missing folder fails with
`cannot write out/cube.3mf: directory does not exist` and exit code 1.

### When a conversion fails

A user mistake prints one `step23mf:` line to stderr and exits with code 1. A bad flag exits with code 2 and prints the
help text after its message. Three input mistakes look like this:

```sh
step23mf nope.step; echo "exit $?"
```

```
step23mf: cannot read nope.step: no such file
exit 1
```

```sh
echo hello > not-step.step
step23mf not-step.step; echo "exit $?"
```

```
step23mf: not-step.step: not a STEP file (it should start with ISO-10303-21;)
exit 1
```

```sh
head -c 4000 "$EX/cube-fcstd/cube.step" > truncated.step
step23mf truncated.step; echo "exit $?"
```

```
step23mf: truncated.step: the STEP file is damaged or incomplete: Line 109: Incorrect syntax: unexpected end of file
exit 1
```

The line number in the last message is where the reader stopped, so it depends on how much of the file is there.

## Assemblies

A STEP assembly keeps its structure in the 3MF. Each assembly with two or more parts becomes one group object, and its
parts are listed inside it as components. The top-level assembly is the one build item, so a slicer treats it as one
multi-part object and keeps the parts' relative positions. A file with a single part, or a flat list of parts, comes out
with one build item per part.

### Example: the CAx-IF assembly

`as1_pe_203.stp` is an assembly named `AS1_PE_ASM`. It holds a plate, two `L_BRACKET_ASSEMBLY_ASM` sub-assemblies of seven
parts each, and a `ROD_ASM` of three parts. Convert it, then count the components and the build items:

```sh
step23mf "$EX/cax-if/as1_pe_203.stp" -o assembly.3mf -f
```

```
wrote assembly.3mf (18 part(s), 4 color(s))
```

```sh
unzip -p assembly.3mf 3D/3dmodel.model | grep -c '<component '
unzip -p assembly.3mf 3D/3dmodel.model | grep -c '<item '
```

The first count is 21: the top group lists four children (the plate, the two brackets and the rod), the two brackets list
seven parts each, and the rod lists three. The second count is 1, because the whole assembly is one build item.

Each part keeps its own name and color. The numbering inside a sub-assembly runs `(1)` to `(7)`, so the second bracket's
parts are numbered the same way: names are unique within a group, not across the file. See
[limitations](limitations.md#how-names-are-derived) for the full naming rules and for what the 3MF does not keep.

## Per-face colors

A part whose faces have different colors keeps them. Each triangle takes the color of the face it belongs to. A face with
no color of its own takes the part's color, and the part's color is the color the part's mesh carries or, failing that,
the face color that covers the most triangles (ties go to the earlier face). When every face shows the part's color, the
output is the same as for a single-color part.

### Example: a cube with three colored faces

`cube.step` is a 10 mm cube with six faces. Three are colored red, blue and green, and three have no color. Convert it,
then count the triangles that carry a face color:

```sh
step23mf "$EX/cube-fcstd/cube.step" -o cube.3mf -f
```

```
wrote cube.3mf (1 part(s), 1 color(s))
```

The `1 color(s)` counts the part's color only. The face colors are written to the same color list, as the next command
shows.

```sh
unzip -p cube.3mf 3D/3dmodel.model | grep -c ' p1='
unzip -p cube.3mf 3D/3dmodel.model | grep '<base '
```

The count is 6: two triangles for each of the red, blue and green faces. The six triangles from the three uncolored faces
have no `p1` and take the part's color. The `<base>` lines show the four colors the file uses:

```
<base name="#CCCCCC" displaycolor="#CCCCCC"/>
<base name="#FF0000" displaycolor="#FF0000"/>
<base name="#0000FF" displaycolor="#0000FF"/>
<base name="#00AA00" displaycolor="#00AA00"/>
```

The part's color (`#CCCCCC`) comes first, then each face color in the order its triangles first appear.

A face range that points past the end of the mesh is clamped to the triangles that exist, and the converter prints a
warning. A face range that is empty (its last triangle comes before its first) is ignored.

## Smoother curves

A STEP file describes curved surfaces exactly. A 3MF file holds only triangles, so the converter has to approximate
every curve with flat facets. Two flags control how closely the facets follow the curve:

- `-t, --tolerance <mm>` sets the largest distance allowed between a facet and the true surface, in millimetres.
  Without it, the converter uses 0.1% of the part's size, as the `--help` text says.
- `-a, --angle <deg>` sets the largest angle allowed between two neighbouring facets, in degrees. The default is 28.6.

Smaller values give smoother curves and larger files. Larger values give coarser facets.

### Example: the same rounded part at three tolerances

`rounded-cube.step` is a 10 mm cube with rounded edges. Convert it at three settings:

```sh
step23mf "$EX/rounded-cube/rounded-cube.step" -o rounded-default.3mf -f
step23mf "$EX/rounded-cube/rounded-cube.step" -o rounded-coarse.3mf -t 0.1 -f
step23mf "$EX/rounded-cube/rounded-cube.step" -o rounded-fine.3mf -t 0.01 -f
```

Each prints `wrote <name>.3mf (1 part(s), 1 color(s))`. Count the triangles in each file:

```sh
unzip -p rounded-default.3mf 3D/3dmodel.model | grep -c '<triangle '
```

| Command | Triangles |
|---|---|
| no flag (default) | 84 |
| `-t 0.1` | 40 |
| `-t 0.01` | 84 |

The default and `-t 0.01` both give 84 triangles, but the two files are not byte-identical, so the default is not exactly
`-t 0.01`. A larger part gets a larger default tolerance, so it does not match this table.

Invalid values stop the converter before any work and exit with code 2: a tolerance must be a positive number, and an
angle must be greater than 0 and at most 90.

```sh
step23mf "$EX/rounded-cube/rounded-cube.step" -t 0; echo "exit $?"
```

```
step23mf: --tolerance needs a positive number of millimetres

Usage: step23mf <input.step> [-o output.3mf] [-f]
...
exit 2
```

The usage text after the message is the same as `step23mf --help`, shown in the [README](../README.md#command-line).
