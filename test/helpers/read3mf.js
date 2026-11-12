// Test-only 3MF read-back: unzip a package and pull out the parts specs assert on. A small
// attribute-regex reader, not a general XML parser: it expects the default (unprefixed) 3MF core
// namespace, which is what this project writes.

import { strFromU8, unzipSync } from 'fflate';

/**
 * @typedef {{ name: string, displaycolor: string }} Base
 * @typedef {{ id: number, bases: Base[] }} BaseMaterials
 * @typedef {{ v: number[], pid?: number, p1?: number }} Triangle
 * @typedef {{ objectid: number, transform?: number[] }} Component
 * @typedef {{ objectid: number, transform?: number[] }} BuildItem
 * @typedef {{
 *   id: number, name: string, type: string, pid?: number, pindex?: number,
 *   vertices: number[][], triangles: Triangle[], components?: Component[]
 * }} Object3mf
 * @typedef {{
 *   entries: string[], contentTypes: string, rels: string, unit: string | undefined,
 *   metadata: Record<string, string>, materials: BaseMaterials[], objects: Object3mf[], build: BuildItem[]
 * }} Package3mf
 */

const MODEL_REL_TYPE = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';
const DEFAULT_MODEL_PATH = '3D/3dmodel.model';

/** @param {string} text */
const unescapeXml = (text) =>
  text.replace(/&(lt|gt|quot|apos|amp|#x[0-9a-fA-F]+|#[0-9]+);/g, (_, entity) => {
    if (entity[0] === '#') {
      return String.fromCodePoint(entity[1] === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10));
    }
    return /** @type {Record<string, string>} */ ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[entity];
  });

/**
 * Attributes of one tag's attribute text, unescaped.
 * @param {string} text
 * @returns {Record<string, string>}
 */
const attrs = (text) => {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [, key, value] of text.matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g)) out[key] = unescapeXml(value);
  return out;
};

/**
 * Every `<tag …>` (self-closing or not) in `xml`, as its attributes.
 * @param {string} xml
 * @param {string} tag
 */
const tags = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*?)/?>`, 'g'))].map(([, a]) => attrs(a));

/**
 * Every `<tag …>body</tag>` in `xml`, as its attributes and body.
 * @param {string} xml
 * @param {string} tag
 */
const blocks = (xml, tag) =>
  [...xml.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))].map(([, a, body]) => ({
    attrs: attrs(a),
    body,
  }));

/** @param {string | undefined} value */
const optNumber = (value) => (value === undefined ? undefined : Number(value));

/** @param {string | undefined} value */
const transform = (value) => (value === undefined ? undefined : value.trim().split(/\s+/).map(Number));

/**
 * Drop keys whose value is undefined, so `toEqual` sees only what the file wrote.
 * @template {Record<string, unknown>} T
 * @param {T} object
 * @returns {T}
 */
const compact = (object) => /** @type {T} */ (Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)));

/**
 * Unzip a 3MF package and read its model part.
 * @param {Uint8Array} bytes the .3mf file
 * @returns {Package3mf}
 */
export function read3mf(bytes) {
  const files = unzipSync(bytes);
  const text = (/** @type {string} */ path) => (files[path] ? strFromU8(files[path]) : '');
  const rels = text('_rels/.rels');
  const modelRel = tags(rels, 'Relationship').find((rel) => rel.Type === MODEL_REL_TYPE);
  const modelPath = modelRel?.Target?.replace(/^\//, '') ?? DEFAULT_MODEL_PATH;
  if (!files[modelPath]) throw new Error(`3MF has no 3D model part (looked for ${modelPath})`);
  const model = text(modelPath);

  const modelTag = model.match(/<model\b([^>]*)>/);
  const metadata = Object.fromEntries(
    blocks(model, 'metadata').map(({ attrs: a, body }) => [a.name, unescapeXml(body)]),
  );

  const materials = blocks(model, 'basematerials').map(({ attrs: a, body }) => ({
    id: Number(a.id),
    bases: tags(body, 'base').map((base) => ({ name: base.name, displaycolor: base.displaycolor })),
  }));

  const objects = blocks(model, 'object').map(({ attrs: a, body }) => {
    const componentsBlock = blocks(body, 'components')[0];
    return compact({
      id: Number(a.id),
      name: a.name,
      type: a.type,
      pid: optNumber(a.pid),
      pindex: optNumber(a.pindex),
      vertices: tags(body, 'vertex').map((v) => [Number(v.x), Number(v.y), Number(v.z)]),
      triangles: tags(body, 'triangle').map((t) =>
        compact({ v: [Number(t.v1), Number(t.v2), Number(t.v3)], pid: optNumber(t.pid), p1: optNumber(t.p1) }),
      ),
      components: componentsBlock
        ? tags(componentsBlock.body, 'component').map((c) =>
            compact({ objectid: Number(c.objectid), transform: transform(c.transform) }),
          )
        : undefined,
    });
  });

  const buildBlock = blocks(model, 'build')[0];
  const build = buildBlock
    ? tags(buildBlock.body, 'item').map((item) => compact({ objectid: Number(item.objectid), transform: transform(item.transform) }))
    : [];

  return {
    entries: Object.keys(files),
    contentTypes: text('[Content_Types].xml'),
    rels,
    unit: modelTag ? attrs(modelTag[1]).unit : undefined,
    metadata,
    materials,
    objects,
    build,
  };
}

/**
 * Closedness and orientation of a triangle mesh.
 * `openEdges` counts undirected edges used by anything other than exactly two triangles (boundary or
 * non-manifold). `signedVolume` is by the divergence theorem, in the mesh's own units cubed: positive
 * for outward winding, negative when every face is flipped.
 * @param {{ vertices: number[][], triangles: { v: number[] }[] }} object
 * @returns {{ triangles: number, openEdges: number, signedVolume: number }}
 */
export function meshStats(object) {
  const { vertices, triangles } = object;
  /** @type {Map<string, number>} */
  const edgeUse = new Map();
  let sixVolume = 0;
  for (const { v } of triangles) {
    for (let i = 0; i < 3; i++) {
      const a = v[i];
      const b = v[(i + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1);
    }
    const [p, q, r] = [vertices[v[0]], vertices[v[1]], vertices[v[2]]];
    sixVolume +=
      p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0]);
  }
  let openEdges = 0;
  for (const uses of edgeUse.values()) if (uses !== 2) openEdges++;
  return { triangles: triangles.length, openEdges, signedVolume: sixVolume / 6 };
}
