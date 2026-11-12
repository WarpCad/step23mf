import { describe, expect, it } from 'vitest';
import { defaultOutput, degToRad, parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('reads the input path and the -o output path', () => {
    expect(parseArgs(['part.step', '-o', 'out.3mf'])).toMatchObject({ input: 'part.step', output: 'out.3mf' });
  });
  it('reports a missing value for -o', () => {
    expect(parseArgs(['part.step', '-o']).error).toMatch(/needs a file path/);
  });
  it('rejects unknown options and extra positionals', () => {
    expect(parseArgs(['--nope']).error).toMatch(/unknown option/);
    expect(parseArgs(['a.step', 'b.step']).error).toMatch(/extra argument/);
  });
  it('reads -f and --force', () => {
    expect(parseArgs(['part.step', '-f']).force).toBe(true);
    expect(parseArgs(['part.step', '--force']).force).toBe(true);
    expect(parseArgs(['part.step']).force).toBe(false);
  });
});

describe('defaultOutput', () => {
  it('replaces a trailing .step, case-insensitively', () => {
    expect(defaultOutput('part.step')).toBe('part.3mf');
    expect(defaultOutput('part.STEP')).toBe('part.3mf');
  });
  it('replaces a trailing .stp, case-insensitively', () => {
    expect(defaultOutput('part.stp')).toBe('part.3mf');
    expect(defaultOutput('part.STP')).toBe('part.3mf');
  });
  it('appends .3mf to any other name', () => {
    expect(defaultOutput('part.txt')).toBe('part.txt.3mf');
    expect(defaultOutput('part')).toBe('part.3mf');
  });
  it('keeps the input directory, not the current one', () => {
    expect(defaultOutput('parts/bracket.step')).toBe('parts/bracket.3mf');
    expect(defaultOutput('/abs/dir/part.stp')).toBe('/abs/dir/part.3mf');
    expect(defaultOutput('dir.step/part')).toBe('dir.step/part.3mf');
  });
});

describe('tessellation flags (cli-002)', () => {
  it('reads -t and --tolerance as a number of millimetres', () => {
    expect(parseArgs(['part.step', '-t', '0.01']).tolerance).toBe(0.01);
    expect(parseArgs(['part.step', '--tolerance', '1']).tolerance).toBe(1);
  });
  it('reads -a and --angle as a number of degrees', () => {
    expect(parseArgs(['part.step', '-a', '15']).angle).toBe(15);
    expect(parseArgs(['part.step', '--angle', '28.6']).angle).toBe(28.6);
  });
  it('leaves both unset when the flags are absent', () => {
    const opts = parseArgs(['part.step']);
    expect(opts.tolerance).toBeUndefined();
    expect(opts.angle).toBeUndefined();
  });
  it('rejects a tolerance that is not a finite positive number', () => {
    for (const v of ['0', '-1', 'abc', 'Infinity', '']) {
      expect(parseArgs(['part.step', '-t', v]).error).toBe('--tolerance needs a positive number of millimetres');
    }
  });
  it('rejects a missing tolerance value', () => {
    expect(parseArgs(['part.step', '--tolerance']).error).toBe('--tolerance needs a positive number of millimetres');
  });
  it('rejects an angle outside (0, 90]', () => {
    for (const v of ['0', '-1', 'abc', 'Infinity', '91', '']) {
      expect(parseArgs(['part.step', '-a', v]).error).toBe('--angle needs a number of degrees between 0 and 90');
    }
  });
  it('accepts an angle of exactly 90', () => {
    expect(parseArgs(['part.step', '-a', '90']).error).toBeUndefined();
  });
  it('converts degrees to radians at the boundary', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 12);
    expect(degToRad(28.6)).toBeCloseTo(0.4992, 4);
    expect(degToRad(0.5)).toBeCloseTo(0.008727, 6);
  });
});
