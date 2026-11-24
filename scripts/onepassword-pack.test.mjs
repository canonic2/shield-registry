import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {directory, guide} from './build-onepassword-pack.mjs';
import {onepasswordPack, onepasswordInventory} from './onepassword-policy.mjs';
import {onepasswordCases} from './onepassword-cases.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('1Password sources reproduce schema-valid policy, fixtures and inventory', async () => {
  const pack = onepasswordPack();
  const fixtures = splitCaseFiles(onepasswordCases());
  const validate = schemaValidator(schema);
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(Buffer.byteLength(bytes) <= 1_048_576, file);
    assert.equal(bytes, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), onepasswordInventory(pack));
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  const release = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(release.packs.filter(path => path === `packs/canonic/1password/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(release.commands['canonic/1password'], ['op']);
});

test('production Shield reproduces every independent 1Password decision', {skip: !process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
      new URL('pack.yml', directory).pathname, '--cases', new URL(file, directory).pathname],
    {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
    total += report.cases.length;
  }
  assert.equal(total, onepasswordCases().cases.length);
  t.diagnostic(`Evaluated ${total} independent 1Password decisions.`);
});
