import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {gitShield03Pack, previous, destination} from './build-git-shield-03.mjs';
import {shieldFor} from './pack-formats.mjs';

const compatibleShield = shieldFor(JSON.parse(readFileSync(new URL('pack.yml', destination))));

test('Git 0.6.3 preserves the previous policy and companion assets', async () => {
  const pack = JSON.parse(readFileSync(new URL('pack.yml', destination)));
  const old = JSON.parse(readFileSync(new URL('pack.yml', previous)));
  assert.deepEqual(pack, await gitShield03Pack());
  assert.deepEqual({...pack, version: old.version, engines: old.engines}, old);
  for (const name of ['cases.json', 'commands.json', 'LICENSE']) {
    assert.deepEqual(readFileSync(new URL(name, destination)), readFileSync(new URL(name, previous)));
  }
});
test('Git 0.6.3 fixtures use production decisions', {skip: !compatibleShield}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname,
    '--cases', new URL('cases.json', destination).pathname], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});
