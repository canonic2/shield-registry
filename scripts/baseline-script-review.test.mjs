import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {destination, scriptReviewPack, scriptReviewCases} from './build-baseline-script-review.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
const compatibleShield = shieldFor(read('pack.yml'));
test('Baseline script-review release is reproducible and schema valid', async () => {
  assert.deepEqual(read('pack.yml'), await scriptReviewPack());
  assert.deepEqual(read('cases.json'), await scriptReviewCases());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const pack = read('pack.yml');
  for (const command of read('commands.json').commands) {
    assert.deepEqual(command.rule_ids, pack.rules.filter(rule => rule.conditions.executable?.one_of?.some(name => name.split('/').at(-1) === command.name)).map(rule => rule.id));
  }
});

test('Baseline script review preserves other production fixture decisions', {skip: !compatibleShield}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
