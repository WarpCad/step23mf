# Limitations

What a 3MF written by step23mf keeps, what it loses, and how the names and colors it writes are derived.

## Kept

- **Names.** Part and assembly names are written verbatim, with XML special characters escaped and nothing else changed.
  How a name is chosen when a part has none is set out under [How names are derived](#how-names-are-derived).
- **Part colors and face colors.** Each part's color is written as `#RRGGBB`, and faces with their own colors keep them
  on their triangles. See [Per-face colors](usage.md#per-face-colors).
- **Millimetre geometry.** The 3MF declares `unit="millimeter"`, and every coordinate is in millimetres. A file authored
  in inches or metres comes out at the same size in millimetres: the test cube, authored in millimetres, inches and
  metres, spans 0 to 1000 mm in each case.
- **Assembly grouping.** Each assembly with two or more parts is one group object, and the top-level assembly is one
  build item. See [Assemblies](usage.md#assemblies).
- **Repeatable output.** The same input gives byte-identical output, so a converted file can be compared with `cmp`.

## Lost

- **The exact surface.** A 3MF holds only triangles, so every curved face is approximated with flat facets. The
  tolerance flags set how close the approximation is; see [Smoother curves](usage.md#smoother-curves).
- **Repeated sub-assemblies are copies.** A STEP assembly can place the same sub-assembly more than once. The reader
  gives each placement its own meshes, so the converter writes every placement as a full copy. A file with two identical
  brackets holds two complete sets of triangles, and the file grows with each repeat. Sharing one mesh between placements
  would mean detecting that two meshes are exactly equal, which step23mf does not do.
- **Sub-assembly hierarchy.** The reader does not report the parts inside a sub-assembly as child nodes:
  `L_BRACKET_ASSEMBLY_ASM` arrives as seven meshes on one node. The converter makes that node one group of seven parts.
  Any hierarchy below that node is not in the reader output, so it is not in the 3MF.
- **Product and manufacturing information.** Dimensions, tolerances, notes and other annotations (PMI) are not read.
  The output has the shapes and their colors, and nothing else from the STEP file.
- **Transparency.** The 3MF writer emits `#RRGGBB` only. Any alpha value a STEP file gives a color is dropped.
- **Layers and materials beyond color.** Only the color of a part or face is read. Layers, and material properties
  other than the color, are not in the 3MF.

## How names are derived

A STEP file may leave a part or assembly unnamed. step23mf fills the gap in this order:

1. **The node's name.** A node that holds one mesh names it after the node. If that node has no name, it takes the
   name of the nearest named node above it in the assembly tree.
2. **The mesh's name.** A node that holds more than one mesh names each mesh after the mesh itself, falling back to
   the node's name for a mesh that has none. OCCT, the STEP reader, sometimes puts a whole part's solids under one
   node: Adafruit's 1586 NeoPixel ring arrives as one `PCB Component` node holding the board, 24 LEDs, 15 capacitors
   and a resistor, which come out as `Board`, `WS2812B-NARROW (1)` to `(24)`, `C0603 (1)` to `(15)` and `0603-NO`.
   The mesh's name is also used when no node above it has a name. OCCT gives an unnamed solid the placeholder name
   `SOLID`, so that name is never used.
3. **`Part N`.** If nothing is named, the part is called `Part N`, where `N` is its position among the parts written,
   starting at 1.
4. **`(k)` suffix.** When more than one mesh in one node gets the same name, each gets `(k)` after it, with `k`
   counting from 1. A name used once stays bare. The brackets in the `ASSEMBLY` sample are unnamed solids, so all
   seven take the node's name and appear as `L_BRACKET_ASSEMBLY_ASM (1)` to `(7)`. The second bracket in the same file
   repeats `(1)` to `(7)`, because the numbering restarts at each node.
5. **Instance names are not kept.** A STEP file can name each placed copy (`WS2812B-NARROW:LED7`, `C0603:C2`), but
   OCCT does not pass those names on, so the 3MF has the part's product name and a number instead.
6. **Unnamed groups.** A group with no name of its own is called `Assembly N`, where `N` counts the groups.

The numbering is per node, not per file. Names are unique within a group, but not across the whole file.

## Why colors are converted from linear RGB

The STEP reader reports colors in linear light: the values a renderer multiplies together to compute light. A 3MF
`displaycolor` is the color a viewer shows on screen, which is in sRGB, the encoding screens expect. So step23mf converts
each channel from linear to sRGB with the standard transfer function, then rounds it to one byte.

The test cube shows the effect. Its reader color is linear `0.6038` in every channel, and sRGB encoding turns that into
`#CCCCCC`. Writing the linear value straight into a hex byte would give
`#9A9A9A`, a noticeably darker grey.

## Transforms are already applied

Every part is written at its position in the assembly. The 3MF has no transform on the components, so a slicer sees the
assembly exactly as the STEP file placed it.
