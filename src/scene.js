// Scene building: turns the raw `occt-import-js` result into parts ready for the 3MF writer.
// Pure functions: no fs, no DOM, nothing printed. Problems come back as warning sentences.

/**
 * @typedef {object} OcctNode
 * @property {string} name
 * @property {number[]} meshes indices into `OcctResult.meshes`
 * @property {OcctNode[]} children
 */

/**
 * @typedef {object} OcctMesh
 * @property {string} name
 * @property {number[]=} color linear RGB, 0-1
 * @property {{ position: { array: ArrayLike<number> } }} attributes millimetres, xyz triplets
 * @property {{ array: ArrayLike<number> }} index triangle index triplets
 * @property {{ first: number, last: number, color?: number[] | null }[]=} brep_faces inclusive triangle ranges
 */

/**
 * @typedef {object} OcctResult
 * @property {boolean=} success
 * @property {OcctNode} root
 * @property {OcctMesh[]} meshes
 */

/**
 * @typedef {object} Part
 * @property {string} name
 * @property {string | null} color object default color, `#RRGGBB`
 * @property {Float64Array} positions millimetres, welded, xyz triplets
 * @property {Uint32Array} triangles index triplets into `positions`
 * @property {(string | null)[] | null} faceColors per-triangle colors, one per entry of `triangles`; null when every
 *   triangle takes `color`
 */

/** Fallback for a face with no color of its own, when the part has some face color and no mesh color. */
const DEFAULT_FACE_COLOR = '#808080';

/**
 * A reference to a part or a group, by index. Tagged rather than bare numbers, so a part index and a group
 * index can never be confused.
 * @typedef {{ part: number } | { group: number }} Ref
 */

/**
 * An assembly: the parts and groups under one node, in file order. Named after its node.
 * @typedef {object} Group
 * @property {string} name
 * @property {Ref[]} children
 */

/**
 * @typedef {object} Scene
 * @property {Part[]} parts every part, flat, in depth-first file order
 * @property {Group[]=} groups groups in post-order: a group comes after every group it contains. Absent means none.
 * @property {Ref[]=} roots the top level: one group, or the parts and groups not inside any other. Absent means every part.
 */

/** The name OCCT gives a solid that has none in the STEP file. */
const STEP_PLACEHOLDER = 'SOLID';

/**
 * A mesh's own name, or `''` when it has none (empty, or OCCT's placeholder).
 * @param {{ name?: string | null }} mesh
 * @returns {string}
 */
function ownName(mesh) {
  const name = mesh.name ?? '';
  return name === STEP_PLACEHOLDER ? '' : name;
}

/**
 * Converts one linear-light channel to an sRGB byte as two uppercase hex digits.
 * Out-of-range input clamps to 0-1; the byte rounds half up.
 * @param {number} c linear value, nominally 0-1
 * @returns {string}
 */
export function linearToSrgb(c) {
  const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  const clamped = Math.min(1, Math.max(0, encoded));
  return Math.floor(clamped * 255 + 0.5)
    .toString(16)
    .toUpperCase()
    .padStart(2, '0');
}

/**
 * @param {number[]} rgb linear RGB, 0-1
 * @returns {string} `#RRGGBB`
 */
function toHexColor(rgb) {
  return `#${linearToSrgb(rgb[0])}${linearToSrgb(rgb[1])}${linearToSrgb(rgb[2])}`;
}

/**
 * Welds coincident vertices by exact coordinate equality and drops degenerate triangles.
 * Equality is numeric, so `0` and `-0` are the same vertex; output coordinates are normalised to `+0`.
 * @param {ArrayLike<number>} position xyz triplets, mm
 * @param {ArrayLike<number>} index triangle index triplets into `position`
 * @returns {{ positions: Float64Array, triangles: Uint32Array, kept: Uint32Array }} `kept[k]` is the index, in
 *   `index`'s triangle order before any drop, of the surviving triangle `k`.
 */
function weld(position, index) {
  /** @type {Map<string, number>} */
  const byKey = new Map();
  /** @type {number[]} */
  const welded = [];
  const remap = new Uint32Array(position.length / 3);
  for (let v = 0; v < remap.length; v++) {
    // `+ 0` turns -0 into +0, and String(0) === String(-0) anyway, so both land on one key.
    const x = position[v * 3] + 0;
    const y = position[v * 3 + 1] + 0;
    const z = position[v * 3 + 2] + 0;
    const key = `${x},${y},${z}`;
    let id = byKey.get(key);
    if (id === undefined) {
      id = welded.length / 3;
      byKey.set(key, id);
      welded.push(x, y, z);
    }
    remap[v] = id;
  }
  /** @type {number[]} */
  const tris = [];
  /** @type {number[]} */
  const kept = [];
  for (let t = 0; t + 2 < index.length; t += 3) {
    const a = remap[index[t]];
    const b = remap[index[t + 1]];
    const c = remap[index[t + 2]];
    if (a === b || b === c || a === c) continue;
    tris.push(a, b, c);
    kept.push(t / 3);
  }
  return {
    positions: Float64Array.from(welded),
    triangles: Uint32Array.from(tris),
    kept: Uint32Array.from(kept),
  };
}

/**
 * Most common color, ties going to the one that appears first in triangle order (the earliest face).
 * @param {(string | null)[]} colors one entry per triangle; null entries are ignored
 * @returns {string | null}
 */
function mostCovered(colors) {
  /** @type {Map<string, { count: number, first: number }>} */
  const seen = new Map();
  colors.forEach((c, i) => {
    if (c === null) return;
    const entry = seen.get(c);
    if (entry) entry.count++;
    else seen.set(c, { count: 1, first: i });
  });
  let best = null;
  let bestEntry = null;
  for (const [c, entry] of seen) {
    if (
      bestEntry === null ||
      entry.count > bestEntry.count ||
      (entry.count === bestEntry.count && entry.first < bestEntry.first)
    ) {
      best = c;
      bestEntry = entry;
    }
  }
  return best;
}

/**
 * Resolves a part's object color and per-triangle colors from its B-rep face ranges.
 * A face's range is inclusive triangle indices into the mesh *before* welding, so it is mapped through `kept`.
 * A face resolves to its own color, then the mesh color, then `DEFAULT_FACE_COLOR` (only when some face has a color).
 * @param {OcctMesh} mesh
 * @param {number} triangleCount triangles in the mesh before welding
 * @param {Uint32Array} kept pre-weld index of each surviving triangle
 * @param {string} name part name, for warnings
 * @param {string[]} warnings
 * @returns {{ color: string | null, faceColors: (string | null)[] | null }}
 */
function resolveColors(mesh, triangleCount, kept, name, warnings) {
  const faces = mesh.brep_faces ?? [];
  const meshColor = mesh.color ? toHexColor(mesh.color) : null;
  const fallback = meshColor ?? (faces.some((f) => f.color) ? DEFAULT_FACE_COLOR : null);

  /** @type {Int32Array} index of the first face covering each pre-weld triangle, -1 for none */
  const owner = new Int32Array(triangleCount).fill(-1);
  faces.forEach((face, f) => {
    if (face.first > face.last) return;
    const a = Math.max(0, face.first);
    const b = Math.min(triangleCount - 1, face.last);
    if (a !== face.first || b !== face.last) {
      warnings.push(
        a > b
          ? `face ${face.first}-${face.last} of "${name}" is outside its ${triangleCount} triangles; ignored`
          : `face ${face.first}-${face.last} of "${name}" is outside its ${triangleCount} triangles; clamped to ${a}-${b}`,
      );
    }
    for (let t = a; t <= b; t++) if (owner[t] === -1) owner[t] = f;
  });

  const resolved = faces.map((face) => (face.color ? toHexColor(face.color) : fallback));
  const triColors = Array.from(kept, (t) => (owner[t] === -1 ? fallback : resolved[owner[t]]));

  const color = meshColor ?? mostCovered(triColors);
  if (color === null) return { color: null, faceColors: null };
  return { color, faceColors: triColors.every((c) => c === color) ? null : triColors };
}

/**
 * Number of undirected edges not used by exactly two triangles.
 * @param {Uint32Array} triangles
 * @returns {number}
 */
function openEdgeCount(triangles) {
  /** @type {Map<string, number>} */
  const uses = new Map();
  for (let t = 0; t < triangles.length; t += 3) {
    for (let i = 0; i < 3; i++) {
      const a = triangles[t + i];
      const b = triangles[t + ((i + 1) % 3)];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  let open = 0;
  for (const n of uses.values()) if (n !== 2) open++;
  return open;
}

/**
 * Builds the scene from an `occt-import-js` result.
 * @param {OcctResult} result
 * @returns {{ scene: Required<Scene>, warnings: string[] }}
 */
export function buildScene(result) {
  /** @type {Part[]} */
  const parts = [];
  /** @type {Group[]} */
  const groups = [];
  /** @type {string[]} */
  const warnings = [];
  let empty = 0;

  /**
   * Visits a node and its subtree. Returns what the node contributes to its parent: a single group
   * reference when the node becomes a group, otherwise its own parts and child groups flattened in order.
   * Groups are pushed when they close, so every group comes after the groups it contains (post-order).
   * @param {OcctNode} node
   * @param {string} inherited nearest non-empty name at or above this node's parent
   * @returns {{ refs: Ref[], partCount: number }}
   */
  const visit = (node, inherited) => {
    const nodeName = node.name !== '' && node.name != null ? node.name : inherited;
    /** @type {Ref[]} */
    const refs = [];
    let partCount = 0;
    const owned = node.meshes ?? [];
    // A node with one mesh is named after the node. A node with several is often a part whose
    // solids OCCT flattened into it (a PCB's board, LEDs and capacitors under "PCB Component"), so
    // each mesh's own name wins there, and only a mesh with none falls back to the node's name.
    // `(k)` counts the meshes that share a base name, so a name used once stays bare.
    const bases = owned.map((meshIndex) => {
      const own = ownName(result.meshes[meshIndex]);
      if (owned.length > 1 && own !== '') return own;
      return nodeName !== '' ? nodeName : own;
    });
    /** @type {Map<string, number>} */
    const uses = new Map();
    for (const base of bases) if (base !== '') uses.set(base, (uses.get(base) ?? 0) + 1);
    /** @type {Map<string, number>} */
    const seen = new Map();
    owned.forEach((meshIndex, k) => {
      const mesh = result.meshes[meshIndex];
      const base = bases[k];
      let name;
      if (base === '') {
        name = `Part ${parts.length + 1}`;
      } else {
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        name = (uses.get(base) ?? 0) > 1 ? `${base} (${n})` : base;
      }

      const position = mesh.attributes.position.array;
      if (!Array.prototype.every.call(position, Number.isFinite)) {
        warnings.push(`skipped "${name}": coordinates are not finite numbers`);
        return;
      }
      const { positions, triangles, kept } = weld(position, mesh.index.array);
      if (triangles.length === 0) {
        empty++;
        return;
      }
      const open = openEdgeCount(triangles);
      if (open > 0) {
        warnings.push(`"${name}" is not watertight (${open} open edges); a slicer may need to repair it`);
      }
      const triangleCount = Math.floor(mesh.index.array.length / 3);
      const { color, faceColors } = resolveColors(mesh, triangleCount, kept, name, warnings);
      parts.push({ name, color, positions, triangles, faceColors });
      refs.push({ part: parts.length - 1 });
      partCount++;
    });
    for (const child of node.children ?? []) {
      const sub = visit(child, nodeName);
      refs.push(...sub.refs);
      partCount += sub.partCount;
    }

    // Two or more parts make a group. The unnamed root never does: it is the file, not an assembly.
    const isUnnamedRoot = node === result.root && (node.name === '' || node.name == null);
    if (partCount < 2 || isUnnamedRoot) return { refs, partCount };
    const index = groups.length;
    groups.push({ name: nodeName !== '' ? nodeName : `Assembly ${index + 1}`, children: refs });
    return { refs: [{ group: index }], partCount };
  };
  const top = visit(result.root, '');

  if (empty > 0) warnings.unshift(`skipped ${empty} part(s) with no triangles`);
  return { scene: { parts, groups, roots: top.refs }, warnings };
}
