import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// The filesystem and the converter are mocked at their boundaries. cli.js only parses arguments,
// does file I/O and maps results to exit codes, so these specs exercise exactly that.
const fs = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  rm: vi.fn(),
}));
vi.mock('node:fs/promises', () => fs);

const conv = vi.hoisted(() => ({ convert: vi.fn() }));
vi.mock('../src/convert.js', () => conv);

const { main } = await import('../src/cli.js');
const { StepError } = await import('../src/step.js');

/**
 * An error shaped like a Node fs failure.
 * @param {string} code
 */
const fsError = (code) => Object.assign(new Error(code), { code });

const TMP = 'part.3mf.tmp-' + process.pid;

describe('main', () => {
  /** @type {string[]} */
  let out;
  /** @type {string[]} */
  let err;

  beforeEach(() => {
    out = [];
    err = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => void out.push(a.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...a) => void err.push(a.join(' ')));
    fs.readFile.mockReset().mockResolvedValue(Buffer.from('ISO-10303-21;\n'));
    fs.stat.mockReset().mockRejectedValue(fsError('ENOENT'));
    fs.writeFile.mockReset().mockResolvedValue(undefined);
    fs.rename.mockReset().mockResolvedValue(undefined);
    fs.rm.mockReset().mockResolvedValue(undefined);
    conv.convert.mockReset().mockResolvedValue({
      bytes: new Uint8Array([0x50, 0x4b]),
      parts: 1,
      colors: 1,
      warnings: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('success', () => {
    it('converts, writes a temp file, renames it, and prints one line', async () => {
      const code = await main(['part.step']);
      expect(code).toBe(0);
      expect(conv.convert).toHaveBeenCalledTimes(1);
      expect(fs.writeFile).toHaveBeenCalledWith(TMP, new Uint8Array([0x50, 0x4b]));
      expect(fs.rename).toHaveBeenCalledWith(TMP, 'part.3mf');
      expect(out).toEqual(['wrote part.3mf (1 part(s), 1 color(s))']);
      expect(err).toEqual([]);
    });

    it('writes the temp file before renaming it', async () => {
      await main(['part.step']);
      expect(fs.writeFile.mock.invocationCallOrder[0]).toBeLessThan(fs.rename.mock.invocationCallOrder[0]);
    });

    it('prints the output path as typed, relative when the input was relative', async () => {
      await main(['sub/part.step']);
      expect(fs.rename).toHaveBeenCalledWith('sub/part.3mf.tmp-' + process.pid, 'sub/part.3mf');
      expect(out).toEqual(['wrote sub/part.3mf (1 part(s), 1 color(s))']);
    });

    it('uses -o as the output path', async () => {
      const code = await main(['part.step', '-o', 'out.3mf']);
      expect(code).toBe(0);
      expect(fs.rename).toHaveBeenCalledWith('out.3mf.tmp-' + process.pid, 'out.3mf');
      expect(out).toEqual(['wrote out.3mf (1 part(s), 1 color(s))']);
    });

    it('prints each converter warning to stderr and still succeeds', async () => {
      conv.convert.mockResolvedValue({ bytes: new Uint8Array([1]), parts: 2, colors: 0, warnings: ['a', 'b'] });
      const code = await main(['part.step']);
      expect(code).toBe(0);
      expect(err).toEqual(['step23mf: warning: a', 'step23mf: warning: b']);
    });

    it('overwrites an existing output with --force', async () => {
      fs.stat.mockResolvedValue({});
      const code = await main(['part.step', '--force']);
      expect(code).toBe(0);
      expect(fs.rename).toHaveBeenCalledWith(TMP, 'part.3mf');
    });
  });

  describe('input errors', () => {
    it('reports a missing input with exit 1', async () => {
      fs.readFile.mockRejectedValue(fsError('ENOENT'));
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual(['step23mf: cannot read part.step: no such file']);
      expect(conv.convert).not.toHaveBeenCalled();
    });

    it('reports a directory given as input', async () => {
      fs.readFile.mockRejectedValue(fsError('EISDIR'));
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual(['step23mf: cannot read part.step: it is a directory']);
    });

    it('reports an unreadable input', async () => {
      fs.readFile.mockRejectedValue(fsError('EACCES'));
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual(['step23mf: cannot read part.step: permission denied']);
    });
  });

  describe('converter errors', () => {
    it('prints a StepError as <input>: <message> with exit 1', async () => {
      conv.convert.mockRejectedValue(
        new StepError('NOT_STEP', 'not a STEP file (it should start with ISO-10303-21;)'),
      );
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual([
        'step23mf: part.step: not a STEP file (it should start with ISO-10303-21;)',
      ]);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('reports any other exception as an internal error that asks for a bug report', async () => {
      conv.convert.mockRejectedValue(new TypeError('boom'));
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual([
        'step23mf: internal error: boom (please report this with the STEP file)',
      ]);
    });

    it('never prints a stack trace', async () => {
      conv.convert.mockRejectedValue(new TypeError('boom'));
      await main(['part.step']);
      expect(err.join('\n')).not.toMatch(/\n\s+at /);
    });
  });

  describe('output errors', () => {
    it('refuses an existing output without --force, before converting', async () => {
      fs.stat.mockResolvedValue({});
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual(['step23mf: part.3mf already exists (use --force to overwrite)']);
      expect(conv.convert).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('reports a missing output directory', async () => {
      fs.writeFile.mockRejectedValue(fsError('ENOENT'));
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual(['step23mf: cannot write part.3mf: directory does not exist']);
    });

    it('reports any other write failure by its error code', async () => {
      fs.writeFile.mockRejectedValue(fsError('ENOSPC'));
      expect(await main(['part.step'])).toBe(1);
      expect(err).toEqual(['step23mf: cannot write part.3mf: ENOSPC']);
    });

    it('removes the temp file when the rename fails', async () => {
      fs.rename.mockRejectedValue(fsError('EXDEV'));
      expect(await main(['part.step'])).toBe(1);
      expect(fs.rm).toHaveBeenCalledWith(TMP, { force: true });
      expect(err).toEqual(['step23mf: cannot write part.3mf: EXDEV']);
    });
  });

  describe('help', () => {
    it('prints the options block exactly', async () => {
      expect(await main(['--help'])).toBe(0);
      expect(out.join('\n')).toContain(
        [
          'Options:',
          '  -o, --output <file>   Output path (default: input name with .3mf)',
          '  -f, --force           Overwrite the output file if it exists',
          '  -t, --tolerance <mm>  Max distance from the true surface, in millimetres',
          '                        (default: 0.1% of the part size)',
          '  -a, --angle <deg>     Max angle between adjacent facets, in degrees (default: 28.6)',
          '  -h, --help            Show this help',
          '  -v, --version         Show the version',
        ].join('\n'),
      );
    });
  });
});
