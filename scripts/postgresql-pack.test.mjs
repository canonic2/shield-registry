import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {commands, postgresqlPack} from './postgresql-policy.mjs';
import {postgresqlCases} from './postgresql-cases.mjs';
import {directory, guide} from './build-postgresql-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('PostgreSQL artifacts reproduce with valid schema and command discovery', () => {
  const pack = postgresqlPack();
  const validate = schemaValidator(schema);
  for (const [name, document] of [['pack.yml', pack], ['cases.json', postgresqlCases()]]) {
    const bytes = readFileSync(new URL(name, directory));
    assert.ok(bytes.length <= 1_048_576);
    assert.deepEqual(JSON.parse(bytes), document);
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.equal(readFileSync(new URL('LICENSE', directory), 'utf8'), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
  const ids = pack.rules.map(rule => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  const inventory = JSON.parse(readFileSync(new URL('commands.json', directory)));
  assert.deepEqual(inventory.commands.map(row => row.name), commands);
  assert.deepEqual(inventory.commands.flatMap(row => row.rule_ids), ids);
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/${pack.id}/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands[pack.id], commands);
});

test('Shield verifies all independent PostgreSQL decisions', {skip: !process.env.SHIELD_BINARY}, t => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname,
    '--cases', new URL('cases.json', directory).pathname], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, postgresqlCases().cases.length);
  t.diagnostic(`Evaluated ${report.cases.length} independent decisions.`);
});
