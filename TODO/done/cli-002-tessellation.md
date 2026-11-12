# cli-002 — Tessellation quality flags

**Milestone:** M3 Release · **Depends on:** cli-001 · **Status:** done

> **Shipped:** as specified, plus two details the spec did not state. (1) `readStep` and `convert` did not forward
> `linearDeflectionType`, so `--tolerance` could not mean an absolute value until both now pass it through. (2)
> The defaults were confirmed against occt-import-js 0.0.23 source (`importer.hpp`): `bounding_box_ratio` 0.001 and
> 0.5 rad, which is 28.6°. The help text's "0.1% of the part size" is, precisely, 0.1% of the average bounding-box
> size. Verification: 141 unit tests and typecheck green. `docs/usage.md` was created as a stub holding only the
> "Smoother curves" section, for docs-001 to extend. Acceptance scenarios 1 and 7 PASS: default output is
> byte-identical to before the change. Nothing is committed.

## Goal

STEP holds exact surfaces and 3MF holds triangles. Let the user choose how closely the triangles follow curves.
Coarse output gives faceted prints and fine output gives large files.

## Spec

New options, inserted after `--force` in `USAGE`:

```
  -t, --tolerance <mm>  Max distance from the true surface, in millimetres
                        (default: 0.1% of the part size)
  -a, --angle <deg>     Max angle between adjacent facets, in degrees (default: 28.6)
```

- `--tolerance` passes `linearDeflectionType: 'absolute_value'` and `linearDeflection: <mm>`. Without it, the
  occt default (`bounding_box_ratio`, 0.001) applies. **Before writing the default into the help text, confirm it
  against the 0.0.23 source.**
- `--angle` converts degrees to radians at the CLI boundary (`degToRad`) before passing `angularDeflection`. The
  default is occt's 0.5 rad (28.6°). Confirm it the same way.
- Validation (exit 2, plus usage): the value must be a finite number > 0. `--angle` must also be ≤ 90. Messages:
  `--tolerance needs a positive number of millimetres` and `--angle needs a number of degrees between 0 and 90`.
- Passed through `convert` → `readStep(bytes, { linearDeflection, angularDeflection })` (step-001 already accepts
  them).

## Testing

- `test/cli.spec.js`: parsing, the degree→radian conversion (`toBeCloseTo`), and each validation message.
  Rejected values: `0`, `-1`, `abc`, `Infinity` and `91`.
- `test/step.fixture.spec.js`: `ROUNDED` with `--tolerance 0.01` has strictly more triangles than with
  `--tolerance 1`. Both stay watertight (`meshStats`).

## Docs

`docs/usage.md` gets a "Smoother curves" section with a worked example that gives triangle counts for `ROUNDED`
at two tolerances.

## Acceptance

Scenarios 1 and 7 (the default output must not change when neither flag is given).
