import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {previous, destination, ruleId, capability, loopbackPack, loopbackCommands, loopbackReleaseCases} from './build-baseline-loopback.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));

test('Baseline loopback source reproduces while preserving earlier rules and cases', async () => {
  assert.deepEqual(read('pack.yml'), await loopbackPack());
  assert.deepEqual(read('commands.json'), await loopbackCommands());
  assert.deepEqual(read('cases.json'), await loopbackReleaseCases());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const pack = read('pack.yml');
  const old = read('pack.yml', previous);
  assert.deepEqual(pack.rules.filter(rule => rule.id !== ruleId), old.rules);
  assert.deepEqual(pack.capabilities.filter(name => name !== capability), old.capabilities);
  const earlier = read('cases.json', previous).cases;
  assert.deepEqual(read('cases.json').cases.slice(0, earlier.length), earlier);
});

test('Baseline loopback fixtures pass production Shield admission and decisions', {skip: !process.env.SHIELD_BINARY}, () => {
  assert.ok(shieldFor(read('pack.yml')), 'Shield must support the pending pack');
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
