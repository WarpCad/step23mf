import { zipSync } from 'fflate';

/**
 * @typedef {import('./scene.js').Scene} Scene
 * @typedef {import('./scene.js').Part} Part
 * @typedef {import('./scene.js').Ref} Ref
 */

const NS = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const MODEL_REL = 'http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * DOS epoch, 1980-01-01 00:00:00. Written into every zip header after zipping, so the bytes never
 * depend on the local time zone (fflate stamps headers with local-time getters).
 */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * Remove the characters XML 1.0 forbids, then escape the five markup characters. Nothing else changes.
 * @param {string} text
 * @returns {string}
 */
function xmlEscape(text) {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Shortest round-trip text for a coordinate. `-0` becomes `0`; NaN and infinities are refused.
 * @param {number} n
 * @returns {string}
 */
function num(n) {
  if (!Number.isFinite(n)) throw new Error(`cannot write a non-finite number to 3MF: ${n}`);
  return Object.is(n, -0) ? '0' : String(n);
}

/**
 * Overwrite the DOS time and date of every local and central directory header with the fixed epoch.
 * Walks the central directory from the end-of-central-directory record, so it never scans compressed
 * bytes for a signature.
 * @param {Uint8Array} zip
 * @returns {Uint8Array} the same array, patched
 */
function fixDosTimes(zip) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('internal: zip has no end-of-central-directory record');
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    view.setUint16(p + 12, DOS_TIME, true);
    view.setUint16(p + 14, DOS_DATE, true);
    const local = view.getUint32(p + 42, true);
    view.setUint16(local + 10, DOS_TIME, true);
    view.setUint16(local + 12, DOS_DATE, true);
    p += 46 + view.getUint16(p + 28, true) + view.getUint16(p + 30, true) + view.getUint16(p + 32, true);
  }
  return zip;
}

/**
 * The basematerials group: one base per distinct color, in first-use order. Each part contributes its object
 * color, then its face colors in triangle order. Empty when no part has a color.
 * @param {Part[]} parts
 * @returns {{ colors: string[], index: Map<string, number> }}
 */
function colorTable(parts) {
  /** @type {string[]} */
  const colors = [];
  /** @type {Map<string, number>} */
  const index = new Map();
  /** @param {string | null} c */
  const add = (c) => {
    if (c !== null && !index.has(c)) {
      index.set(c, colors.length);
      colors.push(c);
    }
  };
  for (const p of parts) {
    add(p.color);
    if (p.faceColors) for (const c of p.faceColors) add(c);
  }
  return { colors, index };
}

/**
 * The 3D model part as XML text.
 * @param {Scene} scene
 * @param {string} application
 * @returns {string}
 */
function modelXml(scene, application) {
  const { colors, index } = colorTable(scene.parts);
  const lines = [
    XML_DECL,
    `<model unit="millimeter" xml:lang="en-US" xmlns="${NS}">`,
    `<metadata name="Application">${xmlEscape(application)}</metadata>`,
    '<resources>',
  ];
  if (colors.length > 0) {
    lines.push('<basematerials id="1">');
    for (const c of colors) lines.push(`<base name="${c}" displaycolor="${c}"/>`);
    lines.push('</basematerials>');
  }
  scene.parts.forEach((part, i) => {
    const id = i + 2;
    const pid = part.color === null ? '' : ` pid="1" pindex="${index.get(part.color)}"`;
    lines.push(`<object id="${id}" type="model" name="${xmlEscape(part.name)}"${pid}>`, '<mesh><vertices>');
    const pos = part.positions;
    for (let v = 0; v < pos.length; v += 3) {
      lines.push(`<vertex x="${num(pos[v])}" y="${num(pos[v + 1])}" z="${num(pos[v + 2])}"/>`);
    }
    lines.push('</vertices><triangles>');
    const tri = part.triangles;
    const faces = part.faceColors;
    for (let t = 0; t < tri.length; t += 3) {
      // A triangle names its own base only where its color differs from the object's pindex.
      const c = faces ? faces[t / 3] : null;
      const p1 = c !== null && c !== part.color ? ` pid="1" p1="${index.get(c)}"` : '';
      lines.push(`<triangle v1="${tri[t]}" v2="${tri[t + 1]}" v3="${tri[t + 2]}"${p1}/>`);
    }
    lines.push('</triangles></mesh>', '</object>');
  });
  // Object ids: parts take 2..parts+1 (id 1 is the basematerials group), then each group in post-order.
  // A group's components name only ids already written, which the post-order guarantees.
  const groups = scene.groups ?? [];
  const partId = (/** @type {number} */ i) => i + 2;
  const groupId = (/** @type {number} */ g) => scene.parts.length + 2 + g;
  const refId = (/** @type {Ref} */ ref) => ('part' in ref ? partId(ref.part) : groupId(ref.group));
  groups.forEach((group, g) => {
    lines.push(`<object id="${groupId(g)}" type="model" name="${xmlEscape(group.name)}"><components>`);
    for (const child of group.children) lines.push(`<component objectid="${refId(child)}"/>`);
    lines.push('</components></object>');
  });
  lines.push('</resources>', '<build>');
  for (const root of roots(scene)) lines.push(`<item objectid="${refId(root)}"/>`);
  lines.push('</build>', '</model>');
  return lines.join('\n');
}

/**
 * The top level of a scene. A scene with no `roots` (the flat M1 shape) lists every part.
 * @param {Scene} scene
 * @returns {Ref[]}
 */
function roots(scene) {
  return scene.roots ?? scene.parts.map((_, i) => ({ part: i }));
}

/**
 * Write a scene as a 3MF package. Pure: no filesystem, no clock.
 * @param {Scene} scene
 * @param {{ application: string }} opts `application` goes into the Application metadata.
 * @returns {Uint8Array} the .3mf bytes
 * @throws {Error} when the scene has no parts, or a coordinate is not finite.
 */
export function write3mf(scene, opts) {
  if (scene.parts.length === 0) throw new Error('cannot write a 3MF with no parts');

  const contentTypes =
    `${XML_DECL}\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>' +
    '</Types>';
  const rels =
    `${XML_DECL}\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="${MODEL_REL}"/>` +
    '</Relationships>';

  const zip = zipSync(
    {
      '[Content_Types].xml': new TextEncoder().encode(contentTypes),
      '_rels/.rels': new TextEncoder().encode(rels),
      '3D/3dmodel.model': new TextEncoder().encode(modelXml(scene, opts.application)),
    },
    // Noon UTC on 1980-01-01 is 1980 in every zone (UTC-12 to UTC+14), which fflate requires.
    // The zip's own DOS fields are then overwritten below, so this value only sets a valid range.
    { level: 6, mtime: new Date(Date.UTC(1980, 0, 1, 12)) },
  );
  return fixDosTimes(zip);
}
