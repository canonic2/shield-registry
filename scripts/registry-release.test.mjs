import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkCatalog, checkPrevious, checkPublication, digest } from './registry-release.mjs';

const pair = generateKeyPairSync('ed25519');
const key = Buffer.from(pair.publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');
const entry = { id: 'canonic/git', version: '0.1.0', path: 'packs/canonic/git/0.1.0/pack.yml', sha256: 'a'.repeat(64) };
const catalog = { schema_version: 1, registry_id: 'canonic-shield-main', sequence: 1,
  expires_at: '2099-01-01T00:00:00Z', packs: [entry] };
const signed = value => {
  const bytes = Buffer.from(JSON.stringify(value));
  return [bytes, sign(null, bytes, pair.privateKey).toString('hex'), key];
};
test('Accept a signed catalog and reject tampering or a foreign signing key', () => {
  const [bytes, signature] = signed(catalog);
  assert.deepEqual(checkCatalog(bytes, signature, key), catalog);
  assert.throws(() => checkCatalog(Buffer.concat([bytes, Buffer.from(' ')]), signature, key));
  const foreign = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
  assert.throws(() => checkCatalog(bytes, signature, Buffer.from(foreign.x, 'base64url').toString('hex')));
});
test('Reject expired metadata, unsafe paths and duplicate releases', () => {
  for (const value of [
    { ...catalog, expires_at: '2000-01-01T00:00:00Z' },
    { ...catalog, packs: [{ ...entry, path: '../pack.yml' }] },
    { ...catalog, packs: [entry, entry] },
    { ...catalog, registry_id: 'foreign' },
  ]) assert.throws(() => checkCatalog(...signed(value)));
});
test('Retain immutable releases and require monotonic catalog publication', () => {
  assert.doesNotThrow(() => checkPrevious(catalog, { ...catalog, sequence: 2 }));
  assert.throws(() => checkPrevious(catalog, catalog));
  assert.throws(() => checkPrevious(catalog, { ...catalog, sequence: 2, packs: [] }));
  assert.throws(() => checkPrevious(catalog, { ...catalog, sequence: 2, packs: [{ ...entry, sha256: 'b'.repeat(64) }] }));
});
test('Verify actual publication files and reject changed artifact bytes and links', async t => {
  const root = await mkdtemp(join(tmpdir(), 'shield-registry-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from(JSON.stringify({ id: entry.id, version: entry.version }));
  const complete = { ...catalog, packs: [{ ...entry, sha256: digest(bytes) }] };
  const [metadata, signature] = signed(complete);
  await mkdir(join(root, dirname(entry.path)), { recursive: true });
  await writeFile(join(root, entry.path), bytes);
  await writeFile(join(root, 'catalog.json'), metadata);
  await writeFile(join(root, 'catalog.sig'), signature);
  await writeFile(join(root, 'catalog-key.pub'), key);
  assert.deepEqual(await checkPublication(root), complete);
  await assert.rejects(checkPublication(root, '0'.repeat(64)), /reviewed root/);
  await writeFile(join(root, entry.path), Buffer.concat([bytes, Buffer.from(' ')]));
  await assert.rejects(checkPublication(root), /digest mismatch/);
  await rm(join(root, entry.path));
  const outside = join(root, 'outside.json');
  await writeFile(outside, bytes);
  await symlink(outside, join(root, entry.path));
  await assert.rejects(checkPublication(root), /Linked publication path/);
});
