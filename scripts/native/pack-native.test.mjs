import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const [version, count] of [['0.5.0', 63], ['0.6.0', 69]]) {
  test(`Fresh native boundaries and Codex approval context with Baseline ${version}`,
    { skip: !process.env.SHIELD_BINARY || process.platform === 'win32', timeout: 30000 }, () => {
      const result = spawnSync('python3', ['-I', new URL('../pack-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY,
        new URL(`../../packs/canonic/baseline/${version}/pack.yml`, import.meta.url).pathname,
        new URL('../../packs/canonic/git/0.6.2/pack.yml', import.meta.url).pathname],
      { encoding: 'utf8', timeout: 25000, maxBuffer: 4 * 1024 * 1024 });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      const report = JSON.parse(result.stdout);
      assert.equal(report.passed, true);
      assert.equal(report.cases.length, count);
    });
}
