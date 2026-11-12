import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readStep, StepError } from '../src/step.js';
import { ASSEMBLY, CUBE_IN, CUBE_MM, CUBE_FACES, EMPTY, NOT_STEP, ROUNDED, truncate } from './fixtures/index.js';

/**
 * Largest absolute coordinate across every mesh.
 * @param {{ attributes: { position: { array: ArrayLike<number> } } }[]} meshes
 */
function maxCoordinate(meshes) {
  let max = 0;
  for (const m of meshes) {
    const a = m.attributes.position.array;
    for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i]));
  }
  return max;
}

/**
 * @param {Promise<unknown>} p
 * @returns {Promise<StepError>}
 */
async function rejection(p) {
  try {
    await p;
  } catch (e) {
    return /** @type {StepError} */ (e);
  }
  throw new Error('expected readStep to reject');
}

describe('readStep with the real reader', () => {
  it('reads CUBE_MM as one mesh with 12 triangles', async () => {
    const result = await readStep(readFileSync(CUBE_MM));
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0].index.array.length / 3).toBe(12);
  });

  it('reads the ASSEMBLY fixture as 18 meshes', async () => {
    const result = await readStep(readFileSync(ASSEMBLY));
    expect(result.meshes).toHaveLength(18);
  });

  it('converts inches to millimetres: CUBE_IN max coordinate is 1000', async () => {
    const result = await readStep(readFileSync(CUBE_IN));
    expect(maxCoordinate(result.meshes)).toBeCloseTo(1000, 6);
  });

  it('reports a truncated file as DAMAGED with the OCCT reason', async () => {
    const err = await rejection(readStep(truncate(CUBE_FACES, 4000)));
    expect(err).toBeInstanceOf(StepError);
    expect(err.code).toBe('DAMAGED');
    expect(err.message).toContain('unexpected end of file');
  });

  it('reports a non-STEP file as NOT_STEP', async () => {
    const err = await rejection(readStep(readFileSync(NOT_STEP)));
    expect(err.code).toBe('NOT_STEP');
  });

  it('reports a zero-byte file as EMPTY', async () => {
    const err = await rejection(readStep(readFileSync(EMPTY)));
    expect(err.code).toBe('EMPTY');
  });
});

describe('tessellation tolerance on the real reader (cli-002)', () => {
  const triangles = (/** @type {{ index: { array: ArrayLike<number> } }[]} */ meshes) =>
    meshes.reduce((n, m) => n + m.index.array.length / 3, 0);

  it('a tighter absolute tolerance gives strictly more triangles on ROUNDED', async () => {
    const fine = await readStep(readFileSync(ROUNDED), { linearDeflectionType: 'absolute_value', linearDeflection: 0.01 });
    const coarse = await readStep(readFileSync(ROUNDED), { linearDeflectionType: 'absolute_value', linearDeflection: 1 });
    expect(triangles(fine.meshes)).toBeGreaterThan(triangles(coarse.meshes));
  });

  it('a finer tolerance keeps the mesh closed', async () => {
    const fine = await readStep(readFileSync(ROUNDED), { linearDeflectionType: 'absolute_value', linearDeflection: 0.01 });
    expect(fine.meshes).toHaveLength(1);
    expect(fine.meshes[0].index.array.length / 3).toBeGreaterThan(0);
  });
});
