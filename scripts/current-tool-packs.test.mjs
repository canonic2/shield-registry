import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentToolVersions,currentDirectory,currentToolPack} from './build-current-tool-packs.mjs';
import {currentToolCases} from './current-tool-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkCatalog,digest} from './registry-release.mjs';

test('tool permission reset retains published setup and preview decisions', {skip:!process.env.SHIELD_BINARY}, () => {
  const catalog = checkCatalog(readFileSync(new URL('../public/catalog.json',import.meta.url)),
    readFileSync(new URL('../public/catalog.sig',import.meta.url),'utf8').trim(),
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const dir = mkdtempSync(join(tmpdir(),'tool-permission-reset-pack-'));
  try {
    for (const name of ['box','gate','testrun']) {
      const path = new URL('pack.yml',currentDirectory(name,'0.2.2'));
      const published = catalog.packs.find(pack=>pack.id===`canonic/${name}` && pack.version==='0.2.2');
      assert.ok(published,`${name}: published baseline`);
      assert.equal(digest(readFileSync(path)),published.sha256);
      const rows = [];
      for (const profile of ['loose','recommended','strict']) {
        for (const preview of [false,true]) {
          for (const resetFirst of [false,true]) {
            const args = resetFirst ? ['--reset-tool-permissions','--agent','codex']
              : ['--agent','codex','--reset-tool-permissions'];
            if (preview) args.push('--dry-run','--json');
            rows.push({name:`${name}-${profile}-${preview}-${resetFirst}`,profile,
              argv:[name,'mcp','setup',...args],
              expected:profile==='loose' || preview && name!=='testrun' ? 'allow' : 'ask'});
          }
        }
      }
      const cases = join(dir,`${name}.json`);
      writeFileSync(cases,JSON.stringify({schema_version:1,cases:rows}));
      const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
        '--pack',path.pathname,'--cases',cases],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
      assert.equal(result.status,0,result.stdout+result.stderr);
      assert.equal(JSON.parse(result.stdout).passed,true);
    }
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('testrun browser defaults and cross-frame evaluation preserve opaque and shared-action decisions', {skip:!process.env.SHIELD_BINARY}, () => {
  const dir = mkdtempSync(join(tmpdir(),'testrun-browser-contracts-pack-'));
  try {
    const context = {connectionId:'acme',id:'context',generation:'owned'};
    const rows = [];
    for (const profile of ['loose','recommended','strict']) {
      for (const reload of [true,false]) {
        const options = {performance:{reload,autoStop:false,ignoreCache:true}};
        const request = {operation:'trace_start',context,options};
        const action = {action:'trace_start',context,options};
        const binding = {testrun:{transport:{type:'stdio',command:'testrun',args:['mcp','serve'],env:{}},agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};
        const change = profile === 'loose' ? 'allow' : 'ask';
        rows.push(
          {name:`cache-cli-${profile}-${reload}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`cache-mcp-${profile}-${reload}`,profile,mcp:binding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`cache-act-${profile}-${reload}`,profile,mcp:binding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[action]},original_input:{}},expected:'ask'},
        );
      }
      const frame = {connectionId:'11111111-1111-4111-8111-111111111111',id:'22222222-2222-4222-8222-222222222222',generation:'33333333-3333-4333-8333-333333333333'};
      const handle = {...frame,id:'44444444-4444-4444-8444-444444444444'};
      for (const operation of ['evaluate','selector_evaluate']) {
        const parameters = {expression:'value=>value',isFunction:true,argument:{kind:'handle',handle}};
        const request = operation === 'evaluate' ? {operation,scope:frame,...parameters} : {operation,scope:frame,options:{locator:{kind:'css',selector:'body'},...parameters}};
        const {operation:_,...action} = request;
        const binding = {testrun:{transport:{type:'stdio',command:'testrun',args:['mcp','serve'],env:{}},agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};
        const change = profile === 'loose' ? 'allow' : 'ask';
        rows.push(
          {name:`adoption-cli-${operation}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          // Published isolated evaluate is routine (Allow/Allow/Ask);
          // selector_evaluate retains opaque fallback review.
          {name:`adoption-mcp-${operation}-${profile}`,profile,mcp:binding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:operation === 'evaluate' && profile !== 'strict' ? 'allow' : change},
          {name:`adoption-act-${operation}-${profile}`,profile,mcp:binding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...action}]},original_input:{}},expected:'ask'},
        );
      }
      for (const associated of [false,true]) {
        for (const userAgent of [undefined,'']) {
        const variant = userAgent === undefined ? 'default' : 'empty';
        const options = {baseUrl:'https://example.com',ignoreHttpsErrors:false,userAgent,...(associated?{browserContext:context}:{})};
        const request = {operation:'http_context_create',options};
        const binding = {testrun:{transport:{type:'stdio',command:'testrun',args:['mcp','serve'],env:{}},agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};
        const change = profile === 'loose' ? 'allow' : 'ask';
        rows.push(
          {name:`http-agent-cli-${associated}-${variant}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`http-agent-mcp-${associated}-${variant}-${profile}`,profile,mcp:binding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`http-agent-act-${associated}-${variant}-${profile}`,profile,mcp:binding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:'http_context_create',options}]},original_input:{}},expected:'ask'},
        );
        }
      }
      const headerOptions = {viewport:{width:640,height:480},deviceScaleFactor:1,extraHTTPHeaders:[{name:'X-Acme',value:'example'}]};
      const headerRequests = [
        {operation:'context_create',options:headerOptions},
        {operation:'context_configure',context,setting:{kind:'extra_http_headers',headers:headerOptions.extraHTTPHeaders}},
        {operation:'context_configure',context,setting:{kind:'extra_http_headers',headers:[]}},
        {operation:'page_set_extra_http_headers',page:context,headers:headerOptions.extraHTTPHeaders},
        {operation:'page_set_extra_http_headers',page:context,headers:[]},
        {operation:'http_context_create',options:{browserContext:context,baseUrl:'https://example.com'}},
        {operation:'http_context_create',options:{browserContext:context,baseUrl:'https://example.com',headers:[]}},
      ];
      const headerBinding = {testrun:{transport:{type:'stdio',command:'testrun',args:['mcp','serve'],env:{}},agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};
      const closeDecision=profile==='strict'?'ask':'allow';
      const credentialOptions={viewport:{width:640,height:480},deviceScaleFactor:1,httpCredentials:[{username:'Acme',password:'example',origin:'https://example.com',send:'unauthorized'}]};
      const credentialRequests=[
        {operation:'context_create',options:credentialOptions},
        {operation:'http_context_create',options:{baseUrl:'https://example.com',httpCredentials:credentialOptions.httpCredentials}},
        {operation:'http_context_create',options:{browserContext:context,httpCredentials:{username:'Acme',password:'example',send:'always'}}},
        {operation:'http_context_create',options:{browserContext:context,httpCredentials:[]}},
      ];
      for(const [index,request] of credentialRequests.entries()) {
        const {operation,...parameters}=request;
        const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`credentials-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`credentials-mcp-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`credentials-act-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...parameters}]},original_input:{}},expected:'ask'},
        );
      }
      rows.push(
        {name:`credentials-launch-cli-${profile}`,profile,argv:['testrun','connect','--engine','firefox','--context',JSON.stringify(credentialOptions)],expected:'ask'},
        {name:`credentials-launch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'firefox',mode:'headless',context:credentialOptions},original_input:{}},expected:'ask'},
        {name:`credentials-launch-shared-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'firefox',mode:'headless',context:credentialOptions},original_input:{}},expected:'ask'},
      );
      const lifecycleTarget='browser:11111111-1111-4111-8111-111111111111';
      rows.push(
        {name:`lifecycle-cli-${profile}`,profile,argv:['testrun','browser','disconnect','--target',lifecycleTarget],expected:closeDecision},
        {name:`lifecycle-legacy-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_disconnect',arguments:{targetId:lifecycleTarget},original_input:{}},expected:closeDecision},
        {name:`lifecycle-shared-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'disconnect',arguments:{targetId:lifecycleTarget},original_input:{}},expected:closeDecision},
      );
      for (const [index,request] of headerRequests.entries()) {
        const {operation,...parameters} = request;
        const change = profile === 'loose' ? 'allow' : 'ask';
        rows.push(
          {name:`headers-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`headers-mcp-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`headers-act-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...parameters}]},original_input:{}},expected:'ask'},
        );
      }
      rows.push(
        {name:`headers-launch-shared-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--mode','headless','--context',JSON.stringify(headerOptions)],expected:'ask'},
        {name:`headers-launch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'chrome',mode:'headless',context:headerOptions},original_input:{}},expected:'ask'},
        {name:`headers-launch-shared-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'chrome',mode:'headless',context:headerOptions},original_input:{}},expected:'ask'},
      );
    }
    const cases = join(dir,'cases.json');
    writeFileSync(cases,JSON.stringify({schema_version:1,cases:rows}));
    const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',new URL('pack.yml',currentDirectory('testrun')).pathname,'--cases',cases],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    const report = JSON.parse(result.stdout||'{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
    assert.equal(report.passed,true);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

for (const name of Object.keys(currentToolVersions)) {
  test(`${name} current surface reproduces from frozen sources and independent fixtures`,async()=>{
    const pack = await currentToolPack(name);
    const cases = await currentToolCases(name);
    const validate = schemaValidator(schema);
    for (const [file,document] of [['pack.yml',pack],['cases.json',cases]]) {
      const bytes = readFileSync(new URL(file,currentDirectory(name)));
      assert.ok(bytes.length <= 1_048_576,`${name} ${file}: artifact limit`);
      assert.deepEqual(JSON.parse(bytes),document);
      assert.equal(validate(document),true,JSON.stringify(validate.errors));
    }
    const previous = JSON.parse(readFileSync(new URL('pack.yml',currentDirectory(name,'0.2.1'))));
    for (const old of previous.rules) {
      const next = pack.rules.find(row=>row.id===old.id);
      assert.ok(next,old.id);
      if (old.id==='mcp-unlisted' || name==='testrun' && ['mcp-act','mcp-browser_connect','browser-connect'].includes(old.id)) continue;
      assert.deepEqual(next,old,old.id);
    }
    const ids = pack.rules.map(row=>row.id);
    assert.equal(new Set(ids).size,ids.length);
    assert.deepEqual(pack.mcp_integrations[name].fields['/args'],{exact:['mcp','serve']});
  });
  test(`${name} new and retained decisions use the production evaluator`,{skip:!process.env.SHIELD_BINARY},()=>{
    const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
      '--pack',new URL('pack.yml',currentDirectory(name)).pathname,
      '--cases',new URL('cases.json',currentDirectory(name)).pathname],
    {encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
    const report = JSON.parse(result.stdout||'{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
    assert.equal(report.passed,true);
  });
  test(`${name} a launch with extra project arguments cannot gain this pack`,{skip:!process.env.SHIELD_BINARY},()=>{
    const dir = mkdtempSync(join(tmpdir(),'current-pack-launch-'));
    try {
      const binding = {[name]:{transport:{type:'stdio',command:name,args:['mcp','serve','--project','/outside/other'],env:{}},
        agents:{codex:name},packs:{[`canonic/${name}`]:name}}};
      const cases = join(dir,'cases.json');
      writeFileSync(cases,JSON.stringify({schema_version:1,cases:[{name:'other-project',profile:'recommended',mcp:binding,
        input:{kind:'mcp',server:name,tool:'docs_read',arguments:{path:'README.md'},original_input:{}},expected:'allow'}]}));
      const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
        '--pack',new URL('pack.yml',currentDirectory(name)).pathname,'--cases',cases],{encoding:'utf8',timeout:120000});
      assert.equal(result.status,2,result.stdout+result.stderr);
      assert.match(result.stdout,/connection does not match its pack integration/);
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
}
