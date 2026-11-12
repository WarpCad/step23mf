---
name: run-step23mf
description: Run the step23mf CLI against a STEP file and inspect the 3MF it produces. Use whenever asked to run, try, or check the converter, or to confirm a change works end to end.
---

# Run step23mf

No build step. Run the CLI straight from source, from the repository root:

```bash
node bin/step23mf.js test/fixtures/<part>.step -o out/<part>.3mf
```

Then inspect the result, because "exit 0" proves nothing about colors or names:

```bash
mkdir -p out/x && cd out/x && unzip -o ../<part>.3mf && cat 3D/3dmodel.model
```

Check, in `3dmodel.model`: every `<object>` has the expected `name`, its `pid`/`pindex` (or
`basematerials`/`displaycolor`) matches the STEP color, `unit="millimeter"`, and triangle counts are non-zero.
Output goes in `out/`, which is git-ignored. For `TODO/ACCEPTANCE.md` scenarios, drive the real CLI like this
rather than re-running a spec.
