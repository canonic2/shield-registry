import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitShield02Pack, previous, destination } from './build-git-shield-02.mjs';
import { shieldFor } from './pack-formats.mjs';
import { updateExpected } from './usable-cases.mjs';
const read = (name, root = destination) => readFileSync(new URL(name, root));
const compatibleShield = shieldFor(JSON.parse(read('pack.yml')));
test('Git 0.6.2 changes only release identity and engine compatibility', async () => {
  const pack = JSON.parse(read('pack.yml'));
  const old = JSON.parse(read('pack.yml', previous));
  assert.deepEqual(pack, await gitShield02Pack());
  assert.deepEqual({...pack, version: old.version, engines: old.engines}, old);
  for (const name of ['cases.json', 'commands.json', 'LICENSE']) assert.deepEqual(read(name), read(name, previous));
});
test('Compatible Shield admits Git 0.6.2 and rejects its incompatible predecessor', {skip: !compatibleShield}, () => {
  assert.equal(shieldFor(JSON.parse(read('pack.yml'))), process.env.SHIELD_BINARY);
  assert.equal(shieldFor(JSON.parse(read('pack.yml', previous))), undefined);
  const invalid = JSON.parse(read('pack.yml'));
  invalid.rules[0].conditions.executable = {regex: '('};
  invalid.capabilities.push('regex-v1');
  assert.throws(() => shieldFor(invalid), /Shield admission failed/);
});
test('Production evaluator decides every Git 0.6.2 fixture', {skip: !compatibleShield}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
  assert.equal(result.status, 0, result.stderr + result.stdout.slice(0, 2000));
  assert.equal(JSON.parse(result.stdout).passed, true);
});
test('Git 0.6.2 retains all 1023 historical decisions with the seven reviewed usability changes',
  {skip: !compatibleShield}, async t => {
    const cases = JSON.parse(readFileSync(new URL('../packs/canonic/git/0.5.0/cases.json', import.meta.url)));
    assert.equal(updateExpected('git', cases.cases), 7);
    const root = await mkdtemp(join(tmpdir(), 'shield-git-regression-'));
    t.after(() => rm(root, {recursive: true, force: true}));
    const path = join(root, 'cases.json');
    await writeFile(path, JSON.stringify(cases));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
      '--cases', path], {encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024});
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 1023);
  });
