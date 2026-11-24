import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applePack, appleInventory, commands, tools, discoveryCommands} from './apple-policy.mjs';
import {appleCases} from './apple-cases.mjs';
import {directory, guide} from './build-apple-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {checkPublication} from './registry-release.mjs';

test('Apple authenticates the catalog and preserves any published version bytes', async () => {
  const catalog = await checkPublication(new URL('../public/', import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  const published = catalog.releases.find(row => row.id === 'canonic/apple' && row.version === '0.1.0');
  if (published) for (const file of ['pack.yml', 'commands.json', 'README.md', 'LICENSE', ...await caseFileNames(directory)])
    assert.deepEqual(readFileSync(new URL(file, directory)),
      readFileSync(new URL(`../public/packs/canonic/apple/0.1.0/${file}`, import.meta.url)),
      `Published ${file} needs a successor version`);
});

test('Apple policy, fixtures, inventory, license and guide reproduce within source bounds', async () => {
  const pack = applePack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(appleCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory));
    assert.ok(bytes.length <= 1_048_576, `${file}: ${bytes.length}`);
    assert.equal(bytes.toString(), JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide);
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), appleInventory(pack));
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  assert.deepEqual([...new Set(appleInventory(pack).commands.flatMap(row => row.rule_ids))].sort(), pack.rules.map(row => row.id).sort());
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/apple/0.1.0/pack.yml').length, 1);
  assert.deepEqual(manifest.commands['canonic/apple'], discoveryCommands);
  assert.ok(discoveryCommands.length <= 16 && discoveryCommands.every(name => commands.includes(name)));
});

test('Every Apple executable and inventoried operation has independent profile decisions', () => {
  const cases = appleCases().cases;
  assert.equal(new Set(cases.map(row => row.name)).size, cases.length);
  for (const profile of ['loose', 'recommended', 'strict']) {
    const fixtures = cases.filter(row => row.profile === profile && row.argv);
    for (const name of commands) assert.ok(fixtures.some(row => row.argv[0] === name), `${name}: ${profile}`);
    for (const [name, tool] of Object.entries(tools)) for (const operation of tool.operations) {
      const prefix = [name, ...operation.split(' ')];
      assert.ok(fixtures.some(row => prefix.every((word, index) => row.argv[index] === word)), `${prefix.join(' ')}: ${profile}`);
    }
  }
});

test('Production Shield verifies Apple decisions and Baseline/Node composition', {skip: !process.env.SHIELD_BINARY}, async t => {
  const scratch = mkdtempSync(join(tmpdir(), 'apple-pack-'));
  const companions = ['baseline/0.17.0', 'node/0.5.1'].map(path =>
    new URL(`../packs/canonic/${path}/pack.yml`, import.meta.url).pathname);
  let count = 0;
  try {
    for (const file of await caseFileNames(directory)) {
      const originalPath = new URL(file, directory).pathname;
      const document = JSON.parse(readFileSync(originalPath));
      for (const withPacks of [[], companions]) {
        const casesPath = withPacks.length ? join(scratch, file) : originalPath;
        if (withPacks.length) writeFileSync(casesPath, JSON.stringify({...document, cases: document.cases.map(row =>
          // Independent Baseline 0.17.0 expectation: these direct secret reads
          // are denied even when Apple alone would request review.
          row.argv && ['security', '/usr/bin/security'].includes(row.argv[0]) &&
          ['find-generic-password', 'find-internet-password', 'dump-keychain', 'export'].includes(row.argv[1])
            ? {...row, expected: 'deny'} : row)}));
        const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname,
          '--cases', casesPath, ...withPacks.flatMap(path => ['--with-pack', path])],
        {encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
        assert.ifError(result.error);
        const report = JSON.parse(result.stdout || '{}');
        assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
        assert.equal(report.passed, true);
        assert.equal(report.cases.length, document.cases.length);
        if (!withPacks.length) count += report.cases.length;
      }
    }
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
  assert.equal(count, appleCases().cases.length);
  t.diagnostic(`Evaluated ${count} independent decisions alone and with Baseline/Node.`);
});
