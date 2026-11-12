import { execFileSync } from 'node:child_process';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { write3mf } from '../src/threemf.js';
import { read3mf } from './helpers/read3mf.js';

const APP = 'step23mf 0.1.0';

/**
 * A part with a flat triangle strip: `n` triangles, each on its own three vertices.
 * @param {string} name
 * @param {string | null} color
 * @param {number} n
 */
function part(name, color, n = 1) {
  const positions = new Float64Array(n * 9);
  for (let i = 0; i < n * 9; i++) positions[i] = (i % 7) * 1.5 + Math.floor(i / 9);
  const triangles = new Uint32Array(n * 3);
  for (let i = 0; i < n * 3; i++) triangles[i] = i;
  return { name, color, positions, triangles, faceColors: null };
}

describe('write3mf: package layout', () => {
  it('writes entries in the specified order', () => {
    const { entries } = read3mf(write3mf({ parts: [part('Cube', '#CCCCCC')] }, { application: APP }));
    expect(entries).toEqual(['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']);
  });

  it('writes the exact content-type and relationship strings', () => {
    const files = unzipSync(write3mf({ parts: [part('Cube', null)] }, { application: APP }));
    const ct = strFromU8(files['[Content_Types].xml']);
    const rels = strFromU8(files['_rels/.rels']);
    expect(ct).toContain(
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    );
    expect(ct).toContain(
      '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>',
    );
    expect(rels).toContain('Target="/3D/3dmodel.model"');
    expect(rels).toContain('Id="rel0"');
    expect(rels).toContain('Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"');
  });

  it('declares millimetres and the application metadata', () => {
    const pkg = read3mf(write3mf({ parts: [part('Cube', '#CCCCCC')] }, { application: APP }));
    expect(pkg.unit).toBe('millimeter');
    expect(pkg.metadata).toEqual({ Application: APP });
  });

  it('gives each part an object with the scene name, starting at id 2, and one build item', () => {
    const pkg = read3mf(
      write3mf({ parts: [part('A', null), part('B', null), part('C', null)] }, { application: APP }),
    );
    expect(pkg.objects.map((o) => [o.id, o.name, o.type])).toEqual([
      [2, 'A', 'model'],
      [3, 'B', 'model'],
      [4, 'C', 'model'],
    ]);
    expect(pkg.build).toEqual([{ objectid: 2 }, { objectid: 3 }, { objectid: 4 }]);
  });

  it('writes vertex and triangle counts that match the scene', () => {
    const pkg = read3mf(write3mf({ parts: [part('Cube', null, 5)] }, { application: APP }));
    expect(pkg.objects[0].vertices).toHaveLength(15);
    expect(pkg.objects[0].triangles).toHaveLength(5);
    expect(pkg.objects[0].triangles[0].v).toEqual([0, 1, 2]);
  });
});

describe('write3mf: colors', () => {
  it('dedupes colors into one basematerials group, in first-use order', () => {
    const pkg = read3mf(
      write3mf(
        { parts: [part('A', '#FF0000'), part('B', '#00FF00'), part('C', '#FF0000')] },
        { application: APP },
      ),
    );
    expect(pkg.materials).toEqual([
      {
        id: 1,
        bases: [
          { name: '#FF0000', displaycolor: '#FF0000' },
          { name: '#00FF00', displaycolor: '#00FF00' },
        ],
      },
    ]);
    expect(pkg.objects.map((o) => [o.pid, o.pindex])).toEqual([
      [1, 0],
      [1, 1],
      [1, 0],
    ]);
  });

  it('leaves a part with no color without pid or pindex', () => {
    const pkg = read3mf(write3mf({ parts: [part('A', '#FF0000'), part('B', null)] }, { application: APP }));
    expect(pkg.objects[1].pid).toBeUndefined();
    expect(pkg.objects[1].pindex).toBeUndefined();
  });

  it('omits the basematerials group when no part has a color', () => {
    const pkg = read3mf(write3mf({ parts: [part('A', null), part('B', null)] }, { application: APP }));
    expect(pkg.materials).toEqual([]);
  });
});

describe('write3mf: names and numbers', () => {
  it('escapes XML special characters in names and round-trips them exactly', () => {
    const name = 'A & <B> "C" \'D\'';
    const pkg = read3mf(write3mf({ parts: [part(name, null)] }, { application: APP }));
    expect(pkg.objects[0].name).toBe(name);
  });

  it('drops control characters that XML 1.0 forbids, and nothing else', () => {
    const pkg = read3mf(write3mf({ parts: [part('Ca\u0001b', null)] }, { application: APP }));
    expect(pkg.objects[0].name).toBe('Cab');
  });

  it('writes -0 as 0 and refuses NaN', () => {
    const p = part('A', null);
    p.positions[0] = -0;
    const bytes = write3mf({ parts: [p] }, { application: APP });
    const model = strFromU8(unzipSync(bytes)['3D/3dmodel.model']);
    expect(model).toContain('<vertex x="0" y="1.5" z="3"/>');
    expect(model).not.toContain('-0');

    const bad = part('A', null);
    bad.positions[0] = Number.NaN;
    expect(() => write3mf({ parts: [bad] }, { application: APP })).toThrow();
  });

  it('throws when the scene has no parts', () => {
    expect(() => write3mf({ parts: [] }, { application: APP })).toThrow();
  });
});

describe('write3mf: determinism', () => {
  it('gives identical bytes on two calls', () => {
    const scene = { parts: [part('A', '#FF0000', 3), part('B', null, 2)] };
    const a = write3mf(scene, { application: APP });
    const b = write3mf(scene, { application: APP });
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('gives the same bytes under different time zones', () => {
    const script = `
      import { write3mf } from ${JSON.stringify(new URL('../src/threemf.js', import.meta.url).href)};
      const p = { name: 'Cube', color: '#CCCCCC', positions: new Float64Array([0,0,0,1,0,0,0,1,0]),
                  triangles: new Uint32Array([0,1,2]), faceColors: null };
      process.stdout.write(Buffer.from(write3mf({ parts: [p] }, { application: 'step23mf 0.1.0' })).toString('hex'));`;
    const run = (/** @type {string} */ tz) =>
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        env: { ...process.env, TZ: tz },
        encoding: 'utf8',
      });
    expect(run('UTC')).toBe(run('Pacific/Kiritimati'));
    expect(run('UTC')).toBe(run('America/Los_Angeles'));
  });
});

describe('write3mf: scale', () => {
  it('writes a 1e5-triangle scene in under 2 seconds', () => {
    const scene = { parts: [part('Big', '#808080', 100_000)] };
    const t0 = performance.now();
    const bytes = write3mf(scene, { application: APP });
    const ms = performance.now() - t0;
    expect(bytes.length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(2000);
  });
});

/** The model XML text of a written 3MF. @param {Uint8Array} bytes */
const modelText = (bytes) => strFromU8(unzipSync(bytes)['3D/3dmodel.model']);

/**
 * A part with one triangle per entry of `faceColors`, so triangle k carries `faceColors[k]`.
 * @param {string} name @param {string | null} color @param {(string | null)[]} faceColors
 */
function facedPart(name, color, faceColors) {
  const n = faceColors.length;
  const p = part(name, color, n);
  return { ...p, faceColors };
}

describe('write3mf: per-face colors (core-002)', () => {
  it('writes p1 only on triangles whose color differs from the object color', () => {
    const xml = modelText(write3mf({ parts: [facedPart('Cube', '#CCCCCC', ['#FF0000', '#CCCCCC', '#0000FF'])] }, { application: APP }));
    expect(xml).toMatch(/<triangle v1="0" v2="1" v3="2" pid="1" p1="\d+"\/>/);
    expect(xml).toContain('<triangle v1="3" v2="4" v3="5"/>');
    expect(xml).toContain('<triangle v1="6" v2="7" v3="8" pid="1" p1="');
  });

  it('adds face colors to the basematerials group in first-use order, deduplicated', () => {
    const scene = {
      parts: [
        facedPart('A', '#CCCCCC', ['#FF0000', '#0000FF']),
        facedPart('B', '#00FF00', ['#FF0000', '#CCCCCC']),
      ],
    };
    const xml = modelText(write3mf(scene, { application: APP }));
    const bases = [...xml.matchAll(/<base name="(#[0-9A-F]{6})"/g)].map((m) => m[1]);
    expect(bases).toEqual(['#CCCCCC', '#FF0000', '#0000FF', '#00FF00']);
    // Object A's red triangle is index 1 in the table: 0 = #CCCCCC, 1 = #FF0000.
    expect(xml).toContain('<triangle v1="0" v2="1" v3="2" pid="1" p1="1"/>');
  });

  it('writes byte-identical output when faceColors are all null', () => {
    const plain = write3mf({ parts: [part('Cube', '#CCCCCC', 2)] }, { application: APP });
    const explicit = write3mf({ parts: [{ ...part('Cube', '#CCCCCC', 2), faceColors: null }] }, { application: APP });
    expect(explicit).toEqual(plain);
  });
});

describe('write3mf: groups as component objects (core-003)', () => {
  /** @param {ReturnType<typeof part>[]} parts */
  const flat = (parts) => ({ parts, groups: [], roots: parts.map((_, i) => ({ part: i })) });

  it('a flat scene without groups or roots writes the same bytes as an explicit flat scene', () => {
    const parts = [part('A', '#FF0000'), part('B', null)];
    const implicit = write3mf({ parts }, { application: APP });
    const explicit = write3mf(flat(parts), { application: APP });
    expect(Buffer.from(explicit).equals(Buffer.from(implicit))).toBe(true);
  });

  it('writes one component object per group, after every mesh object, in post-order', () => {
    const parts = [part('A', null), part('B', null), part('C', null)];
    const scene = {
      parts,
      groups: [
        { name: 'INNER', children: [{ part: 0 }, { part: 1 }] },
        { name: 'OUTER', children: [{ group: 0 }, { part: 2 }] },
      ],
      roots: [{ group: 1 }],
    };
    const pkg = read3mf(write3mf(scene, { application: APP }));
    const ids = pkg.objects.map((o) => o.id);
    expect(ids).toEqual([2, 3, 4, 5, 6]);
    const inner = pkg.objects.find((o) => o.name === 'INNER');
    const outer = pkg.objects.find((o) => o.name === 'OUTER');
    expect(inner?.components).toEqual([{ objectid: 2 }, { objectid: 3 }]);
    expect(outer?.components).toEqual([{ objectid: 5 }, { objectid: 4 }]);
    expect(inner?.type).toBe('model');
    expect(inner?.vertices).toEqual([]);
  });

  it('every component refers only to an id defined earlier in the file', () => {
    const parts = [part('A', null), part('B', null), part('C', null)];
    const scene = {
      parts,
      groups: [
        { name: 'G1', children: [{ part: 0 }, { part: 1 }] },
        { name: 'G2', children: [{ group: 0 }, { part: 2 }] },
      ],
      roots: [{ group: 1 }],
    };
    const pkg = read3mf(write3mf(scene, { application: APP }));
    for (const obj of pkg.objects) {
      for (const c of obj.components ?? []) {
        expect(c.objectid, `component of ${obj.name}`).toBeLessThan(obj.id);
      }
    }
  });

  it('build items name the roots only: a group root, or an ungrouped part', () => {
    const parts = [part('A', null), part('B', null), part('C', null)];
    const grouped = {
      parts,
      groups: [{ name: 'PAIR', children: [{ part: 0 }, { part: 1 }] }],
      roots: [{ group: 0 }, { part: 2 }],
    };
    const pkg = read3mf(write3mf(grouped, { application: APP }));
    const groupId = pkg.objects.find((o) => o.name === 'PAIR')?.id;
    expect(pkg.build.map((b) => b.objectid)).toEqual([groupId, 4]);
  });

  it('XML-escapes group names and writes components without transforms', () => {
    const scene = {
      parts: [part('A', null), part('B', null)],
      groups: [{ name: '  A & <B> "C" ', children: [{ part: 0 }, { part: 1 }] }],
      roots: [{ group: 0 }],
    };
    const bytes = write3mf(scene, { application: APP });
    const pkg = read3mf(bytes);
    const group = pkg.objects.find((o) => o.name === '  A & <B> "C" ');
    expect(group?.components).toEqual([{ objectid: 2 }, { objectid: 3 }]);
    expect(strFromU8(unzipSync(bytes)['3D/3dmodel.model'])).not.toContain('transform=');
  });
});
