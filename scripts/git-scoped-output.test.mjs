import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gitScopedOutputPack, outputRevision} from './build-git-allow-by-default.mjs';
import {gitOutputCases} from './git-output-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication, digest} from './registry-release.mjs';

const previous = new URL('../packs/canonic/git/0.11.0/', import.meta.url);
const current = new URL(`../packs/canonic/git/${outputRevision}/`, import.meta.url);
const read = (directory, file) => JSON.parse(readFileSync(new URL(file, directory)));

test('Git scoped output candidate reproduces and changes only the file-output rule', async () => {
  const pack = read(current, 'pack.yml');
  const cases = read(current, 'cases.json');
  assert.deepEqual(pack, await gitScopedOutputPack());
  assert.deepEqual(cases, {schema_version: 1, cases: gitOutputCases()});
  assert.deepEqual(read(current, 'commands.json'), read(previous, 'commands.json'));
  const old = read(previous, 'pack.yml');
  assert.deepEqual(pack.rules.filter(rule => rule.id !== 'file-output'),
    old.rules.filter(rule => rule.id !== 'file-output'));
  const previousCases = read(previous, 'cases.json').cases;
  assert.deepEqual(cases.cases.slice(0, previousCases.length), previousCases.map(row =>
    ['inspection-log-output-loose', 'inspection-log-output-recommended'].includes(row.name)
      ? {...row, expected: 'allow'} : row));
  const validate = schemaValidator(schema);
  for (const document of [pack, cases])
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test('Git preserves the authenticated 0.11.0 release and its companion files', async () => {
  const published = new URL('../public/', import.meta.url);
  const key = readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim();
  const catalog = await checkPublication(published.pathname, key);
  const entry = catalog.releases.find(pack => pack.id === 'canonic/git' && pack.version === '0.11.0');
  assert.ok(entry, 'authenticated Git 0.11.0 release');
  assert.equal(digest(readFileSync(new URL('pack.yml', previous))), entry.sha256);
  for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE'])
    assert.deepEqual(readFileSync(new URL(name, previous)),
      readFileSync(new URL(`packs/canonic/git/0.11.0/${name}`, published)), name);
});

test('Production Shield decides Git scoped output cases in all profiles',
  {skip: !process.env.SHIELD_BINARY}, () => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
      '--pack', new URL('pack.yml', current).pathname,
      '--cases', new URL('cases.json', current).pathname],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  });
