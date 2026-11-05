import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {reviewedPacks, revisions} from './build-reviewed-profiles.mjs';
import {reviewedCases} from './build-reviewed-profile-cases.mjs';
import {toolPack} from './tool-pack.mjs';
import {gate} from './gate-policy.mjs';
import {box} from './box-policy.mjs';
import {testrun} from './testrun-policy.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const directory = (name, version) => new URL(`../packs/canonic/${name}/${version}/`, import.meta.url);
const read = (name, version, file = 'pack.yml') => JSON.parse(readFileSync(new URL(file, directory(name, version))));

test('reviewed profile candidates reproduce, preserve boundaries and leave published generators unchanged', async () => {
  const validate = schemaValidator(schema);
  for (const pack of await reviewedPacks()) {
    const name = pack.id.split('/')[1];
    const previous = read(name, revisions[name][0]);
    assert.ok(readFileSync(new URL('pack.yml', directory(name, pack.version))).byteLength <= 1_048_576,
      `${name}: published policy must fit the registry artifact limit`);
    assert.deepEqual(read(name, pack.version), pack, name);
    const cases = {schema_version: 1, cases: reviewedCases(name)};
    assert.deepEqual(read(name, pack.version, 'cases.json'), cases, name);
    for (const document of [pack, cases]) assert.equal(validate(document), true, `${name}: ${JSON.stringify(validate.errors)}`);
    assert.deepEqual(pack.preconditions, previous.preconditions, `${name}: configured boundaries`);
    for (const old of previous.rules) {
      const next = pack.rules.find(rule => rule.id === old.id);
      assert.ok(next, `${name}: keeps ${old.id}`);
      assert.deepEqual(next.requirements, old.requirements, `${name}: ${old.id} requirements`);
      assert.deepEqual(next.on_unmet, old.on_unmet, `${name}: ${old.id} failure boundary`);
    }
  }
  for (const tool of [gate, box, testrun]) assert.deepEqual(toolPack(tool), read(tool.name, '0.1.0'));
});

for (const [name, [, version]] of Object.entries(revisions)) {
  test(`${name} legitimate operations and neighboring boundaries use production decisions`, {skip: !process.env.SHIELD_BINARY}, () => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
      '--pack', new URL('pack.yml', directory(name, version)).pathname,
      '--cases', new URL('cases.json', directory(name, version)).pathname],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  });
}
