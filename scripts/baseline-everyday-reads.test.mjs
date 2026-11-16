import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {previous, destination, changedRules, addedRules, pathCheckedRules, everydayReadsPack, everydayReadsCases, everydayReadsCommands} from './build-baseline-everyday-reads.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';
import {baselinePreviewCasesPath} from './baseline-preview.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));
const compatibleShield = shieldFor(read('pack.yml'));

test('Baseline everyday reads release is reproducible, schema valid and keeps earlier rules', async () => {
  assert.deepEqual(read('pack.yml'), await everydayReadsPack());
  assert.deepEqual(read('cases.json'), await everydayReadsCases());
  assert.deepEqual(read('commands.json'), await everydayReadsCommands());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const pack = read('pack.yml');
  const earlier = read('pack.yml', previous);
  const added = new Set(Object.values(addedRules).flat());
  const changed = new Set([...changedRules, ...added]);
  assert.deepEqual(pack.rules.filter(rule => !changed.has(rule.id)), earlier.rules.filter(rule => !changed.has(rule.id)));
  // Every added rule is a read-only allowance without a requirement to bypass;
  // path-checked ones apply only where the earlier jq path check holds.
  for (const rule of pack.rules.filter(rule => added.has(rule.id))) {
    assert.deepEqual(Object.values(rule.decision), ['allow', 'allow', 'allow'], rule.id);
    assert.equal(rule.requirements, undefined, rule.id);
    if (pathCheckedRules.includes(rule.id))
      assert.deepEqual(rule.conditions.targets, earlier.rules.find(item => item.id === 'read-jq').requirements.targets, rule.id);
  }
  // Ripgrep keeps its path check and refusal; only the option list is gone.
  const rg = pack.rules.find(rule => rule.id === 'read-rg');
  const before = earlier.rules.find(rule => rule.id === 'read-rg');
  assert.deepEqual(rg.requirements.targets, before.requirements.targets);
  assert.deepEqual(rg.on_unmet.decision, before.on_unmet.decision);
  assert.deepEqual(read('cases.json').cases.slice(0, read('cases.json', previous).cases.length), read('cases.json', previous).cases);
});

test('Baseline everyday reads decides its independent fixtures through production Shield', {skip: !compatibleShield}, t => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', baselinePreviewCasesPath(t, new URL('cases.json', destination))], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
