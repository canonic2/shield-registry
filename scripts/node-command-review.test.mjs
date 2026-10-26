import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {destination, previous, commandReviewPack, commandReviewCases} from './build-node-command-review.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
test('Node command review source is reproducible and schema valid', async () => {
  assert.deepEqual(read('pack.yml'), await commandReviewPack());
  assert.deepEqual(read('cases.json'), await commandReviewCases());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  for (const command of read('commands.json').commands) {
    assert.deepEqual(command.rule_ids, read('pack.yml').rules.filter(rule => rule.conditions.executable.one_of.includes(command.name)).map(rule => rule.id));
  }
});

test('Node manifest edits and script names stay separate from credential commands', {skip: !shieldFor(read('pack.yml'))}, t => {
  const owner = mkdtempSync(join(tmpdir(), 'shield-node-command-cases-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const historical = JSON.parse(readFileSync(new URL('cases.json', previous)));
  // dist-tag set is publication review, not a credential/configuration Deny.
  historical.cases.find(c => c.name === 'npm-tag-set-recommended').expected = 'ask';
  const historicalPath = join(owner, 'historical.json');
  writeFileSync(historicalPath, JSON.stringify(historical));
  for (const cases of [new URL('cases.json', destination).pathname, historicalPath]) {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
      '--cases', cases], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
  }
});
