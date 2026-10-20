import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {hiddenListingsPack, hiddenListingCases, destination} from './build-baseline-hidden-listings.mjs';
import { validatorFor, shieldFor } from './pack-formats.mjs';

test('Hidden listings preserve the 84 shared bodies and every previous fixture', async () => {
  const pack = JSON.parse(readFileSync(new URL('pack.yml', destination)));
  assert.deepEqual(pack, await hiddenListingsPack());
  assert.equal(pack.rules.length, 84);
  const old = JSON.parse(readFileSync(new URL('../packs/canonic/baseline/0.3.0/pack.yml', import.meta.url)));
  const restored = structuredClone(pack);
  restored.version = old.version;
  restored.engine = old.engine;
  const rule = restored.rules.find(r => r.id === 'read-rg');
  rule.requirements.arguments.flags = rule.requirements.arguments.flags.filter(f => f !== '--hidden');
  rule.on_unmet = old.rules.find(r => r.id === 'read-rg').on_unmet;
  assert.deepEqual(restored, old);
  const cases = JSON.parse(readFileSync(new URL('cases.json', destination)));
  assert.deepEqual(cases, await hiddenListingCases());
  const previous = JSON.parse(readFileSync(new URL('../packs/canonic/baseline/0.3.0/cases.json', import.meta.url)));
  assert.deepEqual(cases.cases.slice(0, previous.cases.length), previous.cases);
  assert.equal(cases.cases.length, 570);
});

test('Production evaluator accepts hidden listings and retains content and path restrictions', {skip:!shieldFor(JSON.parse(readFileSync(new URL('pack.yml', destination))))}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack','--pack',new URL('pack.yml',destination).pathname,
    '--cases',new URL('cases.json',destination).pathname], {encoding:'utf8',timeout:120000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});

test('Both native adapters permit hidden filenames and refuse protected contents and outside paths',
  {skip:!shieldFor(JSON.parse(readFileSync(new URL('pack.yml', destination)))) || process.platform === 'win32',timeout:180000}, () => {
    const result = spawnSync('python3',[new URL('hidden-listings-native.py',import.meta.url).pathname,process.env.SHIELD_BINARY,
      new URL('pack.yml',destination).pathname], {encoding:'utf8',timeout:170000,maxBuffer:2*1024*1024});
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, 84);
  });
