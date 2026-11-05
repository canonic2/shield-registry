import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configurableGithubPack, destination} from './build-github-configurable-pack.mjs';
import {configurableGithubCases} from './build-github-configurable-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {compatibleDirectory} from './pack-formats.mjs';

test('configurable GitHub artifacts reproduce without changing the immutable release', () => {
  const pack = configurableGithubPack();
  assert.deepEqual(JSON.parse(readFileSync(new URL('pack.yml', destination))), pack);
  assert.deepEqual(JSON.parse(readFileSync(new URL('cases.json', destination))), {schema_version: 1, cases: configurableGithubCases()});
  const validate = schemaValidator(schema);
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
  assert.equal(pack.variables.repository.required, undefined);
  assert.equal(pack.variables.repository.default, undefined);
  assert.ok(pack.preconditions.every(gate => gate.when[0].var === 'repository' && gate.when[0].set === true));
});

test('optional GitHub repository binding enforces CLI and MCP boundaries on the production engine', {skip: !process.env.SHIELD_BINARY}, t => {
  const directory = mkdtempSync(join(tmpdir(), 'shield-github-configured-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const pack = join(directory, 'pack.json');
  const cases = join(directory, 'cases.json');
  writeFileSync(pack, JSON.stringify(configurableGithubPack()));
  const run = (rows, companions = []) => {
    for (let index = 0; index < rows.length; index += 512) {
      writeFileSync(cases, JSON.stringify({schema_version: 1, cases: rows.slice(index, index + 512)}));
      const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', pack, '--cases', cases,
        ...companions.flatMap(path => ['--with-pack', path])],
      {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
      const report = JSON.parse(result.stdout || '{}');
      assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
    }
  };
  run(configurableGithubCases({complete: true}));
  const baseline = compatibleDirectory(['0.10.0', '0.9.0', '0.8.1'].map(version => new URL(`../packs/canonic/baseline/${version}/`, import.meta.url)));
  assert.ok(baseline);
  // Baseline's credential denial remains stronger than GitHub's Loose Ask.
  run(configurableGithubCases().map(row => row.name === 'unset-hosted-token-loose' ? {...row, expected: 'deny'} : row),
    [new URL('pack.yml', baseline).pathname]);
  for (const repository of ['acme/*', 'https://github.com/acme/web', 'acme/..', 'acme/web/extra', '', 'acme/web\n']) {
    writeFileSync(cases, JSON.stringify({schema_version: 1, cases: [{name: 'invalid-binding', profile: 'recommended',
      variables: {repository}, argv: ['gh', 'repo', 'view', '-R', 'acme/web'], expected: 'allow'}]}));
    const invalid = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', pack, '--cases', cases], {encoding: 'utf8', timeout: 10000});
    assert.notEqual(invalid.status, 0, `invalid repository admitted: ${JSON.stringify(repository)}`);
  }
});
