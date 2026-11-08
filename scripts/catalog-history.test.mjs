import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {buildHistory,checkHistoryPage,historyEntries} from './catalog-history.mjs';
import {checkCatalog,checkPrevious} from './registry-release.mjs';

const entry=index=>({id:'canonic/acme',version:`1.0.${index}`,path:`packs/canonic/acme/1.0.${index}/pack.yml`,sha256:'a'.repeat(64)});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const signed=root=>{
  const pair=generateKeyPairSync('ed25519');
  const bytes=Buffer.from(JSON.stringify(root));
  const key=Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('hex');
  return checkCatalog(bytes,sign(null,bytes,pair.privateKey).toString('hex'),key);
};
const catalog=history=>({schema_version:3,registry_id:'canonic-shield-main',sequence:2,
  expires_at:'2099-01-01T00:00:00Z',packs:history.packs,histories:history.histories});

test('Signed discovery remains small across thousands of historical versions',async()=>{
  for(const count of [65,4096]) {
    const rows=Array.from({length:count},(_,index)=>entry(index));
    const history=buildHistory(rows), root=signed(catalog(history));
    assert.equal(root.packs.length,1);
    assert.equal(root.packs[0].version,`1.0.${count-1}`);
    assert.ok(JSON.stringify(root).length<1000);
    const pages=new Map(history.artifacts), reads=[];
    const releases=await historyEntries(root,async path=>{reads.push(path);return pages.get(path);});
    assert.deepEqual(releases,rows);
    assert.equal(reads.length,pages.size);
    for(const [,bytes] of pages) {
      const page=JSON.parse(bytes);
      assert.ok((page.entries??page.children).length<=64);
    }
    assert.doesNotThrow(()=>checkPrevious({sequence:1,packs:rows.slice(0,64)}, {...root,releases}));
    const changed=structuredClone(releases); changed[0].sha256='b'.repeat(64);
    assert.throws(()=>checkPrevious({sequence:1,packs:rows.slice(0,64)}, {...root,releases:changed}),/immutable/);
  }
});

test('Publisher refuses histories beyond client full-lookup release and byte budgets',()=>{
  assert.throws(()=>buildHistory(Array.from({length:4097},(_,index)=>entry(index))),/4096 releases/);
  const large=Array.from({length:4096},(_,index)=>({...entry(index),path:'packs/'+ 'x'.repeat(2100)+index}));
  assert.throws(()=>buildHistory(large),/byte limits/);
});

test('History digest, pack identity, sorted ranges and leaf bounds are mandatory',async()=>{
  const history=buildHistory(Array.from({length:65},(_,index)=>entry(index)));
  const root=catalog(history), pages=new Map(history.artifacts);
  const reference=root.histories['canonic/acme'];
  const bytes=pages.get(reference.path);
  assert.throws(()=>checkHistoryPage('canonic/acme',reference,Buffer.from('{}')),/digest/);
  assert.throws(()=>checkHistoryPage('canonic/other',reference,bytes),/identity/);
  for(const mutate of [
    page=>page.children.reverse(),
    page=>page.children[1].first='1.0.1',
    page=>page.children[0].path='../escape.json',
    page=>page.entries=[entry(0)],
  ]) {
    const page=JSON.parse(bytes); mutate(page);
    const changed=Buffer.from(JSON.stringify(page));
    assert.throws(()=>checkHistoryPage('canonic/acme',{...reference,sha256:hash(changed)},changed));
  }
  const tampered=new Map(pages); tampered.set(reference.path,Buffer.from('{}'));
  await assert.rejects(historyEntries(root,async path=>tampered.get(path)),/digest/);
  for(const replacement of [{}, {...reference,last:'1.0.63'}, {...reference,path:'../escape'}]) {
    assert.throws(()=>signed({...root,histories:{'canonic/acme':replacement}}));
  }
});
