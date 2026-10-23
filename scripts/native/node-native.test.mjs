import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('Node manager selection reaches both native agents with actionable denial guidance',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32', timeout: 60000}, () => {
    const result = spawnSync('python3', ['-I', new URL('../node-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY],
      {encoding: 'utf8', timeout: 55000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.projects, 4);
    assert.ok(report.cases.length >= 60);
  });
