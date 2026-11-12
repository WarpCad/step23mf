# Troubleshooting

Non-obvious root causes found while working on this project. Read before debugging; append with `/troubleshoot`.

<!-- Template:
### YYYY-MM-DD — Short title
**What happened:**
**Why it happened:**
**Fix / Prevention:**
**Steps taken to resolve:**
-->

### 2026-11-09 — occt-import-js colors are linear RGB, not sRGB
**What happened:** A part authored as light gray (`#CCCCCC`) read back from `occt-import-js` as `0.6038…` on every channel. Writing that straight into a 3MF as `#999999` would have turned every part darker than the source.
**Why it happened:** OCCT stores STEP colors in linear light, and the reader returns them unconverted (mesh `color` and `brep_faces[].color`, 0-1). 3MF `displaycolor` is sRGB. Nothing in the reader's output or README says which space the numbers are in.
**Fix / Prevention:** Convert with `linearToSrgb` in `src/scene.js` (`c <= 0.0031308 ? 12.92c : 1.055·c^(1/2.4) − 0.055`, clamp, scale by 255, round half up) before formatting `#RRGGBB`. Known pairs: `0.6038273572921753` -> `CC`, `0.4019778072834015` -> `AA`, `0.21223075687885284` -> `7F`. Never write a reader color into a document without converting.
**Steps taken to resolve:** Compared the fixture `cube-mm.step` color against its expected `#CCCCCC`, then derived the gamma curve that maps one to the other (`test/fixtures/README.md` lists the pairs).

### 2026-11-09 — occt-import-js writes parse errors to stdout, through `print`
**What happened:** A truncated STEP file printed `**** ERR StepFile : Undefined Parsing: Line 4: Incorrect syntax: unexpected end of file … ****` on stdout. The CLI is meant to print exactly one line, so this would have leaked into the output.
**Why it happened:** OCCT's diagnostics go through the WASM module's `print` callback, not `printErr`. Passing only `printErr` to the factory captures nothing, because parse errors never reach it.
**Fix / Prevention:** `src/step.js` passes both `print` and `printErr` to the factory, and both push into one buffer that `readStep` clears before each read. Parse reasons for `DAMAGED` come from the last captured line containing `Parsing:`. The reader's output must never reach `process.stdout` directly.
**Steps taken to resolve:** Probed the reader with a truncated header and printed the callbacks. Only `print` received the line. `test/step.spec.js` spies on `process.stdout.write` to pin it.

### 2026-11-09 — fflate stamps zip headers with local time, so 3MF bytes depended on TZ
**What happened:** Two calls to `zipSync` with the same fixed `mtime` gave different bytes under `TZ=UTC` and `TZ=Pacific/Kiritimati`, which broke the byte-identical determinism rule.
**Why it happened:** fflate writes the DOS date and time fields with `getFullYear`/`getHours` etc. (local-time getters). A fixed instant therefore has a different local date and hour in each zone.
**Fix / Prevention:** `src/threemf.js` passes a valid mtime (noon UTC on 1980-01-01, which is 1980 in every zone; fflate rejects earlier years), then walks the central directory and overwrites every local and central header's DOS time and date with the fixed DOS epoch. The walk uses the end-of-central-directory record, so it never scans compressed bytes for a signature. `test/threemf.spec.js` runs the writer under two zones in child processes; removing the patch makes that test fail.
**Steps taken to resolve:** Compared raw `zipSync` output under two zones with a fixed UTC instant (differs), then disabled the patch to confirm the determinism test catches it.
