import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
const root = new URL('../packs/canonic/baseline/0.1.0/',import.meta.url);
const read = url => JSON.parse(readFileSync(url));
const pack=read(new URL('pack.yml',root)), cases=read(new URL('cases.json',root));
const validate=new Ajv({strict:false,allErrors:true}).compile(read(new URL('../schemas/policy.schema.json',import.meta.url)));

test('Baseline policies and independent expectations satisfy structured v1 admission',()=>{
  assert.equal(validate(pack),true,JSON.stringify(validate.errors));
  assert.equal(validate(cases),true,JSON.stringify(validate.errors));
  for(const profile of ['loose','recommended','strict'])assert.ok(cases.cases.some(c=>c.profile===profile));
});
test('Baseline source generation is reproducible',async t=>{
  const output=await mkdtemp(join(tmpdir(),'shield-baseline-generated-'));
  t.after(()=>rm(output,{recursive:true,force:true}));
  for(const [script,file] of [['build-baseline-pack.mjs','pack.yml'],['build-baseline-cases.mjs','cases.json']]){
    const result=spawnSync(process.execPath,[new URL(script,import.meta.url).pathname,output],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.deepEqual(readFileSync(join(output,file)),readFileSync(new URL(file,root)));
    if(script==='build-baseline-pack.mjs')assert.deepEqual(readFileSync(join(output,'commands.json')),readFileSync(new URL('commands.json',root)));
  }
});
test('Real Shield evaluates baseline decisions, requirement branches and guidance',{skip:!process.env.SHIELD_BINARY},()=>{
  const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--details','--pack',new URL('pack.yml',root).pathname,'--cases',new URL('cases.json',root).pathname],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
  const output=result.stdout ? JSON.parse(result.stdout) : null;
  assert.equal(result.status,0,result.stderr || JSON.stringify(output?.cases?.filter(c=>!c.passed)));
  assert.equal(output.passed,true);
  for(const name of ['remove-loose','outside-remove-recommended','read-recommended']){
    const c=output.cases.find(c=>c.name===name);
    const e=c.evaluation;
    assert.ok(e.matches.some(m=>m.applied));
    assert.ok(e.matches.some(m=>m.applied && m.requirement_checks.length));
    if(name==='outside-remove-recommended'){
      assert.ok(e.requirement_checks.some(c=>c.status==='failed' && c.code==='location_outside'));
      assert.ok(e.guidance.length);
    }
  }
});
test('Fresh native hooks enforce additional read/write paths without executing commands',{
  skip:!process.env.SHIELD_BINARY || process.platform==='win32',timeout:180000,
},()=>{
  const result=spawnSync('python3',[new URL('baseline-native.py',import.meta.url).pathname,process.env.SHIELD_BINARY,new URL('pack.yml',root).pathname],{encoding:'utf8',timeout:170000,maxBuffer:2*1024*1024});
  assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);
  assert.equal(output.passed,true);
  assert.equal(output.cases.length,171);
});
