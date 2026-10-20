import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSearchPack } from './build-baseline-search-pack.mjs';
import { validatorFor, shieldFor } from './pack-formats.mjs';

const root = new URL('../packs/canonic/baseline/0.2.2/', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));

test('Ordinary ripgrep release makes configuration optional without widening explicit options or paths', async t => {
  const current = read('../packs/canonic/baseline/0.2.2/pack.yml');
  const previous = read('../packs/canonic/baseline/0.2.1/pack.yml');
  assert.deepEqual(current, buildSearchPack({ ambientConfig: true }));
  const rule = current.rules.find(rule => rule.id === 'read-rg');
  const old = previous.rules.find(rule => rule.id === 'read-rg');
  rule.requirements.arguments.require_all = old.requirements.arguments.require_all;
  rule.on_unmet = old.on_unmet;
  assert.deepEqual({ ...current, version: previous.version, engine: previous.engine }, previous);
  const cases = read('../packs/canonic/baseline/0.2.2/cases.json').cases;
  const oldCases = read('../packs/canonic/baseline/0.2.1/cases.json').cases;
  const changed = /^(rg-config|rg-files-config)-(loose|recommended|strict)$/;
  assert.equal(cases.filter(c => changed.test(c.name)).length, 6);
  for (const [index, fixture] of cases.entries()) {
    assert.deepEqual(fixture, changed.test(fixture.name) ? { ...oldCases[index], expected: 'allow' } : oldCases[index]);
  }
  const output = await mkdtemp(join(tmpdir(), 'shield-baseline-usable-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [new URL('build-baseline-search-pack.mjs', import.meta.url).pathname, output, '--ambient-config'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['pack.yml', 'cases.json', 'commands.json', 'LICENSE']) {
    assert.deepEqual(readFileSync(join(output, name)), readFileSync(new URL(name, root)));
  }
});

test('Production Shield evaluates ordinary ripgrep and retains explicit risky-option refusals', { skip: !shieldFor(read('../packs/canonic/baseline/0.2.2/pack.yml')) }, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', root).pathname, '--cases', new URL('cases.json', root).pathname], { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, 387);
});

test('Both native adapters accept ordinary ripgrep and retain credential, state and outside-root protection', { skip: !shieldFor(read('../packs/canonic/baseline/0.2.2/pack.yml')) || process.platform === 'win32', timeout: 180000 }, () => {
  const result = spawnSync('python3', [new URL('baseline-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY, new URL('pack.yml', root).pathname, '--search-update', '--ambient-config'], { encoding: 'utf8', timeout: 170000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, 603);
});
