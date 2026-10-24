import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {readFileSync} from 'node:fs';
import {shieldFor} from '../pack-formats.mjs';

for (const [version, gitVersion, count] of [['0.5.0', '0.6.2', 63], ['0.6.0', '0.6.2', 69], ['0.8.0', '0.6.4', 105], ['0.8.1', '0.6.5', 105]]) {
  const path = new URL(`../../packs/canonic/baseline/${version}/pack.yml`, import.meta.url);
  const compatible = shieldFor(JSON.parse(readFileSync(path)));
  test(`Fresh native boundaries and Codex approval context with Baseline ${version}`,
    { skip: !compatible || process.platform === 'win32', timeout: 30000 }, () => {
      const result = spawnSync('python3', ['-I', new URL('../pack-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY,
        new URL(`../../packs/canonic/baseline/${version}/pack.yml`, import.meta.url).pathname,
        new URL(`../../packs/canonic/git/${gitVersion}/pack.yml`, import.meta.url).pathname],
      { encoding: 'utf8', timeout: 25000, maxBuffer: 4 * 1024 * 1024 });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      const report = JSON.parse(result.stdout);
      assert.equal(report.passed, true);
      assert.equal(report.cases.length, count);
    });
}
