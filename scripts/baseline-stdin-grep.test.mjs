import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {destination, stdinGrepPack, stdinGrepCases} from './build-baseline-stdin-grep.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';
import {baselinePreviewCases} from './baseline-preview.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
const compatibleShield = shieldFor(read('pack.yml'));
test('Baseline stdin grep release is reproducible and schema valid', async () => {
  assert.deepEqual(read('pack.yml'), await stdinGrepPack());
  assert.deepEqual(read('cases.json'), await stdinGrepCases());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const pack = read('pack.yml');
  for (const command of read('commands.json').commands) {
    assert.deepEqual(command.rule_ids, pack.rules.filter(rule => rule.conditions.executable?.one_of?.some(name => name.split('/').at(-1) === command.name)).map(rule => rule.id));
  }
});

test('Baseline stdin grep keeps file searches and other fixture decisions', {skip: !compatibleShield}, t => {
  const owner = mkdtempSync(join(tmpdir(), 'shield-stdin-grep-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const path = join(owner, 'cases.json');
  writeFileSync(path, JSON.stringify({schema_version: 1, cases: baselinePreviewCases(read('cases.json').cases)}));
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', path], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
});
