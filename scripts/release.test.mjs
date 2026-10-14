import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planRelease } from './release.mjs';

test('A release adds its pack once and follows the signed catalog sequence', () => {
  const release = { sequence: 3, expires_at: '2099-01-01T00:00:00Z', packs: ['packs/canonic/acme/0.1.0/pack.yml'] };
  const added = planRelease(release, 6, 'packs/canonic/acme/0.2.0/pack.yml');
  assert.deepEqual(added.packs, ['packs/canonic/acme/0.1.0/pack.yml', 'packs/canonic/acme/0.2.0/pack.yml']);
  assert.equal(added.sequence, 7);
  // Rerunning after a failed attempt changes nothing further.
  assert.deepEqual(planRelease(added, 6, 'packs/canonic/acme/0.2.0/pack.yml'), added);
});
