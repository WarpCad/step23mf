# step-001 — Read STEP bytes through occt-import-js

**Milestone:** M1 First conversion · **Depends on:** build-001 · **Status:** done

## Goal

A thin, quiet boundary around the WASM reader: bytes in, the raw `occt-import-js` result out, and failures
sorted into causes a user can act on. No naming or color logic here (that's core-001).

## Spec

`src/step.js`:

- `readStep(bytes: Uint8Array, opts?: { linearDeflection?: number, angularDeflection?: number }) →
  Promise<OcctResult>`.
- Always passes `linearUnit: 'millimeter'`, so the only unit conversion happens at this boundary
  (CLAUDE.md, Units). Deflection options pass through untouched; cli-002 exposes them.
- Loads the WASM module **once**, lazily, and caches the promise. Load it with `createRequire` (the package is
  CJS). Pass `{ print, printErr }` to the factory and collect OCCT's console lines into a buffer instead of
  letting them reach stdout. Today OCCT prints `**** ERR StepFile : … ****` to stdout on any parse error, and the
  CLI must print exactly one line.
- `OcctResult`, `OcctNode` and `OcctMesh` are JSDoc typedefs in `src/step.js` that mirror the README shape
  (`root{name,meshes,children}`, `meshes[]{name,color?,brep_faces[{first,last,color}],attributes.position.array,
  attributes.normal?.array,index.array}`). `npm run typecheck` passes without `any`-casting the result.

Errors: `readStep` throws a `StepError` with `code` and a message; it never throws a bare `Error`.

| `code` | When | `message` (exact) |
|---|---|---|
| `EMPTY` | 0 bytes | `the file is empty` |
| `NOT_STEP` | first non-whitespace bytes (after an optional UTF-8 BOM) aren't `ISO-10303-21;` | `not a STEP file (it should start with ISO-10303-21;)` |
| `DAMAGED` | header is fine but `success` is false | `the STEP file is damaged or incomplete: <reason>` |
| `NO_GEOMETRY` | `success` is true but there are zero meshes or zero triangles in total | `the STEP file has no solid geometry to convert` |

`<reason>` comes from the captured OCCT line, cut down to the text after `Parsing:` and with the `*` padding
removed, for example `Line 109: Incorrect syntax: unexpected end of file`. Without a captured line it is `OpenCascade
could not parse it`.

Degenerate cases: header check on a file shorter than the header. A BOM. Leading blank lines. CRLF line
endings. A `.stp` extension doesn't matter, because detection is by content.

## Testing

- `test/step.spec.js` (unit, WASM **mocked** with `vi.mock('occt-import-js')`): each error code and its exact
  message. The reason is extracted from a sample OCCT line. The factory is called once across two
  `readStep` calls. Nothing is written to `process.stdout` (spy on it).
- `test/step.fixture.spec.js` (real WASM, fixtures from build-001): `CUBE_MM` → 1 mesh, 12 triangles.
  `ASSEMBLY` → 18 meshes. `truncate(CUBE_FACES, 4000)` → `DAMAGED` with a reason containing
  `unexpected end of file`. `not-step.step` → `NOT_STEP`. `empty.step` → `EMPTY`. `CUBE_IN` has max coordinate
  `toBeCloseTo(1000, 6)`.

## Docs

None user-facing yet. Add a `TROUBLESHOOTING.md` entry: "OCCT prints parse errors to stdout; capture them through
the factory's `print`/`printErr`."

## Acceptance

Scenario 4 (Bad input) can be checked once cli-001 lands. Until then, check it through `step.fixture.spec.js`.
