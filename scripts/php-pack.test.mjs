import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {commands, discoveryCommands, phpPack} from './php-policy.mjs';
import {phpCases, toolRequests} from './php-cases.mjs';
import {directory, guide} from './build-php-pack.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('PHP and Laravel sources reproduce with valid policy, fixtures and discovery', async () => {
  const pack = phpPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(phpCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory));
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
  assert.deepEqual(inventory.commands.flatMap(row => row.rule_ids).sort(), [...ids].sort());
  assert.deepEqual([...toolRequests.map(([name]) => name), 'php', 'composer', 'artisan'].sort(), [...commands].sort());
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/${pack.id}/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands[pack.id], discoveryCommands);
});

test('Shield verifies every independent PHP and Laravel decision', {skip: !process.env.SHIELD_BINARY}, async t => {
  let count = 0;
  for (const file of await caseFileNames(directory)) {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname,
      '--cases', new URL(file, directory).pathname], {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
    count += report.cases.length;
  }
  assert.equal(count, phpCases().cases.length);
  t.diagnostic(`Evaluated ${count} independent decisions.`);
});
