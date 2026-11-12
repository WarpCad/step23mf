import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { meshStats, read3mf } from './read3mf.js';

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`;

const MODEL = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">Bolt &amp; nut</metadata>
  <metadata name="Application">step23mf</metadata>
  <resources>
    <basematerials id="1">
      <base name="Red" displaycolor="#FF0000"/>
      <base name="Green &quot;G&quot;" displaycolor="#00AA00FF"/>
    </basematerials>
    <object id="2" name="Tetra &lt;1&gt;" type="model" pid="1" pindex="0">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1.5" y="0" z="0"/>
          <vertex x="0" y="-2" z="0"/>
          <vertex x="0" y="0" z="1e-3"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="2" v3="1"/>
          <triangle v1="0" v2="1" v3="3" pid="1" p1="1"/>
        </triangles>
      </mesh>
    </object>
    <object id="3" name="Group" type="model">
      <components>
        <component objectid="2"/>
        <component objectid="2" transform="1 0 0 0 1 0 0 0 1 10 20 30"/>
      </components>
    </object>
  </resources>
  <build>
    <item objectid="3" transform="1 0 0 0 1 0 0 0 1 0 0 5"/>
    <item objectid="2"/>
  </build>
</model>`;

/** @param {Record<string, string>} files */
const zip = (files) => zipSync(Object.fromEntries(Object.entries(files).map(([path, text]) => [path, strToU8(text)])));

const minimal = () => zip({ '[Content_Types].xml': CONTENT_TYPES, '_rels/.rels': RELS, '3D/3dmodel.model': MODEL });

describe('read3mf', () => {
  it('lists the package parts and returns the content types and relationships verbatim', () => {
    const result = read3mf(minimal());
    expect(result.entries.sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
    expect(result.contentTypes).toBe(CONTENT_TYPES);
    expect(result.rels).toBe(RELS);
  });

  it('reads the unit and unescapes metadata', () => {
    const result = read3mf(minimal());
    expect(result.unit).toBe('millimeter');
    expect(result.metadata).toEqual({ Title: 'Bolt & nut', Application: 'step23mf' });
  });

  it('reads basematerials with unescaped names and colors as written', () => {
    expect(read3mf(minimal()).materials).toEqual([
      {
        id: 1,
        bases: [
          { name: 'Red', displaycolor: '#FF0000' },
          { name: 'Green "G"', displaycolor: '#00AA00FF' },
        ],
      },
    ]);
  });

  it('reads a mesh object with its properties, vertices and per-triangle p1', () => {
    const tetra = read3mf(minimal()).objects.find((object) => object.id === 2);
    expect(tetra).toMatchObject({ id: 2, name: 'Tetra <1>', type: 'model', pid: 1, pindex: 0 });
    expect(tetra?.vertices).toEqual([
      [0, 0, 0],
      [1.5, 0, 0],
      [0, -2, 0],
      [0, 0, 0.001],
    ]);
    expect(tetra?.triangles).toEqual([{ v: [0, 2, 1] }, { v: [0, 1, 3], pid: 1, p1: 1 }]);
    expect(tetra?.components).toBeUndefined();
  });

  it('reads a components object with and without transforms', () => {
    const group = read3mf(minimal()).objects.find((object) => object.id === 3);
    expect(group).toMatchObject({ id: 3, name: 'Group', type: 'model', vertices: [], triangles: [] });
    expect(group?.pid).toBeUndefined();
    expect(group?.components).toEqual([{ objectid: 2 }, { objectid: 2, transform: [1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 20, 30] }]);
  });

  it('reads build items in order', () => {
    expect(read3mf(minimal()).build).toEqual([
      { objectid: 3, transform: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 5] },
      { objectid: 2 },
    ]);
  });

  it('throws a clear error when the package has no model part', () => {
    expect(() => read3mf(zip({ '[Content_Types].xml': CONTENT_TYPES }))).toThrow(/no 3D model part/);
  });
});

/** Unit tetrahedron, outward winding, volume 1/6. */
const TETRA_VERTICES = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const TETRA_TRIANGLES = [
  { v: [0, 2, 1] },
  { v: [0, 1, 3] },
  { v: [0, 3, 2] },
  { v: [1, 2, 3] },
];

describe('meshStats', () => {
  it('reports a closed, outward-wound tetrahedron', () => {
    const stats = meshStats({ vertices: TETRA_VERTICES, triangles: TETRA_TRIANGLES });
    expect(stats.triangles).toBe(4);
    expect(stats.openEdges).toBe(0);
    expect(stats.signedVolume).toBeCloseTo(1 / 6, 12);
  });

  it('counts the three open edges left by removing one face', () => {
    const stats = meshStats({ vertices: TETRA_VERTICES, triangles: TETRA_TRIANGLES.slice(0, 3) });
    expect(stats.triangles).toBe(3);
    expect(stats.openEdges).toBe(3);
  });

  it('gives a negative volume when every face is flipped', () => {
    const flipped = TETRA_TRIANGLES.map(({ v: [a, b, c] }) => ({ v: [a, c, b] }));
    const stats = meshStats({ vertices: TETRA_VERTICES, triangles: flipped });
    expect(stats.openEdges).toBe(0);
    expect(stats.signedVolume).toBeCloseTo(-1 / 6, 12);
  });

  it('counts an edge shared by three triangles as open (non-manifold)', () => {
    const fin = [...TETRA_TRIANGLES, { v: [0, 1, 4] }];
    const stats = meshStats({ vertices: [...TETRA_VERTICES, [0, -1, 0]], triangles: fin });
    // Edge 0-1 is now used three times; the fin's other two edges once each.
    expect(stats.openEdges).toBe(3);
  });

  it('gives zeros for a mesh with no triangles', () => {
    expect(meshStats({ vertices: [], triangles: [] })).toEqual({ triangles: 0, openEdges: 0, signedVolume: 0 });
  });
});
