import { describe, expect, it } from 'vitest';
import { buildScene, linearToSrgb } from '../src/scene.js';

/** Unit cube with 24 vertices (4 per face, as OCCT emits) and 12 triangles. */
function cube24(size = 1) {
  const s = size;
  const faces = [
    [[0, 0, 0], [0, s, 0], [s, s, 0], [s, 0, 0]], // -z
    [[0, 0, s], [s, 0, s], [s, s, s], [0, s, s]], // +z
    [[0, 0, 0], [s, 0, 0], [s, 0, s], [0, 0, s]], // -y
    [[0, s, 0], [0, s, s], [s, s, s], [s, s, 0]], // +y
    [[0, 0, 0], [0, 0, s], [0, s, s], [0, s, 0]], // -x
    [[s, 0, 0], [s, s, 0], [s, s, s], [s, 0, s]], // +x
  ];
  /** @type {number[]} */
  const position = [];
  /** @type {number[]} */
  const index = [];
  faces.forEach((f, i) => {
    for (const p of f) position.push(...p);
    const b = i * 4;
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return { position, index };
}

/** @param {string} name @param {{position:number[], index:number[]}} g @param {number[]=} color */
function mesh(name, g = cube24(), color) {
  const m = { name, attributes: { position: { array: g.position } }, index: { array: g.index }, brep_faces: [] };
  return color ? { ...m, color } : m;
}
/** @typedef {import('../src/scene.js').OcctNode} OcctNode */
/** @param {string} name @param {number[]=} meshes @param {OcctNode[]=} children @returns {OcctNode} */
const node = (name, meshes = [], children = []) => ({ name, meshes, children });
/** @param {OcctNode} root @param {any[]} meshes */
const result = (root, meshes) => ({ success: true, root, meshes });

describe('linearToSrgb', () => {
  it.each([
    [0.6038273572921753, 'CC'],
    [0.4019778072834015, 'AA'],
    [0.21223075687885284, '7F'],
    [0, '00'],
    [1, 'FF'],
    [0.0031308, '0A'], // knee: 12.92 * 0.0031308 * 255 = 10.3
    [0.0031309, '0A'], // just above the knee, power branch: ~10.3
    [-0.5, '00'],
    [1.5, 'FF'],
    [1.0000001, 'FF'],
  ])('%s -> %s', (c, hex) => {
    expect(linearToSrgb(c)).toBe(hex);
  });
  it('rounds half up', () => {
    // 0.5 sRGB-encoded value 127.5 -> 128 (0x80): linear value of sRGB 127.5/255
    const c = Math.pow((127.5 / 255 + 0.055) / 1.055, 2.4);
    expect(linearToSrgb(c)).toBe('80');
  });
});

describe('buildScene names', () => {
  it('uses the nearest non-empty ancestor name', () => {
    const r = result(node('ROOT', [], [node('', [], [node('MID', [], [node('', [0])])])]), [mesh('m')]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['MID']);
  });
  it('uses the owner node name before the root name', () => {
    const r = result(node('ROOT', [], [node('LEAF', [0])]), [mesh('m')]);
    expect(buildScene(r).scene.parts[0].name).toBe('LEAF');
  });
  it('falls back to the mesh name when the whole path is empty', () => {
    const r = result(node('', [], [node('', [0])]), [mesh('Body')]);
    expect(buildScene(r).scene.parts[0].name).toBe('Body');
  });
  it('ignores the STEP placeholder SOLID and empty mesh names, numbering Part N', () => {
    const r = result(node('', [0, 1]), [mesh('SOLID'), mesh('')]);
    const r2 = result(node('', [], [node('', [0]), node('', [1])]), [mesh('SOLID'), mesh('')]);
    expect(buildScene(r2).scene.parts.map((p) => p.name)).toEqual(['Part 1', 'Part 2']);
    // two meshes on one node, both unnamed: still suffixed on the Part N base? base is Part N per output position
    expect(buildScene(r).scene.parts).toHaveLength(2);
  });
  it('suffixes (k) when one node owns several meshes', () => {
    const r = result(node('ASM', [0, 1, 2]), [mesh('SOLID'), mesh('SOLID'), mesh('SOLID')]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['ASM (1)', 'ASM (2)', 'ASM (3)']);
  });
  it('names several meshes on one node by their own names, suffixing only repeats', () => {
    // The shape of Adafruit's 1586 NeoPixel ring: OCCT puts the board, LEDs and resistor under one node.
    const r = result(node('PCB Component', [0, 1, 2, 3, 4]), [
      mesh('Board'), mesh('WS2812B-NARROW'), mesh('WS2812B-NARROW'), mesh('0603-NO'), mesh('WS2812B-NARROW'),
    ]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual([
      'Board', 'WS2812B-NARROW (1)', 'WS2812B-NARROW (2)', '0603-NO', 'WS2812B-NARROW (3)',
    ]);
  });
  it('falls back to the node name for unnamed meshes among named ones', () => {
    const r = result(node('ASM', [0, 1, 2]), [mesh('Pin'), mesh('SOLID'), mesh('')]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['Pin', 'ASM (1)', 'ASM (2)']);
  });
  it('numbers unnamed meshes on an unnamed node Part N, without a suffix', () => {
    const r = result(node('', [0, 1]), [mesh('SOLID'), mesh('')]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['Part 1', 'Part 2']);
  });
  it('keeps the node name for a single mesh even when the mesh has its own', () => {
    const r = result(node('LEAF', [0]), [mesh('Body')]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['LEAF']);
  });
  it('keeps names verbatim', () => {
    const name = '  A & <B> "C" ';
    const r = result(node(name, [0]), [mesh('x')]);
    expect(buildScene(r).scene.parts[0].name).toBe(name);
  });
  it('does not rename two different nodes with the same name', () => {
    const r = result(node('', [], [node('Twin', [0]), node('Twin', [1])]), [mesh('a'), mesh('b')]);
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['Twin', 'Twin']);
  });
  it('orders depth-first, own meshes before children', () => {
    const r = result(
      node('R', [2], [node('A', [0], [node('A1', [1])]), node('B', [3])]),
      [mesh('a'), mesh('a1'), mesh('r'), mesh('b')],
    );
    expect(buildScene(r).scene.parts.map((p) => p.name)).toEqual(['R', 'A', 'A1', 'B']);
  });
});

describe('buildScene geometry', () => {
  it('welds a 24-vertex cube to 8 vertices and 12 triangles', () => {
    const { scene, warnings } = buildScene(result(node('C', [0]), [mesh('c')]));
    const p = scene.parts[0];
    expect(p.positions).toBeInstanceOf(Float64Array);
    expect(p.triangles).toBeInstanceOf(Uint32Array);
    expect(p.positions.length / 3).toBe(8);
    expect(p.triangles.length / 3).toBe(12);
    expect(p.faceColors).toBeNull();
    expect(warnings).toEqual([]);
  });
  it('does not weld across parts', () => {
    const { scene } = buildScene(result(node('', [], [node('A', [0]), node('B', [1])]), [mesh('a'), mesh('b')]));
    expect(scene.parts.map((p) => p.positions.length / 3)).toEqual([8, 8]);
  });
  it('treats 0 and -0 as the same coordinate and writes +0', () => {
    // Choice: exact numeric equality, where 0 === -0. Output normalises -0 to +0.
    const g = { position: [0, 0, 0, -0, 0, 0, 1, 0, 0, 0, 1, 0], index: [0, 2, 3, 1, 2, 3] };
    const p = buildScene(result(node('Z', [0]), [mesh('z', g)])).scene.parts[0];
    expect(p.positions.length / 3).toBe(3);
    expect(Object.is(p.positions[0], 0)).toBe(true);
    expect([...p.positions].every((v) => !Object.is(v, -0))).toBe(true);
    // the two triangles became identical after welding, both are kept (not degenerate)
    expect(p.triangles.length / 3).toBe(2);
  });
  it('does not weld coordinates that differ in the last bit', () => {
    const e = 1 + Number.EPSILON;
    const g = { position: [1, 0, 0, e, 0, 0, 0, 1, 0], index: [0, 1, 2] };
    const p = buildScene(result(node('E', [0]), [mesh('e', g)])).scene.parts[0];
    expect(p.positions.length / 3).toBe(3);
  });
  it('drops degenerate triangles after welding', () => {
    const g = { position: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], index: [0, 1, 2, 0, 1, 3] };
    const p = buildScene(result(node('D', [0]), [mesh('d', g)])).scene.parts[0];
    expect(p.triangles.length / 3).toBe(1);
  });
  it('drops a zero-area triangle with repeated indices', () => {
    const g = { position: [0, 0, 0, 1, 0, 0, 0, 1, 0], index: [0, 1, 2, 1, 1, 2] };
    const p = buildScene(result(node('D', [0]), [mesh('d', g)])).scene.parts[0];
    expect(p.triangles.length / 3).toBe(1);
  });
  it('skips an empty mesh with a count warning', () => {
    const empty = mesh('e', { position: [], index: [] });
    const { scene, warnings } = buildScene(result(node('', [], [node('E', [0]), node('C', [1])]), [empty, mesh('c')]));
    expect(scene.parts.map((p) => p.name)).toEqual(['C']);
    expect(warnings).toContain('skipped 1 part(s) with no triangles');
  });
  it('counts a mesh whose triangles all degenerate as having no triangles', () => {
    const g = { position: [0, 0, 0, 1, 0, 0], index: [0, 0, 1] };
    const { scene, warnings } = buildScene(result(node('D', [0]), [mesh('d', g)]));
    expect(scene.parts).toEqual([]);
    expect(warnings).toContain('skipped 1 part(s) with no triangles');
  });
  it('drops a part with NaN or Infinity coordinates and warns', () => {
    const bad = { position: [0, 0, NaN, 1, 0, 0, 0, 1, 0], index: [0, 1, 2] };
    const inf = { position: [0, 0, 0, Infinity, 0, 0, 0, 1, 0], index: [0, 1, 2] };
    const { scene, warnings } = buildScene(
      result(node('', [], [node('Bad "one"', [0]), node('Inf', [1]), node('Ok', [2])]), [mesh('a', bad), mesh('b', inf), mesh('c')]),
    );
    expect(scene.parts.map((p) => p.name)).toEqual(['Ok']);
    expect(warnings).toContain('skipped "Bad "one"": coordinates are not finite numbers');
    expect(warnings).toContain('skipped "Inf": coordinates are not finite numbers');
  });
  it('keeps huge coordinates unchanged', () => {
    const { scene } = buildScene(result(node('H', [0]), [mesh('h', cube24(1e9))]));
    const p = scene.parts[0];
    expect(Math.max(...p.positions)).toBe(1e9);
    expect(Math.min(...p.positions)).toBe(0);
  });
  it('warns on an open mesh with the open edge count', () => {
    const g = { position: [0, 0, 0, 1, 0, 0, 0, 1, 0], index: [0, 1, 2] };
    const { warnings } = buildScene(result(node('Tri', [0]), [mesh('t', g)]));
    expect(warnings).toContain('"Tri" is not watertight (3 open edges); a slicer may need to repair it');
  });
  it('does not warn about a closed cube', () => {
    expect(buildScene(result(node('C', [0]), [mesh('c')])).warnings).toEqual([]);
  });
});

describe('buildScene colors', () => {
  it('converts linear mesh color to #RRGGBB, null when absent', () => {
    const r = result(node('', [], [node('A', [0]), node('B', [1])]), [
      mesh('a', cube24(), [0.6038273572921753, 0.4019778072834015, 0.21223075687885284]),
      mesh('b'),
    ]);
    const parts = buildScene(r).scene.parts;
    expect(parts[0].color).toBe('#CCAA7F');
    expect(parts[1].color).toBeNull();
  });
});

/**
 * A 12-triangle cube mesh with B-rep face ranges (triangle indices, inclusive) and an optional mesh color.
 * @param {{ first: number, last: number, color?: number[] | null }[]} faces
 * @param {number[]=} color
 */
function meshWithFaces(faces, color) {
  return { ...mesh('f', cube24(), color), brep_faces: faces };
}

const RED = [1, 0, 0];
const BLUE = [0, 0, 1];
const GREEN = [0, 1, 0];
const WHITE = [1, 1, 1];

describe('buildScene face colors (core-002)', () => {
  it('maps each face range onto its triangles, inclusive at both ends', () => {
    const faces = [
      { first: 0, last: 1, color: RED },
      { first: 2, last: 11, color: BLUE },
    ];
    const p = buildScene(result(node('C', [0]), [meshWithFaces(faces, WHITE)])).scene.parts[0];
    expect(p.color).toBe('#FFFFFF');
    expect(p.faceColors).toEqual([...Array(2).fill('#FF0000'), ...Array(10).fill('#0000FF')]);
  });

  it('carries a face color with its triangle when a degenerate triangle is dropped', () => {
    // Triangle 1 is (a, a, b): degenerate, so the weld drops it. Triangle 2 must keep the green face.
    const g = { position: [0, 0, 0, 1, 0, 0, 0, 1, 0], index: [0, 1, 2, 0, 0, 1, 0, 1, 2] };
    const faces = [
      { first: 0, last: 0, color: RED },
      { first: 1, last: 1, color: BLUE },
      { first: 2, last: 2, color: GREEN },
    ];
    const m = { name: 'd', attributes: { position: { array: g.position } }, index: { array: g.index }, brep_faces: faces, color: WHITE };
    const p = buildScene(result(node('D', [0]), [m])).scene.parts[0];
    expect(p.triangles.length).toBe(6);
    expect(p.faceColors).toEqual(['#FF0000', '#00FF00']);
  });

  it('resolves a face to its own color, then the mesh color', () => {
    const faces = [
      { first: 0, last: 0, color: RED },
      { first: 1, last: 11, color: null },
    ];
    const p = buildScene(result(node('C', [0]), [meshWithFaces(faces, WHITE)])).scene.parts[0];
    expect(p.faceColors?.slice(0, 2)).toEqual(['#FF0000', '#FFFFFF']);
  });

  it('falls back to #808080 for null faces when the mesh has no color but some face does', () => {
    const faces = [
      { first: 0, last: 0, color: RED },
      { first: 1, last: 11, color: null },
    ];
    const p = buildScene(result(node('C', [0]), [meshWithFaces(faces)])).scene.parts[0];
    // #808080 covers 11 triangles against red's 1, so it becomes the object default.
    expect(p.color).toBe('#808080');
    expect(p.faceColors?.[0]).toBe('#FF0000');
    expect(p.faceColors?.[1]).toBe('#808080');
  });

  it('leaves a part with no face colors and no mesh color uncolored', () => {
    const faces = [{ first: 0, last: 11, color: null }];
    const p = buildScene(result(node('C', [0]), [meshWithFaces(faces)])).scene.parts[0];
    expect(p.color).toBeNull();
    expect(p.faceColors).toBeNull();
  });

  it('picks the most-covered resolved color as the default when the mesh has no color', () => {
    const faces = [
      { first: 0, last: 1, color: RED },
      { first: 2, last: 11, color: BLUE },
    ];
    const p = buildScene(result(node('C', [0]), [meshWithFaces(faces)])).scene.parts[0];
    expect(p.color).toBe('#0000FF');
    expect(p.faceColors?.slice(0, 2)).toEqual(['#FF0000', '#FF0000']);
  });

  it('breaks a coverage tie toward the earliest face', () => {
    const faces = [
      { first: 0, last: 5, color: RED },
      { first: 6, last: 11, color: BLUE },
    ];
    const p = buildScene(result(node('C', [0]), [meshWithFaces(faces)])).scene.parts[0];
    expect(p.color).toBe('#FF0000');
    expect(p.faceColors?.[6]).toBe('#0000FF');
  });

  it('keeps faceColors null when every triangle resolves to the object color', () => {
    const red = [{ first: 0, last: 11, color: RED }];
    expect(buildScene(result(node('C', [0]), [meshWithFaces(red)])).scene.parts[0].faceColors).toBeNull();
    const nulls = [{ first: 0, last: 11, color: null }];
    expect(buildScene(result(node('C', [0]), [meshWithFaces(nulls, WHITE)])).scene.parts[0].faceColors).toBeNull();
  });

  it('clamps a face range past the triangle count and warns', () => {
    const faces = [{ first: 10, last: 50, color: RED }];
    const { scene, warnings } = buildScene(result(node('C', [0]), [meshWithFaces(faces, WHITE)]));
    expect(scene.parts[0].faceColors?.slice(10)).toEqual(['#FF0000', '#FF0000']);
    expect(warnings.some((w) => w.includes('clamped'))).toBe(true);
  });

  it('ignores an empty face (first greater than last)', () => {
    const faces = [{ first: 5, last: 4, color: RED }];
    const { scene, warnings } = buildScene(result(node('C', [0]), [meshWithFaces(faces, WHITE)]));
    expect(scene.parts[0].faceColors).toBeNull();
    expect(warnings).toEqual([]);
  });
});

describe('buildScene groups (core-003)', () => {
  /** @param {string} name */
  const tri = (name) => mesh(name);
  const empty = () => mesh('e', { position: [], index: [] });

  it('groups a named node with two part descendants, and its root is that group', () => {
    const r = result(node('', [], [node('ASM', [], [node('', [0]), node('', [1])])]), [tri('a'), tri('b')]);
    const { scene } = buildScene(r);
    expect(scene.groups).toEqual([{ name: 'ASM', children: [{ part: 0 }, { part: 1 }] }]);
    expect(scene.roots).toEqual([{ group: 0 }]);
  });

  it('leaves a node with one part descendant ungrouped, so its name stays on the part', () => {
    const r = result(node('', [], [node('LEAF', [0])]), [tri('m')]);
    const { scene } = buildScene(r);
    expect(scene.groups).toEqual([]);
    expect(scene.roots).toEqual([{ part: 0 }]);
    expect(scene.parts[0].name).toBe('LEAF');
  });

  it('never makes the unnamed root a group: its direct parts become roots', () => {
    const r = result(node('', [0, 1]), [tri('a'), tri('b')]);
    const { scene } = buildScene(r);
    expect(scene.groups).toEqual([]);
    expect(scene.roots).toEqual([{ part: 0 }, { part: 1 }]);
  });

  it('nests a named group inside a named group, children in depth-first order', () => {
    const r = result(
      node('TOP', [], [node('SUB', [], [node('', [0]), node('', [1])]), node('', [2])]),
      [tri('a'), tri('b'), tri('c')],
    );
    const { scene } = buildScene(r);
    expect(scene.groups).toEqual([
      { name: 'SUB', children: [{ part: 0 }, { part: 1 }] },
      { name: 'TOP', children: [{ group: 0 }, { part: 2 }] },
    ]);
    expect(scene.roots).toEqual([{ group: 1 }]);
  });

  it('names a group after the nearest non-empty ancestor, and falls back to Assembly N', () => {
    const named = result(node('', [], [node('OUTER', [], [node('', [], [node('', [0]), node('', [1])])])]), [tri('a'), tri('b')]);
    expect(buildScene(named).scene.groups[0].name).toBe('OUTER');
    const anon = result(node('', [], [node('', [], [node('', [0]), node('', [1])])]), [tri('a'), tri('b')]);
    expect(buildScene(anon).scene.groups[0].name).toBe('Assembly 1');
  });

  it('drops a node whose parts are all skipped, so it never becomes an empty group', () => {
    const r = result(node('', [], [node('GONE', [], [node('', [0]), node('', [1])]), node('ONE', [2])]), [empty(), empty(), tri('c')]);
    const { scene, warnings } = buildScene(r);
    expect(scene.groups).toEqual([]);
    expect(scene.roots).toEqual([{ part: 0 }]);
    expect(warnings).toContain('skipped 2 part(s) with no triangles');
  });

  it('does not count a skipped part toward the two-part threshold', () => {
    const r = result(node('', [], [node('PAIR', [], [node('', [0]), node('', [1])])]), [empty(), tri('b')]);
    const { scene } = buildScene(r);
    expect(scene.groups).toEqual([]);
    expect(scene.roots).toEqual([{ part: 0 }]);
  });

  it('handles five levels of nesting, each level a group with its own part', () => {
    /** @param {number} level */
    /** @type {(level: number) => OcctNode} */
    const chain = (level) => (level === 5 ? node('L5', [level - 1]) : node(`L${level}`, [level - 1], [chain(level + 1)]));
    const meshes = [tri('1'), tri('2'), tri('3'), tri('4'), tri('5')];
    const { scene } = buildScene(result(node('', [], [chain(1)]), meshes));
    expect(scene.parts).toHaveLength(5);
    expect(scene.groups.map((g) => g.name)).toEqual(['L4', 'L3', 'L2', 'L1']);
    expect(scene.groups[0].children).toEqual([{ part: 3 }, { part: 4 }]);
    expect(scene.groups[3].children).toEqual([{ part: 0 }, { group: 2 }]);
    expect(scene.roots).toEqual([{ group: 3 }]);
  });

  it('a single-part file has no groups and its root is that one part (M1 shape)', () => {
    const { scene } = buildScene(result(node('', [0]), [tri('m')]));
    expect(scene.groups).toEqual([]);
    expect(scene.roots).toEqual([{ part: 0 }]);
  });
});
