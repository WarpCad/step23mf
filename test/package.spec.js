// What `npm publish` would ship, and whether the shipped package runs once installed.
// TODO/build-002-publish.md, Testing. The smoke test installs the real tarball into a temp folder, so it catches
// a module left out of `files`, a WASM path that only resolves from the source tree, or a broken bin shim.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { read3mf } from './helpers/read3mf.js';
import { CUBE_MM } from './fixtures/index.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WIN = process.platform === 'win32';

/**
 * Run npm and return its stdout. Windows needs a shell to run `npm.cmd`.
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function npm(args, cwd) {
  return execFileSync('npm', args, { cwd, encoding: 'utf8', shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] });
}

describe('published package', () => {
  it('ships exactly bin/, src/, LICENSE, README.md and package.json', () => {
    const [report] = JSON.parse(npm(['pack', '--dry-run', '--json'], ROOT));
    /** @type {string[]} */
    const files = report.files.map((/** @type {{ path: string }} */ f) => f.path).sort();

    expect(files).toEqual(
      [
        'LICENSE',
        'README.md',
        'bin/step23mf.js',
        'package.json',
        'src/cli.js',
        'src/convert.js',
        'src/occt-import-js.d.ts',
        'src/scene.js',
        'src/step.js',
        'src/threemf.js',
      ].sort(),
    );
    // The LGPL STEP reader stays a dependency and is never bundled (docs/decisions/step-reader.md).
    expect(files.some((f) => f.endsWith('.wasm'))).toBe(false);
  });

  it('has a bin shim with a node shebang', () => {
    const shim = readFileSync(join(ROOT, 'bin', 'step23mf.js'), 'utf8');
    expect(shim.startsWith('#!/usr/bin/env node\n')).toBe(true);
  });

  describe('installed from the tarball', () => {
    /** @type {string} */
    let dir;

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'step23mf-pkg-'));
      const [report] = JSON.parse(npm(['pack', '--json', '--pack-destination', dir], ROOT));
      writeFileSync(join(dir, 'package.json'), '{"private":true}\n');
      npm(['install', '--prefer-offline', '--no-audit', '--no-fund', join(dir, report.filename)], dir);
    }, 120_000);

    afterAll(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    it('links the step23mf command', () => {
      const bin = join(dir, 'node_modules', '.bin', WIN ? 'step23mf.cmd' : 'step23mf');
      expect(existsSync(bin)).toBe(true);
    });

    it('converts CUBE_MM: exit 0 and one object Cube', () => {
      const cli = join(dir, 'node_modules', '@warpcad', 'step23mf', 'bin', 'step23mf.js');
      const out = join(dir, 'cube.3mf');
      const run = spawnSync(process.execPath, [cli, CUBE_MM, '-o', out], { cwd: dir, encoding: 'utf8' });

      expect(run.stderr).toBe('');
      expect(run.status).toBe(0);
      const pkg = read3mf(new Uint8Array(readFileSync(out)));
      expect(pkg.objects).toHaveLength(1);
      expect(pkg.objects[0].name).toBe('Cube');
    });
  });
});
