import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
const root = new URL('../packs/canonic/baseline/0.1.5/',import.meta.url);
const read = url => JSON.parse(readFileSync(url));
const pack=read(new URL('pack.yml',root)), cases=read(new URL('cases.json',root));
const validate=new Ajv({strict:false,allErrors:true}).compile(read(new URL('../schemas/policy.schema.json',import.meta.url)));

test('Baseline policies and independent expectations satisfy structured v1 admission',()=>{
  assert.equal(validate(pack),true,JSON.stringify(validate.errors));
  assert.equal(validate(cases),true,JSON.stringify(validate.errors));
  for(const profile of ['loose','recommended','strict'])assert.ok(cases.cases.some(c=>c.profile===profile));
});
test('Broad reviews explain themselves and yield to dedicated packs; restrictions do not',()=>{
  const reviews=pack.rules.filter(r=>r.id.startsWith('review-') && r.conditions.arguments?.kind==='any');
  assert.ok(reviews.length>40);
  for(const r of reviews){
    assert.equal(r.fallback,true,r.id);
    assert.ok(r.reason || r.guidance?.message,r.id);
  }
  for(const r of pack.rules.filter(r=>!reviews.includes(r)))assert.equal(r.fallback,undefined,r.id);
  assert.ok(!JSON.stringify(pack).includes('review access_paths in .shield/config.yml'));
  assert.ok(JSON.stringify(pack).includes('access_path_add'));
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
  const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--details','--pack',new URL('pack.yml',root).pathname,'--cases',new URL('../packs/canonic/baseline/0.2.1/cases.json',import.meta.url).pathname],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
  const output=result.stdout ? JSON.parse(result.stdout) : null;
  assert.equal(result.status,0,result.stderr || JSON.stringify(output?.cases?.filter(c=>!c.passed)));
  assert.equal(output.passed,true);
  for(const name of ['remove-loose','outside-remove-recommended','read-recommended','grep-recommended','rg-recommended','mkdir-loose','touch-strict','rg-config-recommended']){
    const c=output.cases.find(c=>c.name===name);
    const e=c.evaluation;
    assert.ok(e.matches.some(m=>m.applied));
    assert.ok(e.matches.some(m=>m.applied && m.requirement_checks.length));
    if(name==='outside-remove-recommended'){
      assert.ok(e.requirement_checks.some(c=>c.status==='failed' && c.code==='location_outside'));
      assert.ok(e.guidance.length);
    }
    if(name==='rg-config-recommended')assert.ok(JSON.stringify(e.guidance).includes('--no-config'));
  }
  // Asks with an allowed equivalent name it, so agents can resubmit.
  for(const [name,text] of [['find-delete-recommended','find PATH -type f'],['sort-output-recommended','cat FILE | sort']]){
    const e=output.cases.find(c=>c.name===name).evaluation;
    assert.equal(e.decision,'ask');
    assert.ok(JSON.stringify(e.guidance).includes(text),name);
  }
});
test('Fresh native hooks enforce additional read/write paths without executing commands',{
  skip:!process.env.SHIELD_BINARY || process.platform==='win32',timeout:180000,
},()=>{
  const result=spawnSync('python3',[new URL('baseline-native.py',import.meta.url).pathname,process.env.SHIELD_BINARY,new URL('pack.yml',root).pathname],{encoding:'utf8',timeout:170000,maxBuffer:2*1024*1024});
  assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);
  assert.equal(output.passed,true);
  assert.equal(output.cases.length,507);
});

test('Ripgrep 15.2.0 visible-tree contract skips hidden files and links without loading ignore files',{
  skip:!process.env.RG_BINARY || process.platform==='win32',
},async t=>{
  const version=spawnSync(process.env.RG_BINARY,['--version'],{encoding:'utf8'});
  assert.equal(version.status,0,version.stderr);
  assert.match(version.stdout,/^ripgrep 15\.2\.0(\s|$)/);
  const fixture=await mkdtemp(join(tmpdir(),'shield-rg-contract-'));
  t.after(()=>rm(fixture,{recursive:true,force:true}));
  const project=join(fixture,'project'), outside=join(fixture,'outside');
  for(const directory of [project,outside,join(project,'.aws'),join(project,'nested')])await mkdir(directory);
  for(const file of ['visible.txt','nested/deep.txt','.aws/credentials','.hidden.txt'])await writeFile(join(project,file),'Acme marker\n');
  await writeFile(join(outside,'outside.txt'),'Acme marker\n');
  await writeFile(join(project,'.ignore'),'visible.txt\n!.aws/**\n!.hidden.txt\n');
  await writeFile(join(fixture,'.ignore'),'nested/\n');
  await symlink(outside,join(project,'escape'));
  await symlink(join(outside,'outside.txt'),join(project,'file-link'));
  await symlink(join(outside,'outside.txt'),join(project,'.rgignore'));
  const config=join(outside,'rg-config');
  await writeFile(config,'--hidden\n--follow\n');
  // Fixed tool-contract probe over owned fixtures, separate from submitted hook commands.
  const result=spawnSync(process.env.RG_BINARY,['--no-config','--no-ignore','--no-follow','--no-hidden','-l','Acme',project],{
    encoding:'utf8',timeout:10000,env:{...process.env,RIPGREP_CONFIG_PATH:config},
  });
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n').sort(),[join(project,'visible.txt'),join(project,'nested/deep.txt')].sort());
});
