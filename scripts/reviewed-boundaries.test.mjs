import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {reviewedCases} from './build-reviewed-profile-cases.mjs';
import {reviewedPacks} from './build-reviewed-profiles.mjs';
import {usableGithubCases} from './build-github-usable-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const pack = (name, version, file = 'pack.yml') => new URL(`../packs/canonic/${name}/${version}/${file}`, import.meta.url).pathname;
function evaluate(t, path, cases, companion) {
  const directory = mkdtempSync(join(tmpdir(), 'shield-reviewed-boundary-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const file = join(directory, 'cases.json');
  writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', path, '--cases', file,
    ...(companion ? ['--with-pack', companion] : [])],
  {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
}

test('Final boundary candidates reproduce and validate against the schema', async () => {
  const validate = schemaValidator(schema);
  for (const [name, version] of [['baseline', '0.11.0'], ['git', '0.8.0'], ['aws', '0.2.0']]) {
    const actual = JSON.parse(readFileSync(pack(name, version)));
    assert.deepEqual(actual, (await reviewedPacks()).find(pack => pack.id === `canonic/${name}`));
    const cases = JSON.parse(readFileSync(pack(name, version, 'cases.json')));
    assert.deepEqual(cases, {schema_version: 1, cases: reviewedCases(name)});
    for (const document of [actual, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
});
test('Baseline keeps disk inspection usable while protecting absolute disk erasure', {skip: !process.env.SHIELD_BINARY}, t => {
  evaluate(t, pack('baseline', '0.11.0'), reviewedCases('baseline'));
});
test('GitHub merges and credential/repository boundaries compose with Baseline', {skip: !process.env.SHIELD_BINARY}, t => {
  const labels = ['unscoped-merge', 'scoped-merge', 'unscoped-merge-delete', 'scoped-merge-delete',
    'unscoped-auth-token', 'scoped-outside-merge', 'unscoped-mcp-hosted-merge', 'scoped-mcp-local-merge'];
  const cases = usableGithubCases().filter(row => labels.includes(row.name.replace(/-(?:loose|recommended|strict)$/, '')));
  assert.equal(cases.length, labels.length * 3);
  evaluate(t, pack('github', '0.3.0'), cases, pack('baseline', '0.11.0'));
});
test('Git plumbing remains reviewable while destructive flags are refused in Strict', {skip: !process.env.SHIELD_BINARY}, t => {
  evaluate(t, pack('git', '0.8.0'), reviewedCases('git'));
});
test('KMS access grants and key destruction retain different decisions with Baseline', {skip: !process.env.SHIELD_BINARY}, t => {
  evaluate(t, pack('aws', '0.2.0'), reviewedCases('aws').filter(row => /^key-/.test(row.name)), pack('baseline', '0.11.0'));
});
