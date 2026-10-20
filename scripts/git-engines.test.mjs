import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gitEnginesPack, previous, destination} from './build-git-engines.mjs';
import {currentFormat, validatorFor} from './pack-formats.mjs';

const read = (name, root) => readFileSync(new URL(name, root));

test('Git 0.6.1 changes only its version and Shield range from 0.6.0', async () => {
  const pack = JSON.parse(read('pack.yml', destination));
  assert.deepEqual(pack, await gitEnginesPack());
  assert.deepEqual(pack.engines, {shield: '>=0.1.13, <0.2.0'});
  assert.equal(validatorFor(pack)(pack), true);
  const old = currentFormat(JSON.parse(read('pack.yml', previous)));
  assert.deepEqual({...pack, version: old.version, engines: old.engines}, old);
  for (const name of ['cases.json', 'commands.json', 'LICENSE']) assert.deepEqual(read(name, destination), read(name, previous), name);
});

test('Production evaluator decides every Git fixture', {skip: !process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000});
  assert.equal(result.status, 0, result.stdout.slice(0, 2000) + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});
