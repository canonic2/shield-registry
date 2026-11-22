import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentDirectory,currentToolPack} from './build-current-tool-packs.mjs';
import {binding,requests,trustedTestrunCases,hostPathCases} from './testrun-trusted-cases.mjs';
import {trustedTestrunGuide} from './testrun-trusted-policy.mjs';
import {caseFileNames} from './fixture-files.mjs';
import {checkPublication,digest} from './registry-release.mjs';

const allowed=decision=>decision==='allow' || Object.values(decision).every(value=>value==='allow');
const asked=decision=>Object.values(decision).every(value=>value==='ask');

test('Testrun allows every operation and gates only host files on approved roots',async()=>{
  const pack=await currentToolPack('testrun');
  assert.deepEqual(JSON.parse(readFileSync(new URL('pack.yml',currentDirectory('testrun')))),pack);
  assert.ok(!pack.preconditions?.length);
  for(const rule of pack.rules) {
    assert.equal(rule.conditions.cwd,undefined,rule.id);
    if(!rule.requirements) {
      // Identity rules allow; overflow and opaque-JSON rules ask in every profile.
      assert.ok(allowed(rule.decision) || asked(rule.decision) && /-overflow$|^cli-json-host-path$/.test(rule.id),rule.id);
      assert.equal(rule.on_unmet,undefined,rule.id);
      continue;
    }
    assert.ok(allowed(rule.decision),rule.id);
    assert.equal(rule.on_unmet.decision,'ask',rule.id);
    assert.deepEqual(Object.keys(rule.requirements),[rule.conditions.domain==='mcp' ? 'field_paths' : 'argument_paths'],rule.id);
    const selections=rule.conditions.domain==='mcp' ? Object.values(rule.requirements.field_paths)
      : [...Object.values(rule.requirements.argument_paths.options ?? {}),rule.requirements.argument_paths.operands].filter(Boolean);
    assert.ok(selections.length,rule.id);
    for(const selection of selections) assert.ok(['read','write'].includes(selection.path.within.root),rule.id);
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

test('Testrun retains authenticated 0.2.11 policy and companion bytes',async()=>{
  const directory=currentDirectory('testrun','0.2.11');
  const catalog=await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const published=catalog.releases.find(row=>row.id==='canonic/testrun' && row.version==='0.2.11');
  assert.ok(published);
  assert.equal(digest(readFileSync(new URL('pack.yml',directory))),published.sha256);
  for(const file of ['pack.yml',...await caseFileNames(directory),'commands.json','README.md','LICENSE'])
    assert.deepEqual(readFileSync(new URL(file,directory)),
      readFileSync(new URL(`../public/packs/canonic/testrun/0.2.11/${file}`,import.meta.url)),file);
});

// Independent Testrun 0.10.0 expectations. Clock inputs name no host files;
// another request in the same batch still retains its ordinary path boundary.
test('native Chrome clocks stay allowed without weakening mixed-batch host-file checks',
  {skip:!process.env.SHIELD_BINARY},t=>{
  const context={connectionId:'11111111-1111-4111-8111-111111111111',
    generation:'22222222-2222-4222-8222-222222222222',id:'33333333-3333-4333-8333-333333333333'};
  const actions=[{kind:'install'},{kind:'install',timeMs:0},{kind:'set_fixed_time',timeMs:0},
    {kind:'set_system_time',timeMs:100},{kind:'pause_at',timeMs:200},
    {kind:'run_for',durationMs:0},{kind:'fast_forward',durationMs:604800000},{kind:'resume'}];
  const cases=[];
  for(const profile of ['loose','recommended','strict']) {
    const mcp=(label,tool,args,expected='allow')=>cases.push({name:`clock-${label}-${profile}`,profile,mcp:binding(),
      input:{kind:'mcp',server:'testrun',tool,arguments:{targetId:'browser:acme',...args},original_input:{}},expected});
    for(const [index,action] of actions.entries()) {
      const request={operation:'context_clock',context,action};
      const {kind,...parameters}=action;
      const act={action:'context_clock',context,input:{action:kind,...parameters}};
      mcp(`send-${index}`,'browser_send',{request});
      mcp(`batch-${index}`,'browser_send',{request:{operation:'batch',requests:[request]}});
      mcp(`act-${index}`,'act',{actions:[act]});
      for(const [command,payload] of [[['browser','send'],request],[['act'],[act]]])
        cases.push({name:`clock-cli-${command.join('-')}-${index}-${profile}`,profile,
          argv:['testrun','--target','browser:acme',...command,JSON.stringify(payload)],expected:'allow'});
    }
    mcp('missing-input','browser_send',{request:{operation:'context_clock',context}});
    mcp('malformed-input','browser_send',{request:{operation:'context_clock',context,action:{kind:'run_for',durationMs:'invalid'}}});
    for(const [label,path,expected] of [['inside','reports/state.json','allow'],['outside','/outside/state.json','ask']]) {
      const clock={operation:'context_clock',context,action:{kind:'resume'}};
      const exportState={operation:'storage_export',context,options:{path}};
      mcp(`mixed-send-${label}`,'browser_send',{request:{operation:'batch',requests:[clock,exportState]}},expected);
      mcp(`mixed-act-${label}`,'act',{actions:[{action:'context_clock',context,input:{action:'resume'}},
        {action:'storage_export',context,options:{path}}]},expected);
    }
  }
  const report=passed(evaluate(cases));
  t.diagnostic(`Evaluated ${report.cases.length} clock and mixed-batch decisions against the unchanged policy.`);
});

// Independent Testrun 5.4 expectations. Passkey, credential-snapshot and broker
// sign-in inputs name no host files; brokers live in Testrun's own data root.
// A credential export to a caller path keeps the ordinary path boundary.
test('passkeys and broker sign-in stay allowed while credential exports keep host-file checks',
  {skip:!process.env.SHIELD_BINARY},t=>{
  const context={connectionId:'11111111-1111-4111-8111-111111111111',
    generation:'22222222-2222-4222-8222-222222222222',id:'33333333-3333-4333-8333-333333333333'};
  const journey={origin:'https://app.example.com',username:{kind:'label',text:'Email'},password:{kind:'label',text:'Password'},
    submit:{kind:'role',role:'button',name:'Sign in'},signedIn:{kind:'css',selector:'#account'},
    signedOut:{kind:'role',role:'heading',name:'Sign in to Acme'},identity:{kind:'css',selector:'#account'}};
  const requests=[
    {operation:'context_credentials',context,action:{kind:'install'}},
    {operation:'context_credentials',context,action:{kind:'create',rpId:'app.example.com',userHandle:'dXNlcg',signCount:3}},
    {operation:'context_credentials',context,action:{kind:'list',rpId:'app.example.com',cursor:'opaque',limit:10}},
    {operation:'context_credentials',context,action:{kind:'delete',id:'YWNtZQ'}},
    {operation:'storage_export',context,options:{credentials:true}},
    {operation:'storage_apply',context,snapshot:context,mode:'replace',installAuthenticator:true},
    {operation:'auth_broker_list',limit:10},
    {operation:'auth_sign_in',page:context,broker:'acme-vault',account:'staff',journey,expectedIdentity:'Staff user'},
    {operation:'auth_status',page:context,journey},
  ];
  const act=({operation,action,...rest})=>({action:operation,...rest,...(action?{input:{...action,action:action.kind,kind:undefined}}:{})});
  const cases=[];
  for(const profile of ['loose','recommended','strict']) {
    const mcp=(label,tool,args,expected='allow')=>cases.push({name:`credentials-${label}-${profile}`,profile,mcp:binding(),
      input:{kind:'mcp',server:'testrun',tool,arguments:{targetId:'browser:acme',...args},original_input:{}},expected});
    for(const [index,request] of requests.entries()) {
      mcp(`send-${index}`,'browser_send',{request});
      mcp(`batch-${index}`,'browser_send',{request:{operation:'batch',requests:[request]}});
      mcp(`act-${index}`,'act',{actions:[JSON.parse(JSON.stringify(act(request)))]});
      cases.push({name:`credentials-cli-${index}-${profile}`,profile,
        argv:['testrun','--target','browser:acme','browser','send',JSON.stringify(request)],expected:'allow'});
    }
    for(const [label,path,expected] of [['inside','reports/passkeys.json','allow'],['outside','/outside/passkeys.json','ask']]) {
      const exported={operation:'storage_export',context,options:{credentials:true,path}};
      mcp(`export-${label}`,'browser_send',{request:exported},expected);
      mcp(`export-batch-${label}`,'browser_send',{request:{operation:'batch',requests:[requests[1],exported]}},expected);
    }
  }
  const report=passed(evaluate(cases));
  t.diagnostic(`Evaluated ${report.cases.length} passkey, credential-snapshot and sign-in decisions against the unchanged policy.`);
});

test('production Shield allows Testrun operations and asks for host files outside approved roots',{skip:!process.env.SHIELD_BINARY},t=>{
  const report=passed(evaluate(trustedTestrunCases()));
  const all=hostPathCases();
  let total=report.cases.length;
  for(let index=0;index<all.length;index+=1024) total+=passed(evaluate(all.slice(index,index+1024))).cases.length;
  t.diagnostic(`Evaluated ${total} independent operation, host-file and unrelated-command decisions.`);
});

test('Testrun retains signed 0.2.10 bytes and its independent decisions',{skip:!process.env.SHIELD_BINARY},async()=>{
  const previous=currentDirectory('testrun','0.2.10');
  const catalog=await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const published=catalog.releases.find(row=>row.id==='canonic/testrun' && row.version==='0.2.10');
  assert.ok(published);
  assert.equal(digest(readFileSync(new URL('pack.yml',previous))),published.sha256);
  for(const file of ['pack.yml',...await caseFileNames(previous),'commands.json','README.md','LICENSE'])
    assert.deepEqual(readFileSync(new URL(file,previous)),
      readFileSync(new URL(`../public/packs/canonic/testrun/0.2.10/${file}`,import.meta.url)),file);
  for(const file of await caseFileNames(previous)) {
    const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',new URL('pack.yml',previous).pathname,
      '--cases',new URL(file,previous).pathname],{encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
    passed(result);
  }
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
