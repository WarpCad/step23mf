# step23mf

Command line tool that converts STEP files to 3MF, keeping part colors and names.

> **Status:** converts parts, per-face colors and assemblies (as groups). Open work is in
> [`TODO/ROADMAP.md`](TODO/ROADMAP.md). Which programs show the colors and names it writes:
> [`docs/compatibility.md`](docs/compatibility.md) (partial).

## Install

```sh
npm i -g @warpcad/step23mf
```

Or run it without installing: `npx @warpcad/step23mf --help`.

## Quick start

```sh
npm i -g @warpcad/step23mf
step23mf assembly.step -o assembly.3mf
# wrote assembly.3mf (18 part(s), 4 color(s))
```

The output line above is what the converter prints for the example assembly in
[docs/usage.md](docs/usage.md#get-the-example-files).

Without `-o`, the output goes next to the input with a `.3mf` extension. An existing output is refused unless you
pass `-f` (`--force`). Errors print one `step23mf:` line to stderr and exit 1.

## Pages

- [docs/usage.md](docs/usage.md): step-by-step examples for output paths, assemblies, per-face colors and smoother curves.
- [docs/limitations.md](docs/limitations.md): what the 3MF keeps and what it loses, and how names are derived.
- [docs/compatibility.md](docs/compatibility.md): which programs show the colors and names.

## Command line

The block below is the converter's own `--help` text. `test/docs.spec.js` fails if it drifts from the code.

```text
Usage: step23mf <input.step> [-o output.3mf] [-f]

Convert a STEP file to 3MF, keeping part colors and names.

Options:
  -o, --output <file>   Output path (default: input name with .3mf)
  -f, --force           Overwrite the output file if it exists
  -t, --tolerance <mm>  Max distance from the true surface, in millimetres
                        (default: 0.1% of the part size)
  -a, --angle <deg>     Max angle between adjacent facets, in degrees (default: 28.6)
  -h, --help            Show this help
  -v, --version         Show the version
```

## Development

```sh
npm install
npm test
npm run typecheck
```

`npm install` also installs a pre-push hook that runs the tests and the typecheck before every push. GitHub
Actions run only when started by hand.

STEP is read with [`occt-import-js`](https://github.com/kovacsv/occt-import-js) (OpenCascade compiled to WASM).
3MF is written with [`fflate`](https://github.com/101arrowz/fflate). See `docs/decisions/` for why.

## License

MIT, for the code in this package.

### Third-party code

STEP files are read by [`occt-import-js`](https://github.com/kovacsv/occt-import-js), which npm installs as a
separate dependency. It is OpenCascade compiled to WASM. OpenCascade is licensed under the LGPL-2.1 with the Open
CASCADE exception, and its source is at [github.com/Open-Cascade-SAS/OCCT](https://github.com/Open-Cascade-SAS/OCCT).
This package does not copy, bundle or modify that code. You can replace the installed `occt-import-js` with your own
build of it. The reasons behind this choice are in [`docs/decisions/step-reader.md`](docs/decisions/step-reader.md).
