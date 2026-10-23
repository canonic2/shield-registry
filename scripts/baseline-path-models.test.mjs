import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathModelsPack, pathModelsCases, pathModelsCommands, pathModelsRules, destination} from './build-baseline-path-models.mjs';

const previous = name => JSON.parse(readFileSync(new URL(`../packs/canonic/baseline/0.5.0/${name}`, import.meta.url)));
const current = name => JSON.parse(readFileSync(new URL(name, destination)));

test('Path models add rules for Shield 0.2.0 and keep every 0.5.0 rule', async () => {
  const pack = current('pack.yml');
  assert.deepEqual(pack, await pathModelsPack());
  assert.deepEqual(pack.engines, {shield: '>=0.2.0, <0.3.0'});
  const old = previous('pack.yml');
  assert.deepEqual(pack.rules.slice(0, old.rules.length), old.rules);
  const added = pack.rules.slice(old.rules.length);
  assert.deepEqual(added, await pathModelsRules(old));
  assert.equal(new Set(pack.rules.map(rule => rule.id)).size, pack.rules.length);
  // Each file-changing rule checks its targets and denies when they fail.
  for (const rule of added.filter(rule => rule.requirements)) {
    assert.deepEqual(rule.on_unmet.decision, {loose: 'deny', recommended: 'deny', strict: 'deny'}, rule.id);
    for (const target of [rule.requirements.targets].flat()) {
      const exclusions = target.all.exclude.map(entry => entry.path);
      assert.ok(target.action === 'read' ? exclusions.includes('.ssh') : exclusions.includes('.git'), rule.id);
    }
  }
  // Hard links read their source; symbolic links do not.
  const actions = id => [added.find(rule => rule.id === id).requirements.targets].flat().map(t => t.action);
  assert.deepEqual(actions('link-hard'), ['read', 'write']);
  assert.deepEqual(actions('link-symbolic'), ['write']);
});

test('The inventory lists every rule for each command name', async () => {
  const pack = current('pack.yml');
  const inventory = current('commands.json');
  assert.deepEqual(inventory, await pathModelsCommands());
  const base = name => name.slice(name.lastIndexOf('/') + 1);
  for (const {name, rule_ids} of inventory.commands) {
    assert.deepEqual(rule_ids, pack.rules.filter(r => r.conditions.executable?.one_of?.map(base).includes(name)).map(r => r.id), name);
  }
});

test('Previous fixtures are retained except the review cases now decided by path', async () => {
  const cases = current('cases.json');
  assert.deepEqual(cases, await pathModelsCases());
  const names = new Set(cases.cases.map(fixture => fixture.name));
  const dropped = previous('cases.json').cases.filter(fixture => !names.has(fixture.name))
    .map(fixture => fixture.name.replace(/^usable-/, '').replace(/-(loose|recommended|strict)$/, ''));
  assert.deepEqual([...new Set(dropped)].sort(), ['chmod', 'column-file', 'comm-files', 'less', 'ln', 'nl-file', 'tee']);
  for (const fixture of previous('cases.json').cases.filter(fixture => names.has(fixture.name))) {
    assert.deepEqual(cases.cases.find(other => other.name === fixture.name), fixture);
  }
  assert.ok(cases.cases.length <= 1024);
});

test('Production evaluator decides every fixture', {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});

test('Batch evaluator covers every usable/everyday policy case with Baseline 0.6.0',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32', timeout: 15000}, () => {
    const result = spawnSync('python3', ['-I', new URL('pack-batch.py', import.meta.url).pathname, process.env.SHIELD_BINARY,
      new URL('pack.yml', destination).pathname, new URL('../packs/canonic/git/0.6.2/pack.yml', import.meta.url).pathname],
    {encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr + result.stdout.slice(-4000));
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 228);
  });
