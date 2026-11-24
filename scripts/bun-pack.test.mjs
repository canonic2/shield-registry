import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {commands, bunPack, bunInventory} from './bun-policy.mjs';
import {bunCases} from './bun-cases.mjs';
import {directory, guide} from './build-bun-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';

test('Bun sources reproduce schema-valid artifacts and discovery', async () => {
  const pack = bunPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(bunCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(Buffer.byteLength(source) <= 1_048_576, file);
    assert.equal(source, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), bunInventory(pack));
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/canonic/bun/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands['canonic/bun'], commands);
});

function evaluate(file, companions = []) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
    new URL('pack.yml', directory).pathname, '--cases', file, ...companions.flatMap(path => ['--with-pack', path])],
  {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  return report;
}

test('Shield reproduces every independent Bun decision alone and beside Node/Baseline', {skip: !process.env.SHIELD_BINARY}, async t => {
  const companions = ['node/0.5.1', 'baseline/0.17.0'].map(path => new URL(`../packs/canonic/${path}/pack.yml`, import.meta.url).pathname);
  let count = 0;
  for (const file of await caseFileNames(directory)) {
    const path = new URL(file, directory).pathname;
    count += evaluate(path).cases.length;
    evaluate(path, companions);
  }
  assert.equal(count, bunCases().cases.length);
  t.diagnostic(`Evaluated ${count} independent Bun decisions, alone and with Node/Baseline.`);
});

test('Bun fallback delegates package commands while preserving regular restrictions', {skip: !process.env.SHIELD_BINARY}, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'bun-pack-'));
  try {
    const path = join(scratch, 'cases.json');
    const prisma = new URL('../packs/canonic/prisma/0.1.0/pack.yml', import.meta.url).pathname;
    const cases = ['loose', 'recommended', 'strict'].flatMap(profile => ['bunx', 'bun'].map(name => ({
      name: `prisma-reset-${name}-${profile}`, profile, argv: [name, ...(name === 'bun' ? ['x'] : []), 'prisma', 'migrate', 'reset'],
      expected: profile === 'loose' ? 'ask' : 'deny',
    })));
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    evaluate(path, [prisma]);

    const companion = join(scratch, 'companion.json');
    const rows = [
      ['project-lint', ['run', 'lint'], 'allow'],
      ['package-install', ['install'], profile => profile === 'strict' ? 'deny' : 'ask'],
      ['listing-preload', ['pm', 'ls', '--preload=./example.ts'], profile => profile === 'strict' ? 'deny' : 'ask'],
    ];
    writeFileSync(companion, JSON.stringify({schema_version: 1, kind: 'pack', id: 'example/bun-project', version: '0.1.0',
      license: 'MIT', maintainers: ['Example'], description: 'Composition fixture.', engines: {shield: '>=0.53.0, <1.0.0'},
      capabilities: ['argument-rules-v1', 'structured-rules-v1'], rules: rows.map(([id, values]) => ({id, decision: 'allow',
        conditions: {domain: 'argv', executable: 'bun', arguments: {kind: 'exact', values}}}))}));
    writeFileSync(path, JSON.stringify({schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap(profile =>
      rows.map(([name, args, expected]) => ({name: `${name}-${profile}`, profile, argv: ['bun', ...args],
        expected: typeof expected === 'function' ? expected(profile) : expected})))}));
    evaluate(path, [companion]);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
