import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { build, checkCatalog, checkPrevious, checkPublication, digest } from './registry-release.mjs';
import { currentFormat } from './pack-formats.mjs';

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

async function releaseFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'shield-registry-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path, bytes) => { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes); };
  for (const path of ['schemas/policy.schema.json', 'schemas/policy-legacy.schema.json', 'schemas/policy-shield-0.1.12.schema.json', 'LICENSE']) {
    await put(path, await readFile(new URL(`../${path}`, import.meta.url)));
  }
  for (const version of ['0.2.0', '0.3.0']) for (const name of ['pack.yml', 'cases.json', 'README.md', 'LICENSE', 'commands.json']) {
    const path = `packs/canonic/git/${version}/${name}`;
    // Git 0.3.0 stands in for a new release, so it uses the current format.
    const bytes = version === '0.3.0' && name === 'pack.yml'
      ? Buffer.from(JSON.stringify(currentFormat(JSON.parse(await readFile(new URL(`../${path}`, import.meta.url))))))
      : await readFile(new URL(`../${path}`, import.meta.url));
    await put(path, bytes);
    if (version === '0.2.0') await put(`public/${path}`, bytes);
  }
  const path = 'packs/canonic/git/0.2.0/pack.yml';
  const old = { ...catalog, sequence: 1, expires_at: '2000-01-01T00:00:00Z',
    packs: [{ id: 'canonic/git', version: '0.2.0', path, sha256: digest(await readFile(join(root, path))) }] };
  const [bytes, signature] = signed(old);
  await put('public/catalog.json', bytes); await put('public/catalog.sig', signature); await put('public/catalog-key.pub', key);
  await put('keys/main.pub', key);
  await put('test-key.pem', pair.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const release = { sequence: 2, expires_at: '2099-01-01T00:00:00Z',
    packs: [path, 'packs/canonic/git/0.3.0/pack.yml'] };
  await put('release.json', JSON.stringify(release));
  return { root, put, release, old };
}
test('Current Rust validates a new structured release while authenticated expired historical bytes remain immutable',
  { skip: !process.env.SHIELD_BINARY }, async t => {
    const f = await releaseFixture(t);
    const result = await build(f.root, join(f.root, 'test-key.pem'), process.env.SHIELD_BINARY);
    assert.equal(result.catalog.sequence, 2);
    assert.equal(result.catalog.packs.length, 2);
    assert.equal(result.catalog.packs[0].sha256, f.old.packs[0].sha256);
    assert.deepEqual(await checkPublication(join(f.root, 'public'), key), result.catalog);
    assert.ok((await readFile(join(f.root, 'public/index.html'), 'utf8')).includes('main/git@0.3.0'));
    assert.deepEqual(await readFile(join(f.root, 'public/packs/canonic/git/0.3.0/commands.json')),
      await readFile(join(f.root, 'packs/canonic/git/0.3.0/commands.json')));
  });
test('Historical retention cannot bypass authentication, source integrity or an absent prior catalog', async t => {
  for (const change of ['source', 'signature', 'asset', 'missing', 'unpublished']) {
    const f = await releaseFixture(t);
    if (change === 'source') await f.put(f.old.packs[0].path, Buffer.from('{}'));
    if (change === 'signature') await f.put('public/catalog.sig', '0'.repeat(128));
    if (change === 'asset') await f.put('packs/canonic/git/0.2.0/cases.json', '{}');
    if (change === 'missing') await rm(join(f.root, 'public/catalog.json'));
    if (change === 'unpublished') await rm(join(f.root, 'public'), { recursive: true });
    await assert.rejects(build(f.root, join(f.root, 'test-key.pem'), process.env.SHIELD_BINARY || '/unused-validator'));
  }
});

test('Authenticated structured releases retain exact assets without reinterpreting historical fixtures', async t => {
  for (const tamper of [false, true]) {
    const f = await releaseFixture(t);
    const prefix = 'packs/canonic/git/0.3.0';
    for (const name of ['pack.yml', 'cases.json', 'README.md', 'LICENSE', 'commands.json']) {
      await f.put(`public/${prefix}/${name}`, await readFile(join(f.root, prefix, name)));
    }
    const path = `${prefix}/pack.yml`;
    f.old.packs.push({ id: 'canonic/git', version: '0.3.0', path, sha256: digest(await readFile(join(f.root, path))) });
    const [bytes, signature] = signed(f.old);
    await f.put('public/catalog.json', bytes);
    await f.put('public/catalog.sig', signature);
    if (tamper) await f.put(`${prefix}/cases.json`, '{}');
    // No new release: the validator must not run on authenticated old fixtures.
    if (tamper) {
      await assert.rejects(build(f.root, join(f.root, 'test-key.pem'), '/unused-validator'), /Historical release assets changed/);
      assert.deepEqual(await readFile(join(f.root, 'public/catalog.json')), bytes);
    } else {
      const result = await build(f.root, join(f.root, 'test-key.pem'), '/unused-validator');
      assert.deepEqual(result.catalog.packs, f.old.packs);
    }
  }
});
test('A baseline release retains its inventory and publishes its own coverage', {skip:!process.env.SHIELD_BINARY},async t=>{
  const f=await releaseFixture(t);
  const prefix='packs/canonic/baseline/0.1.0';
  for(const name of ['pack.yml','cases.json','README.md','LICENSE','commands.json']){
    const bytes=await readFile(new URL(`../${prefix}/${name}`,import.meta.url));
    await f.put(`${prefix}/${name}`,name==='pack.yml'?JSON.stringify(currentFormat(JSON.parse(bytes))):bytes);
  }
  f.release.packs.push(`${prefix}/pack.yml`);
  await f.put('release.json',JSON.stringify(f.release));
  const result=await build(f.root,join(f.root,'test-key.pem'),process.env.SHIELD_BINARY);
  assert.equal(result.catalog.packs.length,3);
  assert.ok(result.catalog.packs.some(p=>p.id==='canonic/baseline'));
  const page=await readFile(join(f.root,'public/index.html'),'utf8');
  assert.ok(page.includes('Standard commands and file operations within approved read/write paths'));
  assert.deepEqual(await readFile(join(f.root,`public/${prefix}/commands.json`)),await readFile(join(f.root,`${prefix}/commands.json`)));
});
test('A structurally valid new rule still requires Rust semantics and every expected fixture before signing',
  { skip: !process.env.SHIELD_BINARY }, async t => {
    for (const change of ['pattern', 'expected']) {
      const f = await releaseFixture(t);
      const path = change === 'pattern' ? 'packs/canonic/git/0.3.0/pack.yml' : 'packs/canonic/git/0.3.0/cases.json';
      const value = JSON.parse(await readFile(join(f.root, path)));
      if (change === 'pattern') { value.rules[0].conditions.executable = { regex: '(' }; value.capabilities.push('regex-v1'); }
      else value.cases[0].expected = 'allow';
      await f.put(path, JSON.stringify(value));
      const previous = await readFile(join(f.root, 'public/catalog.json'));
      await assert.rejects(build(f.root, join(f.root, 'test-key.pem'), process.env.SHIELD_BINARY), /Shield validation failed/);
      assert.deepEqual(await readFile(join(f.root, 'public/catalog.json')), previous);
    }
  });
