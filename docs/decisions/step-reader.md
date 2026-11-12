# Decision: STEP reader

**Chosen:** `occt-import-js` (OpenCascade via WASM, runs in Node and browsers).

It reads STEP/IGES/BREP, returns triangle meshes with per-mesh and per-face colors, and a node tree with
names. That is the data needed to keep colors and names.

**License note.** OpenCascade is LGPL-2.1. step23mf is MIT. Keeping `occt-import-js` as an installed
dependency (not copied or bundled into our files) keeps that boundary clean. Do not vendor or bundle it
into one file without re-reading the LGPL terms.

## Rejection table

Fill in when this decision is revisited: compare stars, issue ratio, release recency and maintainers for
`opencascade.js` (full OCCT build, larger, more control) and any pure-JS STEP parser. Re-run the health
check before the first release.

| Option | Reason it lost |
|---|---|
| `opencascade.js` | Not yet evaluated. Larger build; revisit if `occt-import-js` drops assembly names or per-face color. |
