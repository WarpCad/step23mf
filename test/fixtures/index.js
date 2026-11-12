// Test fixtures: absolute paths to STEP inputs with known names, colors and units, plus helpers that
// derive broken inputs in memory. See ./README.md for each file's source and the facts specs rely on.
//
// The STEP files below ship inside `occt-import-js` and are used in place, never copied into this
// repository: `package-lock.json` pins them, and their licensing stays with their authors.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const TESTFILES = join(dirname(require.resolve('occt-import-js/package.json')), 'test', 'testfiles');
const HERE = dirname(fileURLToPath(import.meta.url));

/** Single part `Cube`, one color (sRGB `#CCCCCC`), 1000 mm cube authored in millimetres. */
export const CUBE_MM = join(TESTFILES, 'cube-units', 'cube-mm.step');
/** The same cube authored in inches. */
export const CUBE_IN = join(TESTFILES, 'cube-units', 'cube-in.step');
/** The same cube authored in metres. */
export const CUBE_M = join(TESTFILES, 'cube-units', 'cube-m.step');
/** 10 mm cube with per-face colors: red, none, none, blue, none, `#00AA00`. */
export const CUBE_FACES = join(TESTFILES, 'cube-fcstd', 'cube.step');
/** 10 mm cube with six distinct face colors. */
export const CUBE_FACES_ALL = join(TESTFILES, 'cube-fcstd', 'cube2.step');
/** Part `Body`: curved faces, 98 tessellated vertices of which 44 are unique positions. */
export const ROUNDED = join(TESTFILES, 'rounded-cube', 'rounded-cube.step');
/** CAx-IF assembly `AS1_PE_ASM` with a repeated sub-assembly; 18 meshes, each named `SOLID`. */
export const ASSEMBLY = join(TESTFILES, 'cax-if', 'as1_pe_203.stp');

/** Not a STEP file: the text `hello`. */
export const NOT_STEP = join(HERE, 'not-step.step');
/** Zero bytes. */
export const EMPTY = join(HERE, 'empty.step');

/**
 * The first `n` bytes of a file, for truncated-input tests.
 * @param {string} path
 * @param {number} n byte count; past the end returns the whole file
 * @returns {Uint8Array}
 */
export function truncate(path, n) {
  return new Uint8Array(readFileSync(path).subarray(0, n));
}

/** A STEP string literal; a quote inside one is written twice. */
const STR = "'(?:[^']|'')*'";
/** Entities whose first two strings are an id and a name: products, and assembly instances. */
const ID_AND_NAME = new RegExp(`\\b(PRODUCT|NEXT_ASSEMBLY_USAGE_OCCURRENCE)(\\s*\\(\\s*)${STR}(\\s*,\\s*)${STR}`, 'g');
/** Shape entities whose first string is the shape's name. */
const SHAPE_NAME = new RegExp(
  `\\b(MANIFOLD_SOLID_BREP|BREP_WITH_VOIDS|SHELL_BASED_SURFACE_MODEL|FACETED_BREP|[A-Z_]*SHAPE_REPRESENTATION)(\\s*\\(\\s*)${STR}`,
  'g',
);

/**
 * A copy of a STEP file with every product, assembly-instance and shape name blanked, for unnamed-part
 * tests. Bytes outside those names are unchanged.
 * @param {string} path
 * @returns {Uint8Array}
 */
export function blankNames(path) {
  const text = readFileSync(path, 'latin1')
    .replace(ID_AND_NAME, "$1$2''$3''")
    .replace(SHAPE_NAME, "$1$2''");
  return new Uint8Array(Buffer.from(text, 'latin1'));
}
