import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convert } from '../src/convert.js';
import { StepError } from '../src/step.js';
import { ASSEMBLY, CUBE_MM, NOT_STEP } from './fixtures/index.js';
import { read3mf } from './helpers/read3mf.js';

const opts = { application: 'step23mf 0.1.0' };

describe('convert (real reader)', () => {
  it('turns CUBE_MM into a 3MF with one part and one color, and reports the counts', async () => {
    const result = await convert(new Uint8Array(readFileSync(CUBE_MM)), opts);
    expect(result.parts).toBe(1);
    expect(result.colors).toBe(1);
    expect(result.warnings).toEqual([]);
    const pkg = read3mf(result.bytes);
    expect(pkg.objects.map((o) => o.name)).toEqual(['Cube']);
  });

  it('keeps every assembly part, in order, with its own name', async () => {
    const result = await convert(new Uint8Array(readFileSync(ASSEMBLY)), opts);
    expect(result.parts).toBeGreaterThanOrEqual(3);
    const objects = read3mf(result.bytes).objects;
    // Mesh objects are the parts; component objects are the assembly groups (core-003).
    expect(objects.filter((o) => o.components === undefined)).toHaveLength(result.parts);
  });

  it('gives byte-identical output for the same input', async () => {
    const bytes = new Uint8Array(readFileSync(ASSEMBLY));
    const a = await convert(bytes, opts);
    const b = await convert(bytes, opts);
    expect(Buffer.from(a.bytes).equals(Buffer.from(b.bytes))).toBe(true);
  });

  it('lets a StepError from the reader through unchanged', async () => {
    const err = await convert(new Uint8Array(readFileSync(NOT_STEP)), opts).catch((e) => e);
    expect(err).toBeInstanceOf(StepError);
    expect(err.code).toBe('NOT_STEP');
  });
});
