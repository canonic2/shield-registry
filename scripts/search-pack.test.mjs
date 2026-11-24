import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {directory, guide} from './build-search-pack.mjs';
import {searchPack, searchInventory} from './search-policy.mjs';
import {searchCases} from './search-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';

test('search pack sources reproduce schema-valid policy and independent fixtures', async () => {
  const pack = searchPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(searchCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(Buffer.byteLength(source) <= 1_048_576, file);
    assert.equal(source, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), searchInventory(pack));
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  assert.equal(new Set(pack.rules.map(rule => rule.id)).size, pack.rules.length);
  const release = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(release.packs.filter(path => path === `packs/canonic/opensearch-elasticsearch/${pack.version}/pack.yml`).length, 1);
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

test('production Shield reproduces every independent search decision', {skip: !process.env.SHIELD_BINARY}, async t => {
  let count = 0;
  for (const file of await caseFileNames(directory)) {
    const report = evaluate(new URL(file, directory).pathname);
    assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
    count += report.cases.length;
  }
  assert.equal(count, searchCases().cases.length);
  t.diagnostic(`Evaluated ${count} independent OpenSearch / Elasticsearch decisions.`);
});

test('search HTTP restrictions compose with Baseline loopback allowances', {skip: !process.env.SHIELD_BINARY}, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'search-pack-'));
  try {
    const path = join(scratch, 'cases.json');
    const cases = searchCases().cases.filter(row => /^(http-(health|search|security|bulk)|shell-query)-/.test(row.name));
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    const companion = new URL('../packs/canonic/baseline/0.17.0/pack.yml', import.meta.url).pathname;
    assert.equal(evaluate(path, companion).cases.length, cases.length);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
