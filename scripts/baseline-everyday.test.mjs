import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {everydayPack, everydayCases, everydayCommands, destination, added, relative} from './build-baseline-everyday.mjs';

const previous = name => JSON.parse(readFileSync(new URL(`../packs/canonic/baseline/0.4.0/${name}`, import.meta.url)));
const current = name => JSON.parse(readFileSync(new URL(name, destination)));

test('Everyday commands add rules and change only three fallback reasons', async () => {
  const pack = current('pack.yml');
  assert.deepEqual(pack, await everydayPack());
  const old = previous('pack.yml');
  assert.deepEqual(pack.engines, {shield: '>=0.1.13, <0.3.0'});
  assert.deepEqual(pack.capabilities, old.capabilities);
  const ids = new Set(added.map(rule => rule.id));
  assert.equal(ids.size, added.length);
  assert.ok(!old.rules.some(rule => ids.has(rule.id)));
  const retained = pack.rules.filter(rule => !ids.has(rule.id));
  assert.equal(retained.length, old.rules.length);
  const changed = retained.filter((rule, index) => JSON.stringify(rule) !== JSON.stringify(old.rules[index]));
  assert.deepEqual(changed.map(rule => rule.id).sort(), ['review-make', 'shared-review-npm', 'shared-review-uv']);
  for (const rule of changed) {
    const {reason, ...rest} = rule;
    const {reason: _, ...before} = old.rules.find(other => other.id === rule.id);
    assert.deepEqual(rest, before);
  }
  // No removed deny rule and no new broad allow for interpreters or shells.
  for (const rule of added.filter(rule => rule.decision.loose === 'allow')) {
    for (const name of ['node', 'python3', 'bash', 'sh', 'npx', 'uv', 'curl', 'ssh', 'sudo']) {
      assert.ok(!rule.conditions.executable.one_of.includes(name), `${rule.id}: ${name}`);
    }
  }
});

test('The inventory lists every rule for each command name', async () => {
  const pack = current('pack.yml');
  const inventory = current('commands.json');
  assert.deepEqual(inventory, await everydayCommands());
  const base = name => name.slice(name.lastIndexOf('/') + 1);
  for (const {name, rule_ids} of inventory.commands) {
    assert.deepEqual(rule_ids, pack.rules.filter(r => r.conditions.executable?.one_of?.map(base).includes(name)).map(r => r.id), name);
  }
});

test('Directory options accept only relative folders without parent or hidden segments', () => {
  const pattern = new RegExp(`^(?:${relative})$`, 'u');
  for (const path of ['packages/shield', 'site', 'a/b-c/d_e.f/', 'v1.2']) assert.ok(pattern.test(path), path);
  for (const path of ['../other', 'a/../b', '/tmp/acme', '.git', 'a/.hidden', '', '~/acme', 'a//b']) {
    assert.ok(!pattern.test(path), path);
  }
});

test('Previous fixtures are retained, with project builds allowed like other local work', async () => {
  const cases = current('cases.json');
  assert.deepEqual(cases, await everydayCases());
  const old = previous('cases.json').cases;
  assert.deepEqual(cases.cases.slice(0, old.length).map(({expected, ...rest}) => rest),
    old.map(({expected, ...rest}) => rest));
  const changed = cases.cases.slice(0, old.length).filter((fixture, index) => fixture.expected !== old[index].expected);
  assert.deepEqual(changed.map(fixture => fixture.name).sort(), ['build-loose', 'build-recommended']);
  assert.ok(cases.cases.length <= 1024);
});

test('Production evaluator decides every fixture', {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});

test('Batch evaluator covers every usable/everyday policy case with Baseline 0.5.0',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32', timeout: 15000}, () => {
    const result = spawnSync('python3', ['-I', new URL('pack-batch.py', import.meta.url).pathname, process.env.SHIELD_BINARY,
      new URL('pack.yml', destination).pathname, new URL('../packs/canonic/git/0.6.2/pack.yml', import.meta.url).pathname],
    {encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr + result.stdout.slice(-4000));
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 204);
  });
