import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {directory, guide} from './build-sqlite-pack.mjs';
import {commands, sqlitePack, sqliteInventory} from './sqlite-policy.mjs';
import {sqliteCases} from './sqlite-cases.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('SQLite artifacts reproduce with valid schema, inventory and release association', async () => {
  const pack = sqlitePack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(sqliteCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(Buffer.byteLength(bytes) <= 1_048_576, file);
    assert.equal(bytes, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), sqliteInventory(pack));
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  const ids = pack.rules.map(row => row.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(sqliteInventory(pack).commands.flatMap(row => row.rule_ids), ids);
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/canonic/sqlite/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands['canonic/sqlite'], commands);
});

function evaluate(file, companion) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
    new URL('pack.yml', directory).pathname, '--cases', file, ...(companion ? ['--with-pack', companion] : [])],
  {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  return report;
}

test('production Shield reproduces every independent SQLite decision', {skip: !process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const report = evaluate(new URL(file, directory).pathname);
    assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
    total += report.cases.length;
  }
  assert.equal(total, sqliteCases().cases.length);
  t.diagnostic(`Evaluated ${total} independent SQLite decisions.`);
});

test('SQLite restrictions survive another community pack allowing the same tools', {skip: !process.env.SHIELD_BINARY}, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'sqlite-composition-'));
  try {
    const companion = join(scratch, 'companion.json');
    writeFileSync(companion, JSON.stringify({schema_version: 1, kind: 'pack', id: 'example/broad-tools', version: '0.1.0',
      license: 'MIT', maintainers: ['Example'], description: 'Composition test fixture.',
      engines: {shield: '>=0.53.0, <1.0.0'}, capabilities: ['argument-rules-v1', 'structured-rules-v1'],
      rules: [{id: 'allow-tools', decision: 'allow', conditions: {domain: 'argv', executable: {one_of: commands}, arguments: {kind: 'any'}}}]}));
    const file = join(scratch, 'cases.json');
    const cases = sqliteCases().cases.filter(row => /^(version|select|safe-readonly-select|backup|sqldiff|analyzer-tcl|rsync-remote)-/.test(row.name));
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    assert.equal(evaluate(file, companion).cases.length, cases.length);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
