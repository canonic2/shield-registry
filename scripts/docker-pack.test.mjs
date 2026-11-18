import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
