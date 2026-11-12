import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ASSEMBLY, CUBE_FACES, CUBE_FACES_ALL, CUBE_MM, ROUNDED } from './fixtures/index.js';
import { meshStats } from './helpers/read3mf.js';
import { buildScene } from '../src/scene.js';

const require = createRequire(import.meta.url);
/** @type {any} */
let occt;
beforeAll(async () => {
  occt = await require('occt-import-js')();
});

/** @param {string} path */
const scene = (path) => buildScene(occt.ReadStepFile(new Uint8Array(readFileSync(path)), null));

/** @param {{ positions: Float64Array, triangles: Uint32Array }} part */
function stats(part) {
  const vertices = [];
  for (let i = 0; i < part.positions.length; i += 3) vertices.push([part.positions[i], part.positions[i + 1], part.positions[i + 2]]);
  const triangles = [];
  for (let i = 0; i < part.triangles.length; i += 3) triangles.push({ v: [part.triangles[i], part.triangles[i + 1], part.triangles[i + 2]] });
  return meshStats({ vertices, triangles });
}

describe('buildScene on real STEP files', () => {
  it.each([
    ['CUBE_MM', CUBE_MM],
    ['ROUNDED', ROUNDED],
    ['ASSEMBLY', ASSEMBLY],
  ])('%s: every part is closed and outward-wound after exact welding', (_n, path) => {
    const { scene: s, warnings } = scene(path);
    expect(s.parts.length).toBeGreaterThan(0);
    for (const part of s.parts) {
      const st = stats(part);
      expect(st.openEdges, part.name).toBe(0);
      expect(st.signedVolume, part.name).toBeGreaterThan(0);
    }
    expect(warnings).toEqual([]);
  });

  it('CUBE_MM is one part named Cube, #CCCCCC', () => {
    const { parts } = scene(CUBE_MM).scene;
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Cube');
    expect(parts[0].color).toBe('#CCCCCC');
    expect(stats(parts[0]).signedVolume).toBeCloseTo(1e9, 0);
  });

  it('ROUNDED welds 98 vertices to 44', () => {
    const { parts } = scene(ROUNDED).scene;
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe('Body');
    expect(parts[0].positions.length / 3).toBe(44);
  });

  it('ASSEMBLY names follow the suffix rule and PLATE is #00FF00', () => {
    const { parts } = scene(ASSEMBLY).scene;
    expect(parts).toHaveLength(18);
    const names = parts.map((p) => p.name);
    for (let k = 1; k <= 7; k++) expect(names).toContain(`L_BRACKET_ASSEMBLY_ASM (${k})`);
    expect(names.filter((n) => n.startsWith('L_BRACKET_ASSEMBLY_ASM ('))).toHaveLength(14);
    expect(names.filter((n) => n.startsWith('ROD_ASM ('))).toHaveLength(3);
    const plate = parts.find((p) => p.name === 'PLATE');
    expect(plate?.color).toBe('#00FF00');
    expect(names.some((n) => n === 'SOLID')).toBe(false);
  });

  it('CUBE_FACES: object default #CCCCCC, faces red/blue/green on 2 triangles each, nulls follow the default', () => {
    const [part] = scene(CUBE_FACES).scene.parts;
    const C = '#CCCCCC';
    expect(part.color).toBe(C);
    expect(part.faceColors).toEqual([
      '#FF0000', '#FF0000', C, C, C, C,
      '#0000FF', '#0000FF', C, C,
      '#00AA00', '#00AA00',
    ]);
  });

  it('CUBE_FACES_ALL: six distinct face colors, none equal to the #CCCCCC object default', () => {
    const [part] = scene(CUBE_FACES_ALL).scene.parts;
    expect(part.faceColors).toHaveLength(12);
    const distinct = new Set(part.faceColors);
    expect(distinct.size).toBe(6);
    expect(distinct.has(part.color)).toBe(false);
  });
});

describe('buildScene groups on the ASSEMBLY fixture (core-003)', () => {
  it('AS1_PE_ASM is the one root group, with PLATE, two L_BRACKET groups of 7 and a ROD_ASM group of 3', () => {
    const { scene: s } = scene(ASSEMBLY);
    expect(s.roots).toHaveLength(1);
    const root = s.roots[0];
    if (!('group' in root)) throw new Error('top level is not a group');
    const top = s.groups[root.group];
    expect(top.name).toBe('AS1_PE_ASM');
    expect(top.children).toHaveLength(4);
    const byName = (/** @type {string} */ name) => s.groups.filter((g) => g.name === name);
    expect(byName('L_BRACKET_ASSEMBLY_ASM')).toHaveLength(2);
    for (const g of byName('L_BRACKET_ASSEMBLY_ASM')) expect(g.children).toHaveLength(7);
    expect(byName('ROD_ASM')).toHaveLength(1);
    expect(byName('ROD_ASM')[0].children).toHaveLength(3);
  });

  it('every part is reachable from the roots exactly once', () => {
    const { scene: s } = scene(ASSEMBLY);
    /** @type {number[]} */
    const seen = [];
    /** @param {import('../src/scene.js').Ref} ref */
    const walk = (ref) => {
      if ('part' in ref) seen.push(ref.part);
      else for (const c of s.groups[ref.group].children) walk(c);
    };
    s.roots.forEach(walk);
    expect(seen.slice().sort((a, b) => a - b)).toEqual(s.parts.map((_, i) => i));
  });
});
