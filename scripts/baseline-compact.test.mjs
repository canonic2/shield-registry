import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import { schema } from './policy-schema.mjs';
import { buildBaselinePack, baselineCommands } from './build-baseline-pack.mjs';
import { compactBaselinePack } from './baseline-compact.mjs';
import { validatorFor, shieldFor } from './pack-formats.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const original = read('../packs/canonic/baseline/0.1.5/pack.yml');
const compact = read('../packs/canonic/baseline/0.2.0/pack.yml');
const fixtures = read('../packs/canonic/baseline/0.2.0/cases.json');
const { families } = compactBaselinePack(original);
const byId = new Map(original.rules.map(rule => [rule.id, rule]));

test('Compact baseline folds only identical bodies and preserves every executable alias and predicate', () => {
  assert.deepEqual(buildBaselinePack(), original);
  assert.deepEqual(buildBaselinePack({ version: '0.2.0', compact: true }), compact);
  assert.equal(compact.rules.length, 71);
  assert.equal(validatorFor(compact)(compact), true);
  const seen = new Set();
  for (const rule of compact.rules) {
    const aliases = [];
    for (const id of families[rule.id]) {
      assert.equal(seen.has(id), false); seen.add(id);
      const source = byId.get(id);
      const reconstructed = structuredClone(rule);
      reconstructed.id = id;
      if (source.conditions.domain === 'argv') {
        aliases.push(...source.conditions.executable.one_of);
        reconstructed.conditions.executable = source.conditions.executable;
      }
      assert.deepEqual(reconstructed, source, id);
    }
    if (rule.conditions.domain === 'argv') {
      assert.equal(new Set(aliases).size, aliases.length, rule.id);
      assert.deepEqual(rule.conditions.executable.one_of, aliases, rule.id);
    }
  }
  assert.equal(seen.size, original.rules.length);
  const commands = read('../packs/canonic/baseline/0.2.0/commands.json');
  assert.deepEqual(commands.commands.map(({ source_rule_ids, ...command }) => command), baselineCommands(compact).commands);
  for (const command of commands.commands) {
    const sourceIds = original.rules.filter(rule => rule.conditions.domain === 'argv'
      && rule.conditions.executable.one_of.includes(command.name)).map(rule => rule.id);
    assert.deepEqual([...command.source_rule_ids].sort(), sourceIds.sort(), command.name);
  }
});

test('Compact baseline assets are reproducible and retain independent published expectations', async t => {
  assert.deepEqual(fixtures, read('../packs/canonic/baseline/0.1.5/cases.json'));
  const output = await mkdtemp(join(tmpdir(), 'shield-baseline-compact-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [new URL('build-baseline-compact-pack.mjs', import.meta.url).pathname, output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['pack.yml', 'cases.json', 'commands.json', 'LICENSE']) {
    assert.deepEqual(readFileSync(join(output, name)), readFileSync(new URL(`../packs/canonic/baseline/0.2.0/${name}`, import.meta.url)));
  }
});

function run(version) {
  const root = new URL(`../packs/canonic/baseline/${version}/`, import.meta.url);
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--details', '--pack', new URL('pack.yml', root).pathname, '--cases', new URL('../packs/canonic/baseline/0.2.1/cases.json', import.meta.url).pathname],
    { encoding: 'utf8', timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true); assert.equal(report.cases.length, 387);
  for (const [index, fixture] of report.cases.entries()) {
    const canonicalId = id => {
      if (byId.has(id)) return id;
      const members = families[id].filter(member => byId.get(member).conditions.executable.one_of.includes(fixtures.cases[index].argv[0]));
      assert.equal(members.length, 1, id);
      return members[0];
    };
    const normalize = value => {
      if (Array.isArray(value)) return value.map(normalize);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.entries(value).filter(([key]) => !['revision', 'digest', 'version'].includes(key))
        .map(([key, value]) => [key, key === 'rule_id' ? canonicalId(value) : normalize(value)]));
    };
    const normalized = normalize(fixture);
    // Match rows are keyed evidence, not precedence: compare every field and
    // applied flag while removing ordering changes caused solely by family IDs.
    normalized.evaluation.matches.sort((a, b) => a.rule_id.localeCompare(b.rule_id));
    report.cases[index] = normalized;
  }
  return report;
}

test('Production Shield preserves all 387 baseline decisions and complete explanations, with family IDs resolved to their source member', { skip: !shieldFor(compact) }, () => {
  const current = run('0.2.0'), previous = run('0.1.5');
  assert.deepEqual({ ...current, cases: [] }, { ...previous, cases: [] });
  for (const [index, fixture] of current.cases.entries()) {
    assert.deepEqual(fixture, previous.cases[index], fixture.name);
  }
});

test('Compact baseline retains all 507 real native hook and path cases', { skip: !shieldFor(compact) || process.platform === 'win32', timeout: 180_000 }, () => {
  const result = spawnSync('python3', [new URL('baseline-native.py', import.meta.url).pathname, process.env.SHIELD_BINARY,
    new URL('../packs/canonic/baseline/0.2.0/pack.yml', import.meta.url).pathname], { encoding: 'utf8', timeout: 170_000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.passed, true); assert.equal(report.cases.length, 507);
});
