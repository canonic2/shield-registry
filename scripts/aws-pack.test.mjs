import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {awsPack, destination} from './build-aws-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor, compatibleDirectory} from './pack-formats.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
const shell = (name, profile, source, expected, variables) => ({name, profile, ...(variables ? {variables} : {}),
  input: {kind: 'shell', source, dialect: 'posix', dialect_version: null, original_input: {}}, expected});

test('AWS pack admits a complete profile policy and command inventory', () => {
  const pack = read('pack.yml');
  assert.deepEqual(pack, awsPack());
  const validate = schemaValidator(schema);
  for (const document of [pack, read('cases.json')]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.deepEqual(read('commands.json').commands, [{name: 'aws', rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]);
  assert.equal(new Set(pack.rules.map(rule => rule.id)).size, pack.rules.length);
});


test('AWS gates, profiles and Baseline composition use production decisions', {skip: !process.env.SHIELD_BINARY}, t => {
  const pack = read('pack.yml');
  if (!shieldFor(pack)) return t.skip(`AWS ${pack.version} needs Shield ${pack.engines.shield}`);
  const owner = mkdtempSync(join(tmpdir(), 'shield-aws-cases-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const run = (cases, ...args) => {
    const path = join(owner, 'cases.json');
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
      '--cases', path, ...args], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  };
  const cases = read('cases.json').cases;
  run(cases);

  // Shell boundaries: inline environment is reviewed by Shield itself, and
  // each command of a compound request is gated separately.
  const shellCases = [];
  for (const profile of ['loose', 'recommended', 'strict']) {
    const strict = profile === 'strict';
    shellCases.push(
      shell(`shell-inspect-${profile}`, profile, 'aws ec2 describe-instances --output json', strict ? 'ask' : 'allow'),
      shell(`shell-inline-config-${profile}`, profile, 'AWS_CONFIG_FILE=/acme/config aws ec2 describe-instances', 'ask'),
      shell(`shell-inline-key-${profile}`, profile, 'AWS_ACCESS_KEY_ID=AKIAEXAMPLE aws s3 ls', 'ask'),
      shell(`shell-gated-chain-${profile}`, profile, 'aws s3 ls --profile acme-ro && aws s3 ls --profile acme-admin', 'deny', {profile: 'acme-ro'}),
      shell(`shell-gated-pass-${profile}`, profile, 'aws s3 ls --profile acme-ro; aws ec2 describe-vpcs --prof=acme-ro', strict ? 'ask' : 'allow', {profile: 'acme-ro'}),
      shell(`shell-blocked-${profile}`, profile, 'aws sts get-caller-identity --profile acme-prod', 'deny', {blocked_profiles: ['acme-prod']}),
      shell(`shell-quoted-value-${profile}`, profile, "aws logs tail /acme/web --filter-pattern 'ERROR --profile acme-admin' --profile acme-ro",
        strict ? 'ask' : 'allow', {profile: 'acme-ro'}),
    );
  }
  run(shellCases);

  // Baseline denies s3 rm/rb at the start of argv in every profile and yields
  // its generic cloud review to this pack; other decisions are unchanged.
  const baseline = compatibleDirectory(['0.10.0', '0.9.0', '0.8.1'].map(version => new URL(`../packs/canonic/baseline/${version}/`, import.meta.url)));
  assert.ok(baseline, 'A current Baseline release must admit on the selected Shield.');
  const baselineDeny = new Set(['s3-rm', 's3-rb']);
  const composed = cases.map(c => baselineDeny.has(c.name.replace(/-(loose|recommended|strict)$/, '')) ? {...c, expected: 'deny'} : c);
  for (const profile of ['loose', 'recommended', 'strict']) composed.push(
    shell(`shell-piped-${profile}`, profile, 'aws ec2 describe-instances --output json | jq .Reservations', profile === 'strict' ? 'ask' : 'allow'));
  run(composed, '--with-pack', new URL('pack.yml', baseline).pathname);
});
