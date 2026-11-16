import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {previous, destination, engine, removedRules, changedRules, changedCases, grepEffectsPack, grepEffectsCases, grepEffectsCommands} from './build-baseline-grep-effects.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));
const compatibleShield = shieldFor(read('pack.yml'));
const grepRules = pack => pack.rules.filter(rule => rule.conditions.executable?.one_of?.includes('grep'));

test('Baseline grep effects release is reproducible, schema valid and keeps earlier rules', async () => {
  assert.deepEqual(read('pack.yml'), await grepEffectsPack());
  assert.deepEqual(read('cases.json'), await grepEffectsCases());
  assert.deepEqual(read('commands.json'), await grepEffectsCommands());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const pack = read('pack.yml');
  const earlier = read('pack.yml', previous);
  assert.deepEqual(pack.engines, {shield: engine});
  const touched = new Set([...removedRules, ...changedRules]);
  assert.deepEqual(pack.rules.filter(rule => !touched.has(rule.id)), earlier.rules.filter(rule => !touched.has(rule.id)));
  // grep keeps its earlier path check and refusal; only the option lists are gone.
  const grep = pack.rules.find(rule => rule.id === 'read-grep');
  const before = earlier.rules.find(rule => rule.id === 'read-grep');
  assert.deepEqual(grep.conditions, {domain: 'argv', executable: before.conditions.executable});
  assert.deepEqual(grep.requirements, {arguments: {kind: 'any'}, targets: before.requirements.targets});
  assert.deepEqual(grep.on_unmet.decision, before.on_unmet.decision);
  // No grep grammar lists options any more; the shared fallback still follows.
  for (const rule of grepRules(pack)) assert.notEqual(rule.conditions.arguments?.kind, 'options', rule.id);
  assert.deepEqual(grepRules(pack).map(rule => rule.id), grepRules(earlier).map(rule => rule.id).filter(id => !removedRules.includes(id)));
  const command = read('commands.json').commands.find(item => item.name === 'grep');
  assert.deepEqual(command.rule_ids, grepRules(pack).map(rule => rule.id));
  // Earlier cases keep their commands; only the listed decisions change.
  const cases = read('cases.json').cases;
  const earlierCases = read('cases.json', previous).cases;
  earlierCases.forEach((fixture, index) => {
    const name = fixture.name.slice(0, fixture.name.lastIndexOf('-'));
    assert.deepEqual(cases[index], {...fixture, expected: changedCases[name] ?? fixture.expected});
  });
  const changed = new Set(earlierCases.map(fixture => fixture.name.slice(0, fixture.name.lastIndexOf('-'))).filter(name => name in changedCases));
  assert.deepEqual([...changed].sort(), Object.keys(changedCases).sort());
});

test('Baseline grep effects decides its independent fixtures through production Shield', {skip: !compatibleShield}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
