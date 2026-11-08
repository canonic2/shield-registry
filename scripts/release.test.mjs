import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRelease } from './release.mjs';

test('A release adds its pack once and follows the signed catalog sequence', () => {
  const release = { sequence: 3, expires_at: '2099-01-01T00:00:00Z', packs: ['packs/canonic/acme/0.1.0/pack.yml'] };
  const added = planRelease(release, 6, 'packs/canonic/acme/0.2.0/pack.yml');
  assert.deepEqual(added.packs, ['packs/canonic/acme/0.1.0/pack.yml', 'packs/canonic/acme/0.2.0/pack.yml']);
  assert.equal(added.sequence, 7);
  assert.equal(added.catalog_version, 2);
  // Rerunning after a failed attempt changes nothing further.
  assert.deepEqual(planRelease(added, 6, 'packs/canonic/acme/0.2.0/pack.yml'), added);
});

test('A full catalog upgrades to indexed history without dropping releases', () => {
  const packs = Array.from({length:64}, (_, i) => `packs/canonic/acme/1.0.${i}/pack.yml`);
  const release = {sequence:1, catalog_version:3, packs};
  assert.deepEqual(planRelease(release, 1, packs[0]).packs, packs);
  const next=planRelease(release, 1, 'packs/canonic/acme/1.0.64/pack.yml');
  assert.equal(next.catalog_version,3);
  assert.equal(next.packs.length,65);
  assert.deepEqual(next.packs.slice(0,64),packs);
  assert.equal(release.packs.length, 64);
});

test('Duplicate manifest paths fail before release preparation', () => {
  const path = 'packs/canonic/acme/1.0.0/pack.yml';
  assert.throws(() => planRelease({packs:[path,path]}, 1, path), /duplicate pack paths/);
});
