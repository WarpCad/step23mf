import { buildScene } from './scene.js';
import { readStep } from './step.js';
import { write3mf } from './threemf.js';

/**
 * @typedef {object} ConvertOptions
 * @property {string} application Goes into the 3MF Application metadata, for example `step23mf 0.1.0`.
 * @property {'absolute_value' | 'bounding_box_ratio'} [linearDeflectionType] See `ReadStepOptions`.
 * @property {number} [linearDeflection] Tessellation tolerance. Passed through to the reader.
 * @property {number} [angularDeflection] Tessellation angle, radians. Passed through to the reader.
 */

/**
 * @typedef {object} ConvertResult
 * @property {Uint8Array} bytes The 3MF package.
 * @property {number} parts Number of parts (one 3MF object each).
 * @property {number} colors Number of distinct part colors in the basematerials group.
 * @property {string[]} warnings Non-fatal problems, as sentences.
 */

/**
 * Read STEP bytes, build the scene, and write a 3MF. Composes the three stages and touches no
 * filesystem; `cli.js` owns all I/O.
 * @param {Uint8Array} bytes STEP file contents.
 * @param {ConvertOptions} opts
 * @returns {Promise<ConvertResult>}
 * @throws {import('./step.js').StepError} for any input the reader refuses.
 */
export async function convert(bytes, opts) {
  const raw = await readStep(bytes, {
    linearDeflectionType: opts.linearDeflectionType,
    linearDeflection: opts.linearDeflection,
    angularDeflection: opts.angularDeflection,
  });
  const { scene, warnings } = buildScene(raw);
  const colors = new Set(scene.parts.map((p) => p.color).filter((c) => c !== null)).size;
  const out = write3mf(scene, { application: opts.application });
  return { bytes: out, parts: scene.parts.length, colors, warnings };
}
