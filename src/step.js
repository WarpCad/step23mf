import { createRequire } from 'node:module';

/**
 * One node of the reader's assembly tree.
 * @typedef {object} OcctNode
 * @property {string} name
 * @property {number[]} meshes Indexes into `OcctResult.meshes`.
 * @property {OcctNode[]} children
 */

/**
 * One tessellated solid, as the reader returns it. Positions and indexes are flat arrays.
 * @typedef {object} OcctMesh
 * @property {string} name
 * @property {number[]} [color] Linear RGB, each 0..1.
 * @property {{ first: number, last: number, color?: number[] | null }[]} brep_faces
 * @property {{ position: { array: Float32Array | number[] }, normal?: { array: Float32Array | number[] } }} attributes
 * @property {{ array: Uint32Array | number[] }} index
 */

/**
 * The raw reader result, as `ReadStepFile` returns it.
 * @typedef {object} OcctResult
 * @property {boolean} success
 * @property {OcctNode} root
 * @property {OcctMesh[]} meshes
 */

/**
 * @typedef {object} ReadStepOptions
 * @property {'absolute_value' | 'bounding_box_ratio'} [linearDeflectionType] What `linearDeflection` means. The
 *   reader's own default is `bounding_box_ratio`; omit it to keep that default.
 * @property {number} [linearDeflection] Tessellation tolerance. Millimetres when the type is `absolute_value`.
 * @property {number} [angularDeflection] Tessellation angle, radians. Passed through to the reader.
 */

/** The reader's entry point, as the WASM package exposes it. */
/** @typedef {{ ReadStepFile: (bytes: Uint8Array, opts: object | null) => OcctResult }} OcctModule */

/** Failure codes a user can act on. */
/** @typedef {'EMPTY' | 'NOT_STEP' | 'DAMAGED' | 'NO_GEOMETRY'} StepErrorCode */

/**
 * A STEP input the reader refused, with a user-facing message.
 */
export class StepError extends Error {
  /**
   * @param {StepErrorCode} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'StepError';
    /** @type {StepErrorCode} */
    this.code = code;
  }
}

const HEADER = 'ISO-10303-21;';

/** OCCT's parse errors arrive through `print` (stdout), so every line the reader prints lands here. */
/** @type {string[]} */
let captured = [];

/** @type {Promise<OcctModule> | null} */
let loaded = null;

/**
 * Load the WASM module once and cache the promise. Its console output is collected, not printed.
 * @returns {Promise<OcctModule>}
 */
function loadReader() {
  if (loaded) return loaded;
  const require = createRequire(import.meta.url);
  /** @type {(moduleArgs: { print: (line: string) => number, printErr: (line: string) => number }) => Promise<OcctModule>} */
  const factory = require('occt-import-js');
  loaded = factory({
    print: (line) => captured.push(line),
    printErr: (line) => captured.push(line),
  });
  return loaded;
}

/**
 * Check the first non-whitespace bytes, after an optional UTF-8 BOM, against the STEP header.
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
function hasStepHeader(bytes) {
  let i = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  const head = Buffer.from(bytes.subarray(i, i + HEADER.length)).toString('latin1');
  return head === HEADER;
}

/**
 * Pull the reason out of the last captured OCCT parse line.
 * `**** ERR StepFile : Undefined Parsing: Line 4: … ****` gives `Line 4: …`.
 * @param {string[]} lines
 * @returns {string}
 */
function parseReason(lines) {
  const line = [...lines].reverse().find((l) => l.includes('Parsing:'));
  if (!line) return 'OpenCascade could not parse it';
  const reason = line
    .slice(line.indexOf('Parsing:') + 'Parsing:'.length)
    .replace(/^[\s*]+/, '')
    .replace(/[\s*]+$/, '');
  return reason || 'OpenCascade could not parse it';
}

/**
 * Read STEP bytes through the reader. Input checks run before the WASM is touched.
 * @param {Uint8Array} bytes
 * @param {ReadStepOptions} [opts]
 * @returns {Promise<OcctResult>}
 * @throws {StepError} with a code and message for each failure the user can act on.
 */
export async function readStep(bytes, opts = {}) {
  if (bytes.length === 0) throw new StepError('EMPTY', 'the file is empty');
  if (!hasStepHeader(bytes)) {
    throw new StepError('NOT_STEP', 'not a STEP file (it should start with ISO-10303-21;)');
  }

  const reader = await loadReader();
  captured = [];
  const result = reader.ReadStepFile(bytes, {
    linearUnit: 'millimeter',
    ...(opts.linearDeflectionType !== undefined && { linearDeflectionType: opts.linearDeflectionType }),
    ...(opts.linearDeflection !== undefined && { linearDeflection: opts.linearDeflection }),
    ...(opts.angularDeflection !== undefined && { angularDeflection: opts.angularDeflection }),
  });

  if (!result.success) {
    throw new StepError('DAMAGED', `the STEP file is damaged or incomplete: ${parseReason(captured)}`);
  }
  const triangles = result.meshes.reduce((n, m) => n + m.index.array.length / 3, 0);
  if (result.meshes.length === 0 || triangles === 0) {
    throw new StepError('NO_GEOMETRY', 'the STEP file has no solid geometry to convert');
  }
  return result;
}
