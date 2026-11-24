import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {awsCdkSamPack} from './aws-cdk-sam-policy.mjs';
import {awsCdkSamCases} from './aws-cdk-sam-cases.mjs';
import {directory, guide} from './build-aws-cdk-sam-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('AWS CDK / SAM artifacts reproduce with valid schema and discovery metadata', () => {
  const pack = awsCdkSamPack();
  const validate = schemaValidator(schema);
  for (const [name, data] of [['pack.yml', pack], ['cases.json', awsCdkSamCases()]]) {
    const bytes = readFileSync(new URL(name, directory));
    assert.ok(bytes.length <= 1_048_576);
    assert.deepEqual(JSON.parse(bytes), data);
    assert.equal(validate(data), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.equal(readFileSync(new URL('LICENSE', directory), 'utf8'), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
  const ids = pack.rules.map(rule => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  const inventory = JSON.parse(readFileSync(new URL('commands.json', directory)));
  assert.deepEqual(inventory.commands.map(row => row.name), ['cdk', 'sam']);
  assert.deepEqual(inventory.commands.flatMap(row => row.rule_ids), ids);
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/${pack.id}/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands[pack.id], ['cdk', 'sam']);
});

test('Shield evaluates every independent AWS CDK / SAM fixture', {skip: !process.env.SHIELD_BINARY}, t => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname,
    '--cases', new URL('cases.json', directory).pathname], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, awsCdkSamCases().cases.length);
  t.diagnostic(`Evaluated ${report.cases.length} independent decisions.`);
});
