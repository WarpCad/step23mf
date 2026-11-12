import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as fixtures from './fixtures/index.js';
import { ASSEMBLY, CUBE_FACES, blankNames, truncate } from './fixtures/index.js';

const NON_EMPTY_PRODUCT_NAME = /\bPRODUCT\s*\(\s*'(?:[^']|'')+'|\bPRODUCT\s*\(\s*'(?:[^']|'')*'\s*,\s*'(?:[^']|'')+'/;

const paths = Object.entries(fixtures).filter(
  /** @returns {entry is [string, string]} */ (/** @type {[string, unknown]} */ entry) => typeof entry[1] === 'string',
);

describe('fixture paths', () => {
  it('exports every fixture named in the README', () => {
    expect(paths.map(([name]) => name).sort()).toEqual(
      ['ASSEMBLY', 'CUBE_FACES', 'CUBE_FACES_ALL', 'CUBE_IN', 'CUBE_M', 'CUBE_MM', 'EMPTY', 'NOT_STEP', 'ROUNDED'].sort(),
    );
  });

  it.each(paths)('%s is an absolute path that exists', (_name, path) => {
    expect(isAbsolute(path)).toBe(true);
    expect(existsSync(path)).toBe(true);
  });

  it('keeps the self-authored fixtures at their documented contents', () => {
    expect(readFileSync(fixtures.EMPTY).length).toBe(0);
    expect(readFileSync(fixtures.NOT_STEP, 'utf8').trim()).toBe('hello');
  });
});

describe('truncate', () => {
  it('returns exactly the first n bytes', () => {
    const whole = readFileSync(CUBE_FACES);
    const cut = truncate(CUBE_FACES, 4000);
    expect(cut).toBeInstanceOf(Uint8Array);
    expect(cut.length).toBe(4000);
    expect(Buffer.from(cut).equals(whole.subarray(0, 4000))).toBe(true);
  });

  it('returns the whole file when n is past the end, and nothing for n = 0', () => {
    expect(truncate(CUBE_FACES, 10_000_000).length).toBe(readFileSync(CUBE_FACES).length);
    expect(truncate(CUBE_FACES, 0).length).toBe(0);
  });
});

describe('blankNames', () => {
  it('leaves no non-empty PRODUCT name', () => {
    const source = readFileSync(ASSEMBLY, 'latin1');
    expect(source).toMatch(NON_EMPTY_PRODUCT_NAME);
    const text = Buffer.from(blankNames(ASSEMBLY)).toString('latin1');
    expect(text).not.toMatch(NON_EMPTY_PRODUCT_NAME);
    expect(text.match(/\bPRODUCT\s*\(/g)?.length).toBe(source.match(/\bPRODUCT\s*\(/g)?.length);
  });

  // Fixture test: one real WASM parse, to prove the blanked file is still STEP and that OCCT
  // finds no authored name in it (it still invents `SOLID` for unnamed solids; see the README).
  it('still parses, and OCCT reads every assembly node name as empty', async () => {
    const require = createRequire(import.meta.url);
    /** @type {() => Promise<any>} */
    const init = require('occt-import-js');
    const occt = await init();
    const result = occt.ReadStepFile(blankNames(ASSEMBLY), null);
    expect(result.success).toBe(true);
    expect(result.meshes.length).toBe(18);
    /** @type {string[]} */
    const names = [];
    /** @param {{ name: string, children: any[] }} node */
    const walk = (node) => {
      names.push(node.name);
      node.children.forEach(walk);
    };
    walk(result.root);
    expect(names.length).toBeGreaterThan(1);
    expect(names.every((name) => name === '')).toBe(true);
  });
});
