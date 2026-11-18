import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentDirectory,currentToolPack} from './build-current-tool-packs.mjs';
import {binding,requests,trustedTestrunCases} from './testrun-trusted-cases.mjs';
import {trustedTestrunGuide} from './testrun-trusted-policy.mjs';

test('Testrun trusts all arguments and future names without retaining approval gates',async()=>{
  const pack=await currentToolPack('testrun');
  assert.deepEqual(JSON.parse(readFileSync(new URL('pack.yml',currentDirectory('testrun')))),pack);
  assert.ok(!pack.preconditions?.length);
  for(const rule of pack.rules) {
    assert.equal(rule.requirements,undefined,rule.id);
    assert.equal(rule.on_unmet,undefined,rule.id);
    assert.equal(rule.conditions.cwd,undefined,rule.id);
    assert.ok(rule.decision==='allow' || Object.values(rule.decision).every(decision=>decision==='allow'),rule.id);
    if(rule.conditions.domain==='mcp') assert.equal(rule.conditions.fields,undefined,rule.id);
  }
  const previous=JSON.parse(readFileSync(new URL('pack.yml',currentDirectory('testrun','0.2.9'))));
  assert.deepEqual(pack.mcp_integrations,previous.mcp_integrations);
  assert.equal(readFileSync(new URL('README.md',currentDirectory('testrun')),'utf8'),
    `# Testrun permissions ${pack.version}\n\nRequires Shield \`${pack.engines.shield}\`.\n\n${trustedTestrunGuide()}`);
});

function evaluate(cases,{version,baseline=false}={}) {
  const owner=mkdtempSync(join(tmpdir(),'testrun-trusted-pack-'));
  try {
    const path=join(owner,'cases.json');
    writeFileSync(path,JSON.stringify({schema_version:1,cases}));
    const args=['__internal','test-pack','--pack',new URL('pack.yml',currentDirectory('testrun',version)).pathname,'--cases',path];
    if(baseline) args.push('--with-pack',new URL('../packs/canonic/baseline/0.15.0/pack.yml',import.meta.url).pathname);
    return spawnSync(process.env.SHIELD_BINARY,args,{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
  } finally {rmSync(owner,{recursive:true,force:true});}
}
function passed(result) {
  const report=JSON.parse(result.stdout || '{}');
  assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed) ?? report)+result.stderr);
  assert.equal(report.passed,true);
  return report;
}

test('production Shield approves connect, browser act, every argument shape and future tools in every profile',{skip:!process.env.SHIELD_BINARY},t=>{
  const report=passed(evaluate(trustedTestrunCases()));
  t.diagnostic(`Evaluated ${report.cases.length} independent trusted-tool and unrelated-command decisions.`);
});

test('the reported browser workflow remains approved when Baseline is installed',{skip:!process.env.SHIELD_BINARY},()=>{
  const cases=trustedTestrunCases().filter(row=>row.expected==='allow');
  passed(evaluate(cases,{baseline:true}));
});

test('Testrun 0.2.9 reproduced the reported browser approval prompts',{skip:!process.env.SHIELD_BINARY},()=>{
  const cases=['recommended','strict'].flatMap(profile=>[requests[0],requests[2]].map(([tool,args])=>({
    name:`old-browser-${tool}-${profile}`,profile,mcp:binding(),
    input:{kind:'mcp',server:'testrun',tool,arguments:args,original_input:{}},expected:'ask',
  })));
  passed(evaluate(cases,{version:'0.2.9'}));
});

test('universal Testrun permission still requires the reviewed MCP connection',{skip:!process.env.SHIELD_BINARY},()=>{
  for(const transport of [
    {type:'stdio',command:'/tmp/forged/testrun',args:['mcp','serve'],env:{}},
    {type:'stdio',command:'testrun-other',args:['mcp','serve'],env:{}},
    {type:'stdio',command:'sh',args:['-c','testrun mcp serve'],env:{}},
    {type:'stdio',command:'testrun',args:['mcp','serve','--check'],env:{}},
    {type:'http',url:'https://example.com/mcp'},
  ]) {
    const mcp=binding();mcp.testrun.transport=transport;
    const result=evaluate([{name:'foreign-connection',profile:'recommended',mcp,
      input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'chrome'},original_input:{}},expected:'allow'}]);
    assert.equal(result.status,2,result.stdout+result.stderr);
    assert.match(result.stdout,/connection does not match its pack integration/);
  }
});
