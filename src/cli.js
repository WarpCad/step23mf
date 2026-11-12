import { readFileSync } from 'node:fs';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { convert } from './convert.js';
import { StepError } from './step.js';

const USAGE = `Usage: step23mf <input.step> [-o output.3mf] [-f]

Convert a STEP file to 3MF, keeping part colors and names.

Options:
  -o, --output <file>   Output path (default: input name with .3mf)
  -f, --force           Overwrite the output file if it exists
  -t, --tolerance <mm>  Max distance from the true surface, in millimetres
                        (default: 0.1% of the part size)
  -a, --angle <deg>     Max angle between adjacent facets, in degrees (default: 28.6)
  -h, --help            Show this help
  -v, --version         Show the version
`;

/**
 * @typedef {{ input?: string, output?: string, force: boolean, help: boolean, version: boolean, tolerance?: number, angle?: number, error?: string }} ParsedArgs
 */

/**
 * The degree-to-radian conversion at the CLI boundary. The reader takes radians.
 * @param {number} deg
 * @returns {number}
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Parse a flag value as a finite number. Empty, non-numeric and infinite values give NaN.
 * @param {string | undefined} v
 * @returns {number}
 */
function toNumber(v) {
  if (v === undefined || v.trim() === '') return Number.NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NaN;
}

/**
 * Parse argv into options. Pure, so it is unit-testable without touching disk.
 * @param {string[]} argv Arguments after the node binary and script path.
 * @returns {ParsedArgs}
 */
export function parseArgs(argv) {
  /** @type {ParsedArgs} */
  const opts = { help: false, version: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (a === '-f' || a === '--force') opts.force = true;
    else if (a === '-o' || a === '--output') {
      const v = argv[++i];
      if (!v) return { ...opts, error: `${a} needs a file path` };
      opts.output = v;
    } else if (a === '-t' || a === '--tolerance') {
      const n = toNumber(argv[++i]);
      if (Number.isNaN(n) || n <= 0) return { ...opts, error: '--tolerance needs a positive number of millimetres' };
      opts.tolerance = n;
    } else if (a === '-a' || a === '--angle') {
      const n = toNumber(argv[++i]);
      if (Number.isNaN(n) || n <= 0 || n > 90) {
        return { ...opts, error: '--angle needs a number of degrees between 0 and 90' };
      }
      opts.angle = n;
    } else if (a.startsWith('-')) return { ...opts, error: `unknown option ${a}` };
    else if (opts.input) return { ...opts, error: `unexpected extra argument ${a}` };
    else opts.input = a;
  }
  return opts;
}

/**
 * The output path when `-o` is absent: the input with a trailing `.step` or `.stp` (any case) replaced
 * by `.3mf`, or `.3mf` appended to any other name. The directory part of the input is kept.
 * @param {string} input The input path, as the user typed it.
 * @returns {string}
 */
export function defaultOutput(input) {
  return /\.(step|stp)$/i.test(input) ? input.replace(/\.(step|stp)$/i, '.3mf') : `${input}.3mf`;
}

/**
 * The reason a read failed, as the message wants it.
 * @param {NodeJS.ErrnoException} e
 * @returns {string}
 */
function readReason(e) {
  switch (e.code) {
    case 'ENOENT':
      return 'no such file';
    case 'EISDIR':
      return 'it is a directory';
    case 'EACCES':
    case 'EPERM':
      return 'permission denied';
    default:
      return String(e.code ?? 'unknown error');
  }
}

/**
 * Whether anything exists at `path`. A permission error on stat counts as existing, so it refuses.
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (e) {
    return (/** @type {NodeJS.ErrnoException} */ (e)).code !== 'ENOENT';
  }
}

/**
 * Print one `step23mf:` line to stderr and return the exit code.
 * @param {string} message
 * @returns {1}
 */
function fail(message) {
  console.error(`step23mf: ${message}`);
  return 1;
}

/**
 * CLI entry point.
 * @param {string[]} argv Arguments after the script path.
 * @returns {Promise<number>} Process exit code.
 */
export async function main(argv) {
  const opts = parseArgs(argv);
  if (opts.error) {
    console.error(`step23mf: ${opts.error}\n\n${USAGE}`);
    return 2;
  }
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  if (opts.version) {
    console.log(pkg.version);
    return 0;
  }
  if (opts.help || !opts.input) {
    console.log(USAGE);
    return opts.help ? 0 : 2;
  }

  const input = opts.input;
  const out = opts.output ?? defaultOutput(input);

  let bytes;
  try {
    bytes = new Uint8Array(await readFile(input));
  } catch (e) {
    return fail(`cannot read ${input}: ${readReason(/** @type {NodeJS.ErrnoException} */ (e))}`);
  }

  if (!opts.force && (await exists(out))) {
    return fail(`${out} already exists (use --force to overwrite)`);
  }

  let result;
  try {
    result = await convert(bytes, {
      application: `step23mf ${pkg.version}`,
      // Only set when the flag is given, so the default output stays byte-identical to before.
      ...(opts.tolerance !== undefined && { linearDeflectionType: 'absolute_value', linearDeflection: opts.tolerance }),
      ...(opts.angle !== undefined && { angularDeflection: degToRad(opts.angle) }),
    });
  } catch (e) {
    if (e instanceof StepError) return fail(`${input}: ${e.message}`);
    const message = e instanceof Error ? e.message : String(e);
    return fail(`internal error: ${message} (please report this with the STEP file)`);
  }

  for (const w of result.warnings) console.error(`step23mf: warning: ${w}`);

  // Write beside the target, then rename, so a failure never leaves a half-written 3MF behind.
  const tmp = `${out}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, result.bytes);
    await rename(tmp, out);
  } catch (e) {
    await rm(tmp, { force: true }).catch(() => {});
    const code = (/** @type {NodeJS.ErrnoException} */ (e)).code;
    return fail(
      code === 'ENOENT'
        ? `cannot write ${out}: directory does not exist`
        : `cannot write ${out}: ${code ?? 'unknown error'}`,
    );
  }

  console.log(`wrote ${out} (${result.parts} part(s), ${result.colors} color(s))`);
  return 0;
}
