import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from '../src/cli.js';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

describe('README --help block', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches the text the CLI prints for --help, line for line', async () => {
    const block = readme.match(/```text\n(Usage: step23mf[\s\S]*?)\n```/);
    if (!block) throw new Error('README has no ```text block starting with "Usage: step23mf"');

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await main(['--help'])).toBe(0);
    const printed = log.mock.calls.map((args) => args.join(' ')).join('\n');

    expect(block[1].trimEnd()).toBe(printed.trimEnd());
  });
});
