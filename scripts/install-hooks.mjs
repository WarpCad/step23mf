// Point git at the repository's hooks (.githooks/pre-push runs the tests before every push).
// Runs from `npm install` through the `prepare` script. Does nothing outside a git checkout, and is
// plain Node rather than a shell one-liner so it also works where npm runs scripts in cmd.exe.

import { spawnSync } from 'node:child_process';

const inRepo = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' }).status === 0;
if (inRepo) spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'inherit' });
