import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gitInspectionPack, gitInspectionCases, inspection, revision} from './build-git-inspection.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const directory = version => new URL(`../packs/canonic/git/${version}/`, import.meta.url);
const read = (version, file = 'pack.yml') => JSON.parse(readFileSync(new URL(file, directory(version))));
const names = args => [...args.flags, ...args.values, ...(args.optional_values ?? [])]
  .map(entry => typeof entry === 'string' ? entry : entry.name);

test('Git inspection candidate reproduces and only widens allowed inspection grammars', async () => {
  const validate = schemaValidator(schema);
  const pack = await gitInspectionPack();
  const cases = {schema_version: 1, cases: gitInspectionCases()};
  assert.deepEqual(read(revision[1]), pack);
  assert.deepEqual(read(revision[1], 'cases.json'), cases);
  assert.deepEqual(read(revision[1], 'commands.json'), read(revision[0], 'commands.json'));
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.equal(new Set(cases.cases.map(row => row.name)).size, cases.cases.length);
  const previous = read(revision[0]);
  assert.deepEqual(pack.rules.map(rule => rule.id), previous.rules.map(rule => rule.id));
  for (const [index, old] of previous.rules.entries()) {
    const next = pack.rules[index];
    const {conditions: {arguments: before, ...oldConditions}, ...oldRule} = old;
    const {conditions: {arguments: after, ...nextConditions}, ...nextRule} = next;
    assert.deepEqual(nextRule, oldRule, old.id);
    assert.deepEqual(nextConditions, oldConditions, old.id);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    // Only allowed inspection grammars change, and each keeps every option it had.
    assert.ok(inspection(old), `${old.id} changed`);
    for (const name of names(before)) assert.ok(names(after).includes(name), `${old.id} keeps ${name}`);
    for (const field of ['prefix', 'operands', 'require_any', 'forbid'])
      assert.deepEqual(after[field], before[field], `${old.id} ${field}`);
    for (const unsafe of ['--output', '--ext-diff', '--textconv', '--no-index', '-O', '--open-files-in-pager', '--exec'])
      assert.ok(!names(after).includes(unsafe) || names(before).includes(unsafe), `${old.id} must not add ${unsafe}`);
  }
});

test('Git inspection options and neighboring boundaries use production decisions', {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
    '--pack', new URL('pack.yml', directory(revision[1])).pathname,
    '--cases', new URL('cases.json', directory(revision[1])).pathname],
  {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
});
