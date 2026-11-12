import { beforeEach, describe, expect, it, vi } from 'vitest';

// step.js loads the CJS WASM package with createRequire, which vi.mock('occt-import-js') cannot
// intercept. Mock createRequire itself so the factory the module receives is our fake.
const h = vi.hoisted(() => /** @type {{ factory: unknown }} */ ({ factory: null }));
vi.mock('node:module', () => ({
  createRequire: () => (/** @type {string} */ id) => {
    if (id !== 'occt-import-js') throw new Error(`unexpected require ${id}`);
    return h.factory;
  },
}));

const HEADER = 'ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n';
const bytesOf = (/** @type {string} */ s) => new TextEncoder().encode(s);

/** @typedef {import('../src/step.js').StepError} StepErrorT */

/** A reader result with one mesh of one triangle. */
function okResult() {
  return {
    success: true,
    root: { name: 'Cube', meshes: [0], children: [] },
    meshes: [
      {
        name: 'Cube',
        color: [0.6, 0.6, 0.6],
        brep_faces: [],
        attributes: { position: { array: new Float32Array(9) } },
        index: { array: new Uint32Array([0, 1, 2]) },
      },
    ],
  };
}

/**
 * Install a fake WASM factory. `read` decides the result of ReadStepFile and may call the
 * `print` handed to the factory, the way OCCT reports parse errors.
 * @param {(print: (s: string) => void, bytes: Uint8Array, opts: object | null) => object} read
 */
function installFactory(read) {
  const printHolder = /** @type {{ print: (s: string) => void }} */ ({ print: () => {} });
  const ReadStepFile = vi.fn((bytes, opts) => read(printHolder.print, bytes, opts));
  h.factory = vi.fn(async (moduleArgs) => {
    printHolder.print = moduleArgs.print;
    return { ReadStepFile };
  });
  return { factory: h.factory, ReadStepFile };
}

describe('readStep', () => {
  /** @type {typeof import('../src/step.js').readStep} */
  let readStep;
  /** @type {typeof import('../src/step.js').StepError} */
  let StepError;

  beforeEach(async () => {
    vi.resetModules();
    ({ readStep, StepError } = await import('../src/step.js'));
  });

  describe('input checks (before WASM)', () => {
    it('throws EMPTY for zero bytes without calling the reader', async () => {
      const { ReadStepFile } = installFactory(() => okResult());
      const err = /** @type {StepErrorT} */ (await readStep(new Uint8Array(0)).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err).toBeInstanceOf(StepError);
      expect(err.code).toBe('EMPTY');
      expect(err.message).toBe('the file is empty');
      expect(ReadStepFile).not.toHaveBeenCalled();
    });

    it('throws NOT_STEP for text that is not a STEP header', async () => {
      const { ReadStepFile } = installFactory(() => okResult());
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf('hello')).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err).toBeInstanceOf(StepError);
      expect(err.code).toBe('NOT_STEP');
      expect(err.message).toBe('not a STEP file (it should start with ISO-10303-21;)');
      expect(ReadStepFile).not.toHaveBeenCalled();
    });

    it('treats a file shorter than the header as NOT_STEP', async () => {
      installFactory(() => okResult());
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf('ISO-10')).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err.code).toBe('NOT_STEP');
    });

    it('accepts a UTF-8 BOM, leading blank lines and CRLF line endings', async () => {
      installFactory(() => okResult());
      const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytesOf(HEADER)]);
      const blank = bytesOf('\r\n  \n' + HEADER.replace(/\n/g, '\r\n'));
      await expect(readStep(bom)).resolves.toBeDefined();
      await expect(readStep(blank)).resolves.toBeDefined();
    });
  });

  describe('reader failures', () => {
    it('throws DAMAGED with the reason cut from the captured OCCT line', async () => {
      installFactory((print) => {
        print(
          "**** ERR StepFile : Undefined Parsing: Line 4: Incorrect syntax: unexpected end of file, expecting '('    ****",
        );
        return { success: false };
      });
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf(HEADER)).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err).toBeInstanceOf(StepError);
      expect(err.code).toBe('DAMAGED');
      expect(err.message).toBe(
        "the STEP file is damaged or incomplete: Line 4: Incorrect syntax: unexpected end of file, expecting '('",
      );
    });

    it('falls back to a fixed reason when OCCT printed no parse line', async () => {
      installFactory(() => ({ success: false }));
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf(HEADER)).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err.code).toBe('DAMAGED');
      expect(err.message).toBe('the STEP file is damaged or incomplete: OpenCascade could not parse it');
    });

    it('throws NO_GEOMETRY when the reader succeeds with no meshes', async () => {
      installFactory(() => ({ success: true, root: { name: '', meshes: [], children: [] }, meshes: [] }));
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf(HEADER)).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err.code).toBe('NO_GEOMETRY');
      expect(err.message).toBe('the STEP file has no solid geometry to convert');
    });

    it('throws NO_GEOMETRY when every mesh has zero triangles', async () => {
      installFactory(() => {
        const r = okResult();
        r.meshes[0].index.array = new Uint32Array(0);
        return r;
      });
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf(HEADER)).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err.code).toBe('NO_GEOMETRY');
    });

    it('never throws a bare Error', async () => {
      installFactory(() => ({ success: false }));
      const err = /** @type {StepErrorT} */ (await readStep(bytesOf(HEADER)).catch((/** @type {unknown} */ e) => /** @type {StepErrorT} */ (e)));
      expect(err.constructor.name).toBe('StepError');
    });
  });

  describe('success path', () => {
    it('passes millimetres and deflection options through to the reader', async () => {
      const { ReadStepFile } = installFactory(() => okResult());
      await readStep(bytesOf(HEADER), { linearDeflection: 0.2, angularDeflection: 0.4 });
      const [, opts] = ReadStepFile.mock.calls[0];
      expect(opts).toMatchObject({ linearUnit: 'millimeter', linearDeflection: 0.2, angularDeflection: 0.4 });
    });

    it('returns the raw reader result', async () => {
      installFactory(() => okResult());
      const result = await readStep(bytesOf(HEADER));
      expect(result.success).toBe(true);
      expect(result.meshes).toHaveLength(1);
      expect(result.root.children).toEqual([]);
    });

    it('loads the WASM factory once across two calls', async () => {
      const { factory } = installFactory(() => okResult());
      await readStep(bytesOf(HEADER));
      await readStep(bytesOf(HEADER));
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('collects reader output instead of writing to stdout', async () => {
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      installFactory((print) => {
        print('**** some OCCT chatter ****');
        return okResult();
      });
      await readStep(bytesOf(HEADER));
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
