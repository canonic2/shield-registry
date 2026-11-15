import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gitAllowByDefaultPack, gitAllowByDefaultCases, revision, changed, relaxed, networkRead, addedRules} from './build-git-allow-by-default.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const directory = version => new URL(`../packs/canonic/git/${version}/`, import.meta.url);
const read = (version, file = 'pack.yml') => JSON.parse(readFileSync(new URL(file, directory(version))));
const [previousVersion, version] = revision;

test('Git allow-by-default candidate reproduces and validates', async () => {
  const validate = schemaValidator(schema);
  const pack = await gitAllowByDefaultPack();
  const cases = {schema_version: 1, cases: await gitAllowByDefaultCases()};
  assert.deepEqual(read(version), pack);
  assert.deepEqual(read(version, 'cases.json'), cases);
  assert.deepEqual(read(version, 'commands.json'), read(previousVersion, 'commands.json'));
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.equal(new Set(cases.cases.map(row => row.name)).size, cases.cases.length);
});

test('Git allow-by-default changes only the listed defaults and keeps every review boundary', async () => {
  const pack = await gitAllowByDefaultPack();
  const previous = read(previousVersion);
  const before = new Map(previous.rules.map(rule => [rule.id, rule]));
  const added = new Set(addedRules.map(rule => rule.id));
  for (const rule of pack.rules) {
    if (added.has(rule.id)) {
      assert.equal(before.has(rule.id), false, rule.id);
      // Only network reads allow; every other added rule reviews.
      if (rule.id !== 'network-read') assert.ok(Object.values(rule.decision).every(d => d !== 'allow'), rule.id);
      continue;
    }
    const old = before.get(rule.id);
    assert.ok(old, `${rule.id} is new`);
    const {decision, conditions: {arguments: args, ...conditions}, ...rest} = rule;
    const {decision: oldDecision, conditions: {arguments: oldArgs, ...oldConditions}, ...oldRest} = old;
    assert.deepEqual(rest, oldRest, rule.id);
    assert.deepEqual(conditions, oldConditions, rule.id);
    if (args.kind === 'risk_tokens') {
      // Hardened checks keep their prefix and only widen their tokens.
      assert.deepEqual(args.prefix, oldArgs.prefix, rule.id);
      assert.ok(args.any_of.length >= oldArgs.any_of.length, rule.id);
    } else assert.deepEqual(args, oldArgs, rule.id);
    if (rule.id === 'baseline-0') assert.deepEqual(decision, {loose: 'allow', recommended: 'allow', strict: 'ask'});
    else if (relaxed.includes(rule.id)) assert.deepEqual(decision, {...oldDecision, recommended: 'allow'}, rule.id);
    else assert.deepEqual(decision, oldDecision, rule.id);
  }
  assert.equal(pack.rules.length, previous.rules.length + addedRules.length);
  // Network reads move out of the remote-access set; push and the rest stay.
  for (const name of networkRead) {
    assert.equal(pack.command_sets['baseline-1'][name], undefined, name);
    assert.ok(pack.command_sets['network-read'][name], name);
  }
  for (const name of ['push', 'send-pack', 'send-email', 'http-push', 'request-pull'])
    assert.ok(pack.command_sets['baseline-1'][name], name);
});

test('Git allow-by-default keeps earlier fixtures except the listed changes', async () => {
  const cases = await gitAllowByDefaultCases();
  const earlier = read(previousVersion, 'cases.json').cases;
  const names = new Set(earlier.map(row => row.name));
  for (const name of Object.keys(changed)) assert.ok(names.has(name), `${name} is an earlier fixture`);
  for (const [index, row] of earlier.entries()) {
    const next = cases[index];
    assert.equal(next.name, row.name);
    assert.deepEqual(next, row.name in changed ? {...row, expected: changed[row.name]} : row, row.name);
    // A changed expectation only relaxes Loose or Recommended.
    if (row.name in changed) assert.notEqual(row.profile, 'strict', row.name);
  }
});

test(`Git ${version} decisions use production Shield`, {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack',
    '--pack', new URL('pack.yml', directory(version)).pathname,
    '--cases', new URL('cases.json', directory(version)).pathname],
  {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
});
