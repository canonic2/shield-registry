import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {destination, usableGithubPack} from './build-github-usable-pack.mjs';
import {usableGithubCases} from './build-github-usable-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
test('GitHub usable profile artifacts reproduce and satisfy the authoring schema', () => {
  assert.deepEqual(read('pack.yml'), usableGithubPack());
  assert.deepEqual(read('cases.json'), {schema_version: 1, cases: usableGithubCases()});
  const validate = schemaValidator(schema);
  for (const document of [read('pack.yml'), read('cases.json')])
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.deepEqual(read('commands.json').commands, [{name: 'gh',
    rule_ids: usableGithubPack().rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]);
});

test('GitHub usable profiles preserve approval, deletion, credential and target boundaries',
  {skip: !process.env.SHIELD_BINARY}, () => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
      '--pack', new URL('pack.yml', destination).pathname,
      '--cases', new URL('cases.json', destination).pathname],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0,
      JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  });
