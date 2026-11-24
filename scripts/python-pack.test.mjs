import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {directory, guide} from './build-python-pack.mjs';
import {pythonPack, commands} from './python-policy.mjs';
import {pythonCases, withBaselineCases} from './python-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {ecosystem, ecosystemAliases, discoveryCommands} from './python-ecosystem-policy.mjs';
import {checkPublication} from './registry-release.mjs';

test('Python authenticates the publication baseline and preserves published assets', async () => {
  const catalog = await checkPublication(new URL('../public/', import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  if (catalog.releases.some(row => row.id === 'canonic/python' && row.version === '0.1.0')) {
    const published = new URL('../public/packs/canonic/python/0.1.0/', import.meta.url);
    assert.deepEqual(await caseFileNames(directory), await caseFileNames(published));
    for (const file of ['pack.yml', 'commands.json', 'README.md', 'LICENSE', ...await caseFileNames(directory)])
      assert.deepEqual(readFileSync(new URL(file, directory)), readFileSync(new URL(file, published)),
        `Published Python ${file} requires a successor version`);
  }
});

test('Python policy, fixtures, inventory and guide reproduce', async () => {
  const validate = schemaValidator(schema);
  const pack = pythonPack();
  const fixtures = splitCaseFiles(pythonCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory));
    assert.ok(bytes.length <= 1_048_576);
    assert.deepEqual(JSON.parse(bytes), document);
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide);
  assert.ok(Buffer.byteLength(guide) <= 1_048_576);
  assert.equal(readFileSync(new URL('LICENSE', directory), 'utf8'), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
  assert.equal(new Set(pack.rules.map(rule => rule.id)).size, pack.rules.length);
  const inventory = JSON.parse(readFileSync(new URL('commands.json', directory)));
  assert.deepEqual(inventory.commands.map(row => row.name), commands);
  assert.deepEqual([...new Set(inventory.commands.flatMap(row => row.rule_ids))].sort(), pack.rules.map(rule => rule.id).sort());
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/python/0.1.0/pack.yml').length, 1);
  assert.deepEqual(manifest.commands['canonic/python'], discoveryCommands);
  assert.ok(discoveryCommands.length <= 16 && new Set(discoveryCommands).size === discoveryCommands.length);
  assert.ok(discoveryCommands.every(name => commands.includes(name)));
});

test('every reviewed ecosystem operation and executable has independent profile fixtures', () => {
  const cases = pythonCases().cases;
  const names = new Set();
  for (const fixture of cases) {
    assert.equal(names.has(fixture.name), false, fixture.name);
    names.add(fixture.name);
  }
  for (const profile of ['loose', 'recommended', 'strict']) {
    const fixtures = cases.filter(fixture => fixture.profile === profile && fixture.argv);
    for (const name of commands) assert.ok(fixtures.some(fixture => fixture.argv[0] === name), `${name}: ${profile}`);
    for (const [name, tool] of Object.entries(ecosystem)) for (const operation of tool.operations) {
      const prefix = [name, ...operation.split(' ')];
      assert.ok(fixtures.some(fixture => prefix.every((word, index) => fixture.argv[index] === word)), `${prefix.join(' ')}: ${profile}`);
    }
    for (const [alias, name] of Object.entries(ecosystemAliases))
      assert.ok(fixtures.some(fixture => fixture.argv[0] === alias && fixture.expected === (profile === 'strict' ? 'deny' : 'ask')), `${alias}: ${name}`);
  }
});

test('production Shield verifies independent Python decisions alone and with Baseline/Node', {skip: !process.env.SHIELD_BINARY}, async t => {
  let count = 0;
  const companions = ['baseline/0.17.0', 'node/0.5.1'].map(path =>
    new URL(`../packs/canonic/${path}/pack.yml`, import.meta.url).pathname);
  const scratch = mkdtempSync(join(tmpdir(), 'python-pack-composition-'));
  try {
    for (const file of await caseFileNames(directory)) {
      for (const withPacks of [[], companions]) {
        let casesPath = new URL(file, directory).pathname;
        if (withPacks.length) {
          const composed = withBaselineCases(JSON.parse(readFileSync(casesPath)));
          casesPath = join(scratch, file);
          writeFileSync(casesPath, JSON.stringify(composed));
        }
        const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname,
          '--cases', casesPath, ...withPacks.flatMap(path => ['--with-pack', path])],
        {encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
        assert.ifError(result.error);
        const report = JSON.parse(result.stdout || '{}');
        assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
        assert.equal(report.passed, true);
        assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
        if (!withPacks.length) count += report.cases.length;
      }
    }
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
  assert.equal(count, pythonCases().cases.length);
  t.diagnostic(`Evaluated ${count} decisions across all profiles, alone and with Baseline/Node.`);
});
