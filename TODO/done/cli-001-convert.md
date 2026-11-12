# cli-001 — Wire the converter into the CLI

> **Shipped:** as specified, plus one detail the spec did not state: the `Usage:` line now reads `[-f]` too. Verification: unit and fixture specs green, and acceptance scenarios 1, 2, 4, 5, 6 and 7 PASS with the real CLI. Scenario 3 is the known gap for core-002.

**Milestone:** M1 First conversion (last task: the milestone hand-test follows) · **Depends on:** step-001,
core-001, 3mf-001 · **Status:** done

## Goal

`step23mf part.step` produces `part.3mf`. User mistakes produce one clear line and a non-zero exit code. This
is the first point at which a person can use the tool.

## Spec

`src/convert.js`: `convert(bytes, opts) → Promise<{ bytes: Uint8Array, parts: number, colors: number,
warnings: string[] }>`. It composes `readStep → buildScene → write3mf` and doesn't touch the filesystem. `src/cli.js`
does only argument parsing, file I/O and exit codes.

### New option

Add `-f, --force` to `parseArgs` and `USAGE`. The options block becomes exactly:

```
Options:
  -o, --output <file>   Output path (default: input name with .3mf)
  -f, --force           Overwrite the output file if it exists
  -h, --help            Show this help
  -v, --version         Show the version
```

### Output path

- Default: the input path with a trailing `.step` or `.stp` (case-insensitive) replaced by `.3mf`. Any other
  name gets `.3mf` appended (`part.txt` → `part.txt.3mf`). The output goes in the same directory as the input,
  not the current directory.
- An existing output without `--force` is refused before anything is converted.
- Write to `<output>.tmp-<pid>` in the same directory, then rename it, so a failure never leaves a half-written
  3MF behind.

### Messages and exit codes

stderr, prefixed `step23mf: `, one line each:

| Case | Exit | Message |
|---|---|---|
| bad arguments (existing) | 2 | existing text + usage |
| input missing | 1 | `cannot read <in>: no such file` |
| input is a directory | 1 | `cannot read <in>: it is a directory` |
| input unreadable (permissions) | 1 | `cannot read <in>: permission denied` |
| `StepError` | 1 | `<in>: <StepError.message>` |
| output exists | 1 | `<out> already exists (use --force to overwrite)` |
| output dir missing | 1 | `cannot write <out>: directory does not exist` |
| other write failure | 1 | `cannot write <out>: <err.code>` |
| unexpected exception | 1 | `internal error: <message> (please report this with the STEP file)` |

Each warning from `convert` goes to stderr as `step23mf: warning: <text>`.

On success, stdout gets one line: `wrote <out> (<P> part(s), <C> color(s))`, then exit 0. `<out>` is printed as
the user would type it (relative if the input was relative).

There is never a stack trace. The unexpected-exception row is the only catch-all, and it's a bug report.

## Testing

- `test/cli.spec.js`: extend it with `-f`/`--force` parsing and the default output path (`.step`, `.STP`,
  `.stp`, no extension, `.txt`, a path with a directory).
- `test/cli.run.spec.js`: `main()` with the filesystem mocked at the `node:fs/promises` boundary and `convert`
  mocked. Covers each table row's exact message and exit code, no-clobber, `--force`, the temp-then-rename
  order, and the temp file being removed when the rename fails. stdout and stderr are captured, and the spec
  asserts that there is no stack trace.
- `test/cli.e2e.spec.js`: spawns `node bin/step23mf.js` on `CUBE_MM` into a temp dir. Checks exit 0, the
  stdout line, and that `read3mf` shows one object `Cube` `#CCCCCC`.

## Docs

Update the `README.md` usage block with the real output line. Update the status line from "scaffold" to "converts
single parts and flat assemblies". Update the CLAUDE.md status line too.

## Acceptance

Drive scenarios **1, 2, 4, 5, 6 and 7** with the real CLI (`run-step23mf` skill) and report PASS/FAIL. Scenario 3
is expected to show only the mesh color until core-002, so record it as "known, core-002", not as a FAIL.

Milestone M1 ends here. `/run-todos` pauses for a human to run the CLI on several real STEP files of their own
for five free-form minutes.
