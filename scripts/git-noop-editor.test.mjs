import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gitNoopEditorPack, gitNoopEditorCases, editorRevision, outputRevision, noopEditors} from './build-git-allow-by-default.mjs';
import {gitOutputCases} from './git-output-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const previous = new URL(`../packs/canonic/git/${outputRevision}/`, import.meta.url);
const current = new URL(`../packs/canonic/git/${editorRevision}/`, import.meta.url);
const read = (directory, file) => JSON.parse(readFileSync(new URL(file, directory)));

test('Git no-op editor candidate reproduces and adds only the editor forms', async () => {
  const pack = read(current, 'pack.yml');
  const cases = read(current, 'cases.json');
  assert.deepEqual(pack, await gitNoopEditorPack());
  assert.deepEqual(cases, {schema_version: 1, cases: gitNoopEditorCases()});
  assert.deepEqual(read(current, 'commands.json'), read(previous, 'commands.json'));
  const old = read(previous, 'pack.yml');
  assert.deepEqual(pack.rules, old.rules);
  assert.deepEqual(pack.invocations.git.segments, [...old.invocations.git.segments,
    [[], ...noopEditors.map(setting => ['-c', setting])]]);
  // Every leading form keeps the output destination check.
  assert.equal(pack.preconditions.length, old.invocations.git.segments[0].length * (noopEditors.length + 1));
  assert.deepEqual(pack.preconditions.slice(0, 1), old.preconditions.slice(0, 1));
  assert.deepEqual(cases.cases.slice(0, gitOutputCases().length), read(previous, 'cases.json').cases);
  const validate = schemaValidator(schema);
  for (const document of [pack, cases])
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
});

test('Production Shield decides Git no-op editor cases in all profiles',
  {skip: !process.env.SHIELD_BINARY}, () => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
      '--pack', new URL('pack.yml', current).pathname,
      '--cases', new URL('cases.json', current).pathname],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  });
