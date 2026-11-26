import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {dockerPack} from './docker-policy.mjs';
import {dockerCases} from './docker-cases.mjs';
import {directory, guide} from './build-docker-pack.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('Docker sources reproduce with schema-valid policy and fixtures', async () => {
  const pack = dockerPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(dockerCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory));
    assert.ok(bytes.length <= 1_048_576, `${file}: artifact limit`);
    assert.deepEqual(JSON.parse(bytes), document);
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  const ids = pack.rules.map(rule => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  const inventory = JSON.parse(readFileSync(new URL('commands.json', directory)));
  assert.deepEqual(inventory.commands.map(row => row.name), ['docker', 'docker-compose']);
  assert.deepEqual(inventory.commands.flatMap(row => row.rule_ids).sort(), [...ids].sort());
});

test('Docker risk scans never allow', () => {
  for (const rule of dockerPack().rules.filter(rule => rule.conditions.arguments.kind === 'risk_tokens'))
    assert.ok(Object.values(rule.decision).every(decision => decision !== 'allow'), rule.id);
});

// Source-only CI has no Shield binary. The release builder independently
// requires production admission and every fixture before it can sign.
test('production Shield reproduces every independent Docker decision', {skip: !process.env.SHIELD_BINARY}, async t => {
  assert.ok(process.env.SHIELD_BINARY, 'Pass --shield PATH; the new pack must not skip evaluator validation');
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const path = new URL(file, directory).pathname;
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack','--pack',new URL('pack.yml',directory).pathname,'--cases',path],
      {encoding:'utf8', timeout:120000, maxBuffer:32*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(readFileSync(path)).cases.length);
    total += report.cases.length;
  }
  assert.equal(total, dockerCases().cases.length);
  t.diagnostic(`Evaluated all ${total} independent docker cases.`);
});

test('Trusted Docker contexts preserve explicit container decisions', {skip: !process.env.SHIELD_BINARY}, async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'shield-docker-cases-'));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  const restrictions = join(temporary, 'restrictions.json');
  const cases = join(temporary, 'cases.json');
  const pack = new URL('pack.yml', directory).pathname;
  const missingCapability = join(temporary, 'missing-capability.json');
  const draft = JSON.parse(readFileSync(pack));
  draft.capabilities = draft.capabilities.filter(value => value !== 'docker-context-exec-trust-v1');
  await writeFile(missingCapability, JSON.stringify(draft));
  const invalid = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'validate', '--pack', missingCapability],
    {encoding: 'utf8', timeout: 120000});
  assert.equal(invalid.status, 2, invalid.stderr + invalid.stdout);
  assert.match(JSON.parse(invalid.stdout).error.message, /capabilities must declare exactly the features used/);
  await writeFile(restrictions, JSON.stringify({
    schema_version: 1, kind: 'pack', id: 'acme/container', version: '1.0.0',
    description: 'Explicit container decisions fixture', license: 'MIT', maintainers: ['Acme'],
    engines: {shield: '*'}, capabilities: ['structured-rules-v1', 'argument-rules-v1', 'fallback-rules-v1'],
    rules: [
      {id: 'blocked', decision: 'deny', conditions: {domain: 'argv', executable: 'acme-blocked'}},
      {id: 'review', decision: 'ask', conditions: {domain: 'argv', executable: 'acme-review'}},
      {id: 'fallback', decision: 'ask', fallback: true, conditions: {domain: 'argv', executable: 'acme-unknown'}},
    ].map(rule => ({...rule, conditions: {...rule.conditions, arguments: {kind: 'any'}}})),
  }));
  await writeFile(cases, JSON.stringify({
    schema_version: 1,
    cases: [
      ['direct-deny', 'acme-blocked', 'deny'],
      ['direct-ask', 'acme-review', 'ask'],
      ['direct-fallback', 'acme-unknown', 'allow'],
      ['direct-unmatched', 'acme-unlisted', 'allow'],
      ['strict-fallback', 'acme-unknown', 'ask', 'strict'],
      ['script-deny', `sh -c 'acme-unknown; acme-blocked'`, 'deny'],
      ['script-ask', `sh -c 'acme-unknown; acme-review'`, 'ask'],
      ['script-fallback', `sh -c 'acme-unknown; acme-unlisted'`, 'allow'],
      ['env-deny', 'env ACME_TEST=1 acme-blocked', 'deny'],
      ['sudo-ask', 'sudo -n -u acme acme-review', 'ask'],
      ['launcher-chain-deny', `env sudo -n sh -c 'acme-blocked'`, 'deny'],
      ['launcher-fallback', 'env sudo -n acme-unknown', 'allow'],
    ].map(([name, command, expected, profile = 'recommended']) => ({
      name, profile, expected,
      variables: {docker_contexts: ['desktop-linux'], docker_trusted_exec_contexts: ['desktop-linux']},
      input: {kind: 'shell', dialect: 'bash', dialect_version: null, source: `docker --context desktop-linux exec acme-db ${command}`, original_input: {}},
    })),
  }));
  const result = spawnSync(process.env.SHIELD_BINARY, [
    '__internal', 'test-pack', '--details', '--pack', pack,
    '--with-pack', restrictions, '--cases', cases,
  ], {encoding: 'utf8', timeout: 120000});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.cases.length, 12);
  const usesTrust = name => report.cases.find(row => row.name === name).evaluation.analysis_coverage.operations
    .some(operation => operation.evaluation_model === 'trusted-docker-exec');
  assert.equal(usesTrust('direct-fallback'), true);
  assert.equal(usesTrust('strict-fallback'), false);
});
