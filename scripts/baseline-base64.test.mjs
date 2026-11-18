import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {previous, destination, ruleId, base64Pack, base64Commands, base64ReleaseCases} from './build-baseline-base64.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';
import {sedAddressRules} from './sed-addresses.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));

test('Baseline stream and sed source reproduces while preserving earlier boundaries', async () => {
  assert.deepEqual(read('pack.yml'), await base64Pack());
  assert.deepEqual(read('commands.json'), await base64Commands());
  assert.deepEqual(read('cases.json'), await base64ReleaseCases());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const inherited = read('pack.yml').rules.filter(rule => rule.id !== ruleId);
  const old = read('pack.yml', previous).rules;
  assert.deepEqual(inherited.map(rule => {
    const restored = structuredClone(rule);
    const before = old.find(previous => previous.id === rule.id);
    if (sedAddressRules.includes(rule.id)) restored.conditions.arguments.prefix = before.conditions.arguments.prefix;
    if (rule.id === 'review-sed') restored.guidance.message = before.guidance.message;
    return restored;
  }), old);
  const earlier = read('cases.json', previous).cases;
  assert.deepEqual(read('cases.json').cases.slice(0, earlier.length), earlier.map(fixture =>
    fixture.name === 'rg-missing-recommended' ? {...fixture, expected: 'allow'} : fixture));
});

test('Baseline Base64 independent fixtures pass production Shield admission and decisions', {skip: !process.env.SHIELD_BINARY}, () => {
  assert.ok(shieldFor(read('pack.yml')), 'Shield must support the pending pack');
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
