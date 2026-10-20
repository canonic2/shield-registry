import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { buildSearchPack } from './build-baseline-search-pack.mjs';
import { validatorFor, shieldFor } from './pack-formats.mjs';

const root = new URL('../packs/canonic/baseline/0.2.1/', import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));

test('Search release retains every baseline rule and changes only engine admission and ripgrep guidance', () => {
  const current = read('../packs/canonic/baseline/0.2.1/pack.yml');
  const previous = read('../packs/canonic/baseline/0.2.0/pack.yml');
  assert.deepEqual(buildSearchPack(), current);
  const rule = current.rules.find(rule => rule.conditions.executable?.one_of.includes('rg'));
  assert.match(rule.on_unmet.message, /Filename listings accept globs/);
  assert.doesNotMatch(rule.on_unmet.message, /needs --no-ignore/);
  rule.on_unmet = previous.rules.find(old => old.id === rule.id).on_unmet;
  assert.deepEqual({ ...current, version: previous.version, engine: previous.engine }, previous);
  const cases = read('../packs/canonic/baseline/0.2.1/cases.json').cases;
  const oldCases = read('../packs/canonic/baseline/0.2.0/cases.json').cases;
  const supported = /^(rg-ignore-loading|rg-cwd-ignore-loading|rg-glob-tree|rg-glob-override)-(loose|recommended|strict)$/;
  assert.equal(cases.filter(c => supported.test(c.name)).length, 12);
  for (const [index, fixture] of cases.entries()) {
    assert.deepEqual(fixture, supported.test(fixture.name) ? { ...oldCases[index], expected: 'allow' } : oldCases[index]);
  }
  for (const name of ['commands.json', 'LICENSE']) {
    assert.deepEqual(readFileSync(new URL(name, root)), readFileSync(new URL(`../packs/canonic/baseline/0.2.0/${name}`, import.meta.url)));
  }
});

test('Search baseline preserves independent decision fixtures through production Shield', { skip: !shieldFor(read('../packs/canonic/baseline/0.2.1/pack.yml')) }, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', root).pathname, '--cases', new URL('cases.json', root).pathname], { encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, 387);
});

test('Search baseline verifies ignore-aware searches, glob listings and protected-state refusals in both native adapters', { skip: !shieldFor(read('../packs/canonic/baseline/0.2.1/pack.yml')) || process.platform === 'win32', timeout: 180000 }, () => {
  const result = spawnSync('python3', [new URL('baseline-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY, new URL('pack.yml', root).pathname, '--search-update'], { encoding: 'utf8', timeout: 170000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, 549);
});
