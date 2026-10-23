import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('Rust profiles and explicit paths reach both native agents with Baseline and Node',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32', timeout: 120000}, () => {
    const result = spawnSync('python3', ['-I', new URL('../rust-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY],
      {encoding: 'utf8', timeout: 115000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.projects, 3);
    assert.equal(report.cases.length, 240);
  });
