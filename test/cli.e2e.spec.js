import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { read3mf } from './helpers/read3mf.js';
import { CUBE_MM } from './fixtures/index.js';

const BIN = fileURLToPath(new URL('../bin/step23mf.js', import.meta.url));

describe('step23mf CLI (spawned process)', () => {
  /** @type {string} */
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'step23mf-e2e-'));
    copyFileSync(CUBE_MM, join(dir, 'cube.step'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('converts a single colored part: exit 0, one stdout line, one object Cube #CCCCCC', () => {
    const run = spawnSync(process.execPath, [BIN, 'cube.step'], { cwd: dir, encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toBe('wrote cube.3mf (1 part(s), 1 color(s))\n');
    expect(run.stderr).toBe('');

    const pkg = read3mf(new Uint8Array(readFileSync(join(dir, 'cube.3mf'))));
    expect(pkg.objects).toHaveLength(1);
    expect(pkg.objects[0].name).toBe('Cube');
    expect(pkg.materials[0].bases).toEqual([{ name: '#CCCCCC', displaycolor: '#CCCCCC' }]);
  });

  it('exits 1 with one clear line for a missing input, and no stack trace', () => {
    const run = spawnSync(process.execPath, [BIN, 'nope.step'], { cwd: dir, encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toBe('step23mf: cannot read nope.step: no such file\n');
    expect(run.stdout).toBe('');
  });

  it('refuses to clobber an existing output, then overwrites it with --force', () => {
    execFileSync(process.execPath, [BIN, 'cube.step'], { cwd: dir });
    const refused = spawnSync(process.execPath, [BIN, 'cube.step'], { cwd: dir, encoding: 'utf8' });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toBe('step23mf: cube.3mf already exists (use --force to overwrite)\n');

    const forced = spawnSync(process.execPath, [BIN, 'cube.step', '-f'], { cwd: dir, encoding: 'utf8' });
    expect(forced.status).toBe(0);
  });
});
