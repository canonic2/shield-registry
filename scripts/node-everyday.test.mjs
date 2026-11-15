import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {nodeEverydayPack, nodeEverydayCases, nodeEverydayCommands, baselineScriptFallbackPack, baselineFallbackIds,
  nodeRevision, baselineRevision, changed} from './build-node-everyday.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const directory = (name, version) => new URL(`../packs/canonic/${name}/${version}/`, import.meta.url);
const read = (name, version, file = 'pack.yml') => JSON.parse(readFileSync(new URL(file, directory(name, version))));
const path = (name, version, file = 'pack.yml') => new URL(file, directory(name, version)).pathname;
const changedRules = new Set(['node-test', 'node-project-script', 'manager-inspection', 'manager-unlisted']);
const addedRules = new Set(['yarn-workspaces-list', 'manager-script-shorthand', 'yarn-workspace-script-shorthand']);

test('Node and Baseline candidates reproduce and validate', async () => {
  const validate = schemaValidator(schema);
  const node = await nodeEverydayPack();
  const baseline = await baselineScriptFallbackPack();
  const cases = {schema_version: 1, cases: await nodeEverydayCases()};
  assert.deepEqual(read('node', nodeRevision[1]), node);
  assert.deepEqual(read('node', nodeRevision[1], 'cases.json'), cases);
  assert.deepEqual(read('node', nodeRevision[1], 'commands.json'), await nodeEverydayCommands());
  assert.deepEqual(read('baseline', baselineRevision[1]), baseline);
  assert.deepEqual(read('baseline', baselineRevision[1], 'cases.json'), read('baseline', baselineRevision[0], 'cases.json'));
  for (const document of [node, baseline, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.equal(new Set(cases.cases.map(row => row.name)).size, cases.cases.length);
});

test('Node changes only scripts, project files, listings and the unlisted guidance', async () => {
  const pack = await nodeEverydayPack();
  const before = new Map(read('node', nodeRevision[0]).rules.map(rule => [rule.id, rule]));
  for (const rule of pack.rules) {
    if (addedRules.has(rule.id)) {
      assert.equal(before.has(rule.id), false, rule.id);
      continue;
    }
    const old = before.get(rule.id);
    assert.ok(old, `${rule.id} is new`);
    if (/-scripts$/.test(rule.id)) {
      assert.deepEqual(rule.decision, {loose: 'allow', recommended: 'allow', strict: 'ask'}, rule.id);
      // Corepack routes keep their words as a sequence; other script rules are unchanged.
      const expected = rule.id.startsWith('corepack-') ? {...old.conditions,
        arguments: {kind: 'sequence', prefix: old.conditions.arguments.values, rest: {kind: 'any'}}} : old.conditions;
      assert.deepEqual(rule.conditions, expected, rule.id);
    } else if (!changedRules.has(rule.id)) assert.deepEqual(rule, old, rule.id);
  }
  assert.equal(pack.rules.length, before.size + addedRules.size);
  // Added rules never allow in Strict; listings keep their Allow-everywhere row.
  for (const rule of pack.rules.filter(rule => addedRules.has(rule.id) && rule.id !== 'yarn-workspaces-list'))
    assert.equal(rule.decision.strict, 'ask', rule.id);
});

test('Baseline only turns its package-script reviews into fallbacks', async () => {
  const pack = await baselineScriptFallbackPack();
  const previous = read('baseline', baselineRevision[0]);
  const ids = new Set(await baselineFallbackIds());
  assert.ok(ids.has('scripts-pnpm-yarn') && ids.has('scripts-npm'));
  assert.equal(pack.rules.length, previous.rules.length);
  for (const [index, rule] of pack.rules.entries()) {
    const old = previous.rules[index];
    assert.deepEqual(rule, ids.has(rule.id) ? {...old, fallback: true} : old, rule.id);
    if (ids.has(rule.id)) assert.deepEqual(rule.decision, {loose: 'ask', recommended: 'ask', strict: 'ask'}, rule.id);
  }
});

test('Node keeps earlier fixtures except the listed changes', async () => {
  const cases = await nodeEverydayCases();
  const earlier = read('node', nodeRevision[0], 'cases.json').cases;
  for (const name of Object.keys(changed)) assert.ok(earlier.some(row => row.name === name), name);
  for (const [index, row] of earlier.entries()) {
    assert.deepEqual(cases[index], row.name in changed ? {...row, expected: changed[row.name]} : row, row.name);
    if (row.name in changed) assert.notEqual(row.profile, 'strict', row.name);
  }
});

const run = (pack, cases, extra = []) => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', pack, '--cases', cases, '--json', ...extra],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  return {result, report: JSON.parse(result.stdout || '{}')};
};
const failures = report => JSON.stringify(report.cases?.filter(row => !row.passed) ?? report);

test(`Node ${nodeRevision[1]} decisions use production Shield, alone and with Baseline ${baselineRevision[1]}`, {skip: !process.env.SHIELD_BINARY}, () => {
  for (const extra of [[], ['--with-pack', path('baseline', baselineRevision[1])]]) {
    const {result, report} = run(path('node', nodeRevision[1]), path('node', nodeRevision[1], 'cases.json'), extra);
    assert.equal(result.status, 0, failures(report) + result.stderr);
  }
});

test(`Baseline ${baselineRevision[1]} keeps its decisions without a package-manager pack`, {skip: !process.env.SHIELD_BINARY}, () => {
  const {result, report} = run(path('baseline', baselineRevision[1]), path('baseline', baselineRevision[1], 'cases.json'));
  assert.equal(result.status, 0, failures(report) + result.stderr);
});

// Ask outranks Allow across packs, so 0.12.0's regular script reviews would
// keep project scripts asking next to this Node release.
test(`Baseline ${baselineRevision[0]} still asks for scripts beside Node ${nodeRevision[1]}`, {skip: !process.env.SHIELD_BINARY}, () => {
  const {report} = run(path('node', nodeRevision[1]), path('node', nodeRevision[1], 'cases.json'), ['--with-pack', path('baseline', baselineRevision[0])]);
  const rows = new Map(report.cases.map(row => [row.name, row.actual]));
  for (const name of ['script-recommended', 'everyday-yarn-script-recommended', 'everyday-pnpm-script-recommended'])
    assert.equal(rows.get(name), 'ask', name);
});
