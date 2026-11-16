import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {previous, destination, recursiveGrepPack, recursiveGrepCases} from './build-baseline-recursive-grep.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';
import {baselinePreviewCasesPath} from './baseline-preview.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));
const compatibleShield = shieldFor(read('pack.yml'));

test('Baseline recursive grep release is reproducible, schema valid and keeps earlier rules', async () => {
  assert.deepEqual(read('pack.yml'), await recursiveGrepPack());
  assert.deepEqual(read('cases.json'), await recursiveGrepCases());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const pack = read('pack.yml');
  const earlier = read('pack.yml', previous);
  const changed = new Set(['read-grep', 'read-grep-recursive', 'grep-other']);
  assert.deepEqual(pack.rules.filter(rule => !changed.has(rule.id)), earlier.rules.filter(rule => !changed.has(rule.id)));
  const recursive = pack.rules.find(rule => rule.id === 'read-grep-recursive');
  // Unverified recursive searches ask in every profile; none is refused.
  assert.deepEqual(Object.values(recursive.on_unmet.decision), ['ask', 'ask', 'ask']);
  assert.deepEqual(recursive.requirements.targets, earlier.rules.find(rule => rule.id === 'read-grep').requirements.targets);
  const grep = read('commands.json').commands.find(command => command.name === 'grep');
  assert.deepEqual(grep.rule_ids, pack.rules.filter(rule => rule.conditions.executable?.one_of?.some(name => name.split('/').at(-1) === 'grep')).map(rule => rule.id));
  assert.deepEqual(read('cases.json').cases.slice(0, read('cases.json', previous).cases.length), read('cases.json', previous).cases);
});

test('Baseline recursive grep decides its independent fixtures through production Shield', {skip: !compatibleShield}, t => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', baselinePreviewCasesPath(t, new URL('cases.json', destination))], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
