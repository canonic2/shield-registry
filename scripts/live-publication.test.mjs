import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {digest} from './registry-release.mjs';
import {checkLivePublication} from './live-publication.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(),'registry-live-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const pair = generateKeyPairSync('ed25519');
  const key = Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  const path = 'packs/canonic/acme/1.0.0/pack.yml';
  const pack = Buffer.from(JSON.stringify({id:'canonic/acme',version:'1.0.0'}));
  const catalog = {schema_version:1,registry_id:'canonic-shield-main',sequence:3,
    expires_at:'2099-01-01T00:00:00Z',packs:[{id:'canonic/acme',version:'1.0.0',path,sha256:digest(pack)}]};
  const bytes = Buffer.from(JSON.stringify(catalog));
  const signature = Buffer.from(sign(null,bytes,pair.privateKey).toString('hex')+'\n');
  const files = new Map([['catalog.json',bytes],['catalog.sig',signature],['catalog-key.pub',Buffer.from(key)],[path,pack]]);
  for (const [name,content] of [...files].map(([name,content])=>['public/'+name,content]).concat([['keys/main.pub',key]])) {
    await mkdir(dirname(join(root,name)),{recursive:true});
    await writeFile(join(root,name),content);
  }
  const requests = [];
  const fetcher = async (url,options) => {
    assert.equal(url.origin,'https://canonic2.github.io');
    assert.equal(options.redirect,'error');
    assert.ok(options.signal instanceof AbortSignal);
    const name = url.pathname.replace('/shield-registry/','');
    requests.push(name);
    return files.has(name)?new Response(files.get(name)):new Response('',{status:404});
  };
  return {root,files,requests,fetcher,path,catalog,pair};
}

test('Live verification authenticates exact catalog/signature and served pack bytes',async t=>{
  const f=await fixture(t);
  assert.deepEqual(await checkLivePublication(f.root,f.fetcher),f.catalog);
  assert.deepEqual(f.requests,['catalog.json','catalog.sig',f.path]);
});

test('Live verification refuses a different authenticated deployment before pack downloads',async t=>{
  const f=await fixture(t);
  const bytes=Buffer.from(JSON.stringify({...f.catalog,sequence:4}));
  f.files.set('catalog.json',bytes);
  f.files.set('catalog.sig',Buffer.from(sign(null,bytes,f.pair.privateKey).toString('hex')+'\n'));
  await assert.rejects(checkLivePublication(f.root,f.fetcher),/sequence 4 does not match local sequence 3/);
  assert.deepEqual(f.requests,['catalog.json','catalog.sig']);
});

test('Live verification rejects tampered signatures',async t=>{
  const f=await fixture(t);
  f.files.set('catalog.sig',Buffer.from('0'.repeat(128)));
  await assert.rejects(checkLivePublication(f.root,f.fetcher),/Invalid catalog signature/);
});

test('Live verification rejects altered pack bytes',async t=>{
  const f=await fixture(t);
  f.files.set(f.path,Buffer.from('altered'));
  await assert.rejects(checkLivePublication(f.root,f.fetcher),/digest mismatch: canonic\/acme@1.0.0/);
});

test('Live verification reports missing resources without continuing',async t=>{
  const f=await fixture(t);
  f.files.delete('catalog.json');
  await assert.rejects(checkLivePublication(f.root,f.fetcher),/catalog.json: HTTP 404/);
  assert.deepEqual(f.requests,['catalog.json']);
});

test('Live verification bounds downloaded artifact sizes',async t=>{
  const f=await fixture(t);
  f.files.set(f.path,Buffer.alloc(1_048_577));
  await assert.rejects(checkLivePublication(f.root,f.fetcher),/artifact exceeds byte limit/);
});
