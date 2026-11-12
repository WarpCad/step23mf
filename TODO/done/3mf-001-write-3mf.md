# 3mf-001 — Write a deterministic 3MF package

**Milestone:** M1 First conversion · **Depends on:** core-001 · **Status:** done

## Goal

`Scene` in, 3MF bytes out. A file that conforms to the 3MF Core Specification and that every consumer opens,
with each part's name and color on its object. The same input must produce byte-identical output.

## Spec

`src/threemf.js`: `write3mf(scene: Scene, opts: { application: string }) → Uint8Array`. Pure: it doesn't touch the
filesystem or read the clock.

Zip entries, in this order:

1. `[Content_Types].xml`: `Default` entries for `rels`
   (`application/vnd.openxmlformats-package.relationships+xml`) and `model`
   (`application/vnd.ms-package.3dmanufacturing-3dmodel+xml`).
2. `_rels/.rels`: one `Relationship`, `Target="/3D/3dmodel.model"`, `Id="rel0"`,
   `Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"`.
3. `3D/3dmodel.model`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
     <metadata name="Application">step23mf 0.1.0</metadata>
     <resources>
       <basematerials id="1">
         <base name="#CCCCCC" displaycolor="#CCCCCC"/>
       </basematerials>
       <object id="2" type="model" name="Cube" pid="1" pindex="0">
         <mesh><vertices><vertex x="0" y="0" z="0"/>…</vertices>
               <triangles><triangle v1="0" v2="1" v3="2"/>…</triangles></mesh>
       </object>
     </resources>
     <build><item objectid="2"/></build>
   </model>
   ```

Rules:

- **One `basematerials` group** (id 1). There is one `base` per distinct color, in first-use order, and its `name`
  is the hex. Omit the group when no part has a color. A part with `color: null` has no `pid`/`pindex`.
- Object ids start at 2, in scene order. There is one build `item` per part, with no transform, because geometry
  is already in world millimetres.
- **Names are XML-escaped** (`& < > " '`), never sanitized. Control characters that XML 1.0 forbids are dropped,
  and that is the only change made to a name. A test pins it.
- **Numbers**: `String(n)` (shortest round-trip), with `-0` written as `0`. Never `NaN` or `Infinity` (core-001
  already rejected them; assert here).
- **Determinism**: pass `fflate`'s `zipSync` a fixed `mtime` per entry and a fixed deflate level. DOS
  timestamps are local time, so **the output must not change with `TZ`**. Check that fflate's `mtime` handling
  depends on the local timezone. If it does, pick a date and time that cannot shift across the date line, or
  write the timestamp fields directly, and record which in `TROUBLESHOOTING.md`.
- Throws if `scene.parts` is empty. The CLI reports that case before this point (step-001 `NO_GEOMETRY`).

## Testing

`test/threemf.spec.js`, read back with `read3mf` from build-001:

- Entry order and content-type and relationship strings are exact.
- `unit="millimeter"`. Names, `pid`/`pindex` and `displaycolor` match the scene.
- Color dedupe: three parts in two colors give two `base` entries, in first-use order. A part with no color has
  no `pid`. All parts uncolored means no `basematerials`.
- Escaping: `A & <B> "C" 'D'` round-trips exactly. A `\u0001` in a name is dropped.
- Vertex and triangle counts match. A large scene (1e5 triangles) writes in under 2 s.
- Determinism: two calls give identical bytes. Run the same comparison in child processes with `TZ=UTC` and
  `TZ=Pacific/Kiritimati` and check that both produce the same bytes.

## Docs

None user-facing (docs-001). The model layout above is the reference for later tasks.

## Acceptance

Scenarios 1, 2 and 7 once cli-001 lands.
