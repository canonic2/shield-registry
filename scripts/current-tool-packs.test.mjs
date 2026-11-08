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
import {checkPublication,digest} from './registry-release.mjs';
import {splitCaseFiles,caseFileNames} from './fixture-files.mjs';

test('tool permission reset retains published setup and preview decisions', {skip:!process.env.SHIELD_BINARY}, async () => {
  const catalog = await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const dir = mkdtempSync(join(tmpdir(),'tool-permission-reset-pack-'));
  try {
    for (const name of ['box','gate','testrun']) {
      const path = new URL('pack.yml',currentDirectory(name,'0.2.2'));
      const published = (catalog.releases??catalog.packs).find(pack=>pack.id===`canonic/${name}` && pack.version==='0.2.2');
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

test('testrun browser defaults and cross-frame evaluation preserve opaque and shared-action decisions', {skip:!process.env.SHIELD_BINARY}, t => {
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
      const filenameRequests = [
        {operation:'trace_start',context,options:{filePath:'missing/deep/Acme.record'}},
        {operation:'trace_stop',filePath:'level/../Acme.backup.GZ'},
        {operation:'trace_stop',filePath:'.gz'},
      ];
      const associatedStateRequests = [
        {operation:'http_context_storage_state',httpContext:frame,options:{indexedDB:true,opfs:true}},
        {operation:'http_context_storage_state',httpContext:frame,options:{indexedDB:false,opfs:false}},
        {operation:'http_context_storage_state',httpContext:frame,options:{indexedDB:true,opfs:false}},
        {operation:'http_context_storage_state',httpContext:frame,options:{indexedDB:false,opfs:true}},
      ];
      const associatedStateBinding = {testrun:{transport:{type:'stdio',command:'testrun',args:['mcp','serve'],env:{}},agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};
      for (const [index,request] of associatedStateRequests.entries()) {
        const {operation,...parameters}=request;
        const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`associated-state-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`associated-state-mcp-${index}-${profile}`,profile,mcp:associatedStateBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`associated-state-act-${index}-${profile}`,profile,mcp:associatedStateBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...parameters}]},original_input:{}},expected:'ask'},
        );
      }
      const filenameBinding = {testrun:{transport:{type:'stdio',command:'testrun',args:['mcp','serve'],env:{}},agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};
      for (const [index,request] of filenameRequests.entries()) {
        const {operation,...parameters}=request;
        const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`trace-filename-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`trace-filename-mcp-${index}-${profile}`,profile,mcp:filenameBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`trace-filename-act-${index}-${profile}`,profile,mcp:filenameBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...parameters}]},original_input:{}},expected:'ask'},
        );
      }
      const handle = {...frame,id:'44444444-4444-4444-8444-444444444444'};
      const pausedRequests = [
        {operation:'evaluate',scope:frame,expression:'()=>42',isFunction:true},
        {operation:'evaluate',scope:handle,expression:'owner=>owner',isFunction:true,returnHandle:true},
        {operation:'selector_evaluate',scope:frame,options:{locator:{kind:'css',selector:'button'},expression:'element=>element.textContent',isFunction:true}},
        {operation:'handle_read',handle},
        {operation:'handle_dispose',handle},
      ];
      for (const [index,request] of pausedRequests.entries()) {
        const {operation,...parameters}=request;
        const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`paused-evaluation-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`paused-evaluation-mcp-${index}-${profile}`,profile,mcp:associatedStateBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:['evaluate','handle_read','handle_dispose'].includes(operation) && profile!=='strict'?'allow':change},
          {name:`paused-evaluation-act-${index}-${profile}`,profile,mcp:associatedStateBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...parameters}]},original_input:{}},expected:'ask'},
        );
      }
      rows.push({name:`paused-evaluation-batch-${profile}`,profile,mcp:associatedStateBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:pausedRequests.slice(0,3).map(({operation,...parameters})=>({action:operation,...parameters}))},original_input:{}},expected:'ask'});
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
      const debuggerCommands=[{kind:'pause'},{kind:'next',pauseId:'11111111-1111-4111-8111-111111111111'},{kind:'run_to',pauseId:'11111111-1111-4111-8111-111111111111',location:{file:'Acme-journey.rs',line:30,column:3}}];
      for(const [index,command] of debuggerCommands.entries()) {
        const {kind,...parameters}=command;
        const request={operation:'context_debugger',context,action:command};
        const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`debugger-order-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`debugger-order-mcp-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`debugger-order-act-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:'context_debugger',context,input:{action:kind,...parameters}}]},original_input:{}},expected:'ask'},
        );
      }
      const source={file:'Acme-journey.rs',line:30,column:3};
      const sourceRequest={operation:'page_action',page:context,locator:{kind:'css',selector:'#Acme'},action:{kind:'at_source',source,action:{kind:'click'}}};
      rows.push(
        {name:`debugger-source-cli-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(sourceRequest)],expected:profile==='loose'?'allow':'ask'},
        {name:`debugger-source-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request:sourceRequest},original_input:{}},expected:profile==='strict'?'ask':'allow'},
        {name:`debugger-plain-click-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request:{operation:'page_action',page:context,locator:{kind:'css',selector:'#Acme'},action:{kind:'click'}}},original_input:{}},expected:profile==='strict'?'ask':'allow'},
        {name:`debugger-source-act-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:'page_action',page:context,locator:{kind:'css',selector:'#Acme'},input:{action:'at_source',source,input:{action:'click'}}}]},original_input:{}},expected:'ask'},
      );
      const closeDecision=profile==='strict'?'ask':'allow';
      const credentialOptions={viewport:{width:640,height:480},deviceScaleFactor:1,httpCredentials:[{username:'Acme',password:'example',origin:'https://example.com',send:'unauthorized'}]};
      const launchProxy={server:'http://AcmeIgnored:example@127.0.0.1:8080/ignored',username:'Acme global',password:'global example'};
      const initialOverride={...credentialOptions,proxy:{server:'http://127.0.0.1:8081',username:'Acme context',password:'context example'}};
      rows.push(
        {name:`launch-global-shared-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--proxy',JSON.stringify(launchProxy),'--context',JSON.stringify(initialOverride)],expected:'ask'},
        {name:`launch-global-legacy-cli-${profile}`,profile,argv:['testrun','browser','connect','--engine','firefox','--proxy',JSON.stringify(launchProxy)],expected:'ask'},
        {name:`launch-global-before-engine-cli-${profile}`,profile,argv:['testrun','connect','--proxy',JSON.stringify(launchProxy),'--engine','webkit'],expected:'ask'},
        {name:`launch-global-attached-cli-${profile}`,profile,argv:['testrun','connect','--engine=chrome','--proxy='+JSON.stringify(launchProxy)],expected:'ask'},
        {name:`launch-global-missing-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--proxy'],expected:'ask'},
        {name:`launch-global-malformed-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--proxy','{Acme'],expected:'ask'},
        {name:`launch-global-legacy-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'webkit',mode:'headless',proxy:launchProxy},original_input:{}},expected:'ask'},
        {name:`launch-global-shared-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'firefox',proxy:launchProxy},original_input:{}},expected:'ask'},
        {name:`launch-global-initial-override-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'chrome',mode:'headed',proxy:launchProxy,context:initialOverride},original_input:{}},expected:'ask'},
      );
      for(const scheme of ['socks4','socks5']) {
        const browserSocks={server:`${scheme}://AcmeIgnored:example@127.0.0.1:1080/ignored`,bypass:'127.0.0.1',username:'',password:''};
        rows.push(
          {name:`browser-${scheme}-shared-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--proxy',JSON.stringify(browserSocks)],expected:'ask'},
          {name:`browser-${scheme}-legacy-cli-${profile}`,profile,argv:['testrun','browser','connect','--engine','firefox','--proxy',JSON.stringify(browserSocks)],expected:'ask'},
          {name:`browser-${scheme}-attached-cli-${profile}`,profile,argv:['testrun','connect','--engine=webkit','--proxy='+JSON.stringify(browserSocks)],expected:'ask'},
          {name:`browser-${scheme}-legacy-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'chrome',proxy:browserSocks},original_input:{}},expected:'ask'},
          {name:`browser-${scheme}-shared-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'firefox',proxy:browserSocks},original_input:{}},expected:'ask'},
          {name:`browser-${scheme}-initial-override-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'webkit',proxy:browserSocks,context:{viewport:{width:640,height:480},deviceScaleFactor:1,proxy:{server:'socks5://127.0.0.1:1081'}}},original_input:{}},expected:'ask'},
        );
      }
      const socketOwner={scope:context,frame:context,routeId:'11111111-1111-4111-8111-111111111111',socketId:'a'.repeat(64)};
      const socketSdkRequests=[
        {operation:'web_socket_route_add',scope:context,url:'ws://127.0.0.1:8081/Acme',sdkDefaults:true},
        {operation:'web_socket_route_add_matcher',scope:context,matcher:{kind:'glob',pattern:'ws://127.0.0.1:8081/Acme/**'},sdkDefaults:true},
        {operation:'web_socket_route_handlers',...socketOwner,handlers:{pageMessage:'00000000-0000-0000-0000-000000000001',serverMessage:'00000000-0000-0000-0000-000000000002'}},
        {operation:'web_socket_route_handlers',...socketOwner,handlers:{pageMessage:null,serverMessage:null}},
        {operation:'web_socket_route_handlers',...socketOwner,handlers:{pageClose:'00000000-0000-0000-0000-000000000001',serverClose:'00000000-0000-0000-0000-000000000002'}},
        {operation:'web_socket_route_close',...socketOwner,to:'server'},
        {operation:'web_socket_route_close',...socketOwner,to:'page',options:{code:1002,reason:'Acme protocol'}},
        {operation:'web_socket_route_close',...socketOwner,to:'server',options:{code:3002,reason:'Acme server'}},
        {operation:'web_socket_route_close',...socketOwner,to:'page',options:{code:3003,reason:'Acme final'}},
        {operation:'web_socket_route_close',...socketOwner,to:'page'},
        {operation:'web_socket_route_close',...socketOwner,to:'page',options:{}},
        {operation:'web_socket_route_close',...socketOwner,to:'server',options:{}},
        {operation:'web_socket_route_close',...socketOwner,to:'page',options:{reason:'Acme reason'}},
        {operation:'web_socket_route_close',...socketOwner,to:'server',options:{reason:'Acme reason'}},
        {operation:'web_socket_route_handlers',...socketOwner,handlers:{pageClose:null}},
        {operation:'web_socket_route_handlers',...socketOwner,handlers:{serverClose:null}},
        {operation:'web_socket_route_close',...socketOwner,to:'page',options:{reason:''}},
        {operation:'web_socket_route_close',...socketOwner,to:'server',options:{reason:''}},
      ];
      for(const [index,request] of socketSdkRequests.entries()) {
        const {operation,...parameters}=request;const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`socket-sdk-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`socket-sdk-mcp-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`socket-sdk-act-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:operation,...parameters}]},original_input:{}},expected:'ask'},
        );
      }
      const serviceWorker={...context,id:'44444444-4444-4444-8444-444444444444'};
      const workerCallback={...context,id:'55555555-5555-4555-8555-555555555555'};
      const capturePage={...context,id:'77777777-7777-4777-8777-777777777777'};
      const workerRouteRequests=[
        ...['binding_resolve_value','binding_reject_value'].flatMap(kind=>[
          {kind:'undefined'},
          {kind:'bigint',value:'9007199254740993'},
          {kind:'object',id:1,entries:[{key:'self',value:{kind:'reference',id:1}}]},
        ].map(value=>({isolated:true,request:{operation:'callback_resolve',callback:capturePage,response:{kind,value}}}))),
        {isolated:true,request:{operation:'handle_dispose',handle:capturePage}},
        {isolated:false,request:{operation:'framework_release',registry:capturePage}},
        {isolated:false,request:{operation:'context_debugger',context,action:{kind:'enable'}}},
        {isolated:false,request:{operation:'context_debugger',context,action:{kind:'pause'}}},
        {isolated:false,request:{operation:'context_debugger',context,action:{kind:'next',pauseId:capturePage.id}}},
        {isolated:false,request:{operation:'context_debugger',context,action:{kind:'resume',pauseId:capturePage.id}}},
        {isolated:false,request:{operation:'context_debugger',context,action:{kind:'calls',limit:32,includeDetails:true}}},
        {isolated:false,request:{operation:'context_debugger',context,action:{kind:'status'}}},
        {isolated:false,request:{operation:'network_route',scope:capturePage,action:{kind:'add_matcher',matcher:{kind:'regex',pattern:''}}}},
        {isolated:false,request:{operation:'network_route',scope:capturePage,action:{kind:'add_matcher',matcher:{kind:'regex',pattern:String.raw`[\101]cme`}}}},
        {isolated:false,request:{operation:'har_capture_start',context,content:'embed',mode:'minimal',urlFilter:{kind:'regex',pattern:''}}},
        {isolated:false,request:{operation:'har_capture_start',context,content:'embed',mode:'minimal',urlFilter:{kind:'regex',pattern:'[]'}}},
        {isolated:false,request:{operation:'web_socket_route_add_matcher',scope:capturePage,matcher:{kind:'regex',pattern:''}}},
        {isolated:false,request:{operation:'web_socket_route_add_matcher',scope:capturePage,matcher:{kind:'regex',pattern:String.raw`[\101]cme`}}},
        {isolated:true,request:{operation:'page_close',page:capturePage}},
        {isolated:true,request:{operation:'page_create',context,select:false}},
        {isolated:false,request:{operation:'har_capture_start',context,content:'embed',mode:'full',urlFilter:{kind:'glob',pattern:'**/wire/*'}}},
        {isolated:false,request:{operation:'har_capture_start',context,content:'embed',mode:'minimal',urlFilter:{kind:'glob',pattern:'**/wire/*'}}},
        {isolated:false,request:{operation:'har_capture_start',context,page:capturePage,content:'embed',mode:'full',urlFilter:{kind:'glob',pattern:'**/wire/*'}}},
        {isolated:false,request:{operation:'har_capture_stop',context}},
        {isolated:false,request:{operation:'context_create',options:{viewport:{width:640,height:480},deviceScaleFactor:1,extraHTTPHeaders:[{name:'X-Acme-Context',value:'initial'}],httpCredentials:{origin:'http://127.0.0.1:8081',username:'Acme',password:'example'}}}},
        {isolated:false,request:{operation:'context_configure',context,setting:{kind:'extra_http_headers',headers:[]}}},
        {isolated:false,request:{operation:'context_configure',context,setting:{kind:'http_credentials',credentials:{origin:'http://127.0.0.1:8081',username:'Acme',password:'replacement'}}}},
        {isolated:false,request:{operation:'context_configure',context,setting:{kind:'http_credentials',credentials:null}}},
        {isolated:false,request:{operation:'context_route_set',context,url:'http://127.0.0.1:8081/wire/Acme',authenticationChallenges:true}},
        {isolated:true,request:{operation:'callback_resolve',callback:workerCallback,response:{kind:'auth_cancel'}}},
        {isolated:false,request:{operation:'context_har_set',context,archiveId:'66666666-6666-4666-8666-666666666666',notFound:'abort',urlFilter:{kind:'glob',pattern:'http://127.0.0.1:8081/wire/*'}}},
        {isolated:false,request:{operation:'context_har_set',context,archiveId:null}},
        {isolated:false,request:{operation:'network_route',scope:context,action:{kind:'add_har',archiveId:'66666666-6666-4666-8666-666666666666',notFound:'fallback',urlFilter:{kind:'glob',pattern:'http://127.0.0.1:8081/wire/*'}}}},
        {isolated:true,request:{operation:'callback_resolve',callback:workerCallback,response:{kind:'route_fallback'}}},
        {isolated:false,request:{operation:'context_route_set',context,url:'http://127.0.0.1:8081/wire/Acme'}},
        {isolated:false,request:{operation:'network_route',scope:context,action:{kind:'add_matcher',matcher:{kind:'glob',pattern:'http://127.0.0.1:8081/wire/*'}}}},
        {isolated:false,request:{operation:'network_route',scope:context,action:{kind:'remove',handlerId:'11111111-1111-4111-8111-111111111111'}}},
        {isolated:false,request:{operation:'network_route',scope:context,action:{kind:'clear',behavior:'wait'}}},
        {isolated:true,request:{operation:'callback_resolve',callback:workerCallback,response:{kind:'route_continue'}}},
        {isolated:true,request:{operation:'callback_resolve',callback:workerCallback,response:{kind:'route_fulfill',status:200,body:'Acme worker reply',contentType:'text/plain'}}},
        {isolated:true,request:{operation:'evaluate',scope:serviceWorker,isFunction:true,expression:"async()=>await(await fetch('/wire/Acme')).text()"}},
        {isolated:true,request:{operation:'context_worker_list',context}},
        {isolated:true,request:{operation:'context_close',context}},
      ];
      for(const [index,{request,isolated}] of workerRouteRequests.entries()) {
        const {operation,...parameters}=request;const change=profile==='loose'?'allow':'ask';
        const action={...parameters,action:operation};
        if(operation==='network_route'||operation==='context_debugger') {
          const {kind,...input}=parameters.action;
          action.input={...input,action:kind};
        }
        rows.push(
          {name:`worker-route-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`worker-route-mcp-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:isolated&&profile!=='strict'?'allow':change},
          {name:`worker-route-act-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[action]},original_input:{}},expected:'ask'},
        );
      }
      for(const operation of ['context_close','page_close']) {
        const reference=operation==='context_close'?{context}:{page:capturePage};
        const request={operation,...reference},action={action:operation,...reference};
        rows.push(
          {name:`closed-sdk-owner-cli-${operation}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:profile==='loose'?'allow':'ask'},
          {name:`closed-sdk-owner-mcp-${operation}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:profile==='strict'?'ask':'allow'},
          {name:`closed-sdk-owner-act-${operation}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[action]},original_input:{}},expected:'ask'},
        );
      }
      const debuggerControls=[{operation:'context_debugger',context,action:{kind:'status'}},{operation:'context_debugger',context,action:{kind:'next',pauseId:capturePage.id}}];
      for(const located of [false,true]) {
        const source={file:'src/Acme-collected-caller.rs',line:20,column:3};
        const request={operation:'page_action',page:capturePage,locator:{kind:'css',selector:'#waiting'},action:located?{kind:'at_source',source,action:{kind:'click'}}:{kind:'click'}};
        const action={action:'page_action',page:capturePage,locator:{kind:'css',selector:'#waiting'},input:located?{action:'at_source',source,input:{action:'click'}}:{action:'click'}};
        rows.push(
          {name:`collected-caller-cli-${located}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:profile==='loose'?'allow':'ask'},
          {name:`collected-caller-mcp-${located}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:profile==='strict'?'ask':'allow'},
          {name:`collected-caller-act-${located}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[action]},original_input:{}},expected:'ask'},
        );
      }
      const debuggerBatch={operation:'batch',requests:debuggerControls};
      rows.push(
        {name:`collected-debugger-batch-cli-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(debuggerBatch)],expected:profile==='loose'?'allow':'ask'},
        {name:`collected-debugger-batch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request:debuggerBatch},original_input:{}},expected:profile==='loose'?'allow':'ask'},
        {name:`collected-debugger-batch-act-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:debuggerControls.map(({operation,action,...parameters})=>{const {kind,...input}=action;return {...parameters,action:operation,input:{...input,action:kind}};})},original_input:{}},expected:'ask'},
      );
      const credentialRequests=[
        {operation:'context_create',options:{viewport:{width:640,height:480},deviceScaleFactor:1,proxy:{server:'socks4://AcmeIgnored:example@127.0.0.1:1080/ignored',bypass:'127.0.0.1'}}},
        {operation:'context_create',options:{viewport:{width:640,height:480},deviceScaleFactor:1,proxy:{server:'socks5://127.0.0.1:1080',username:'',password:''}}},
        {operation:'context_create',options:{viewport:{width:640,height:480},deviceScaleFactor:1,proxy:{server:'socks4://127.0.0.1:1080',username:'Acme refused'}}},
        {operation:'context_create',options:{viewport:{width:640,height:480},deviceScaleFactor:1,proxy:{server:'socks5://127.0.0.1:1080',password:'refused example'}}},
        {operation:'http_context_create',options:{browserContext:context,proxy:{server:'socks4://Acme:ignored@127.0.0.1:1080'}}},
        {operation:'http_context_create',options:{browserContext:context,proxy:{server:'socks5://127.0.0.1:1080'},ignoreHttpsErrors:false}},
        {operation:'http_context_create',options:{proxy:'socks5://Acme:example@127.0.0.1:1080'}},
        {operation:'http_context_create',options:{proxy:{server:'socks4a://Acme:ignored@127.0.0.1:1080',bypass:'localhost'}}},
        {operation:'http_context_create',options:{browserContext:context,proxy:{server:'socks5h://Acme:example@127.0.0.1:1080',username:'Acme ignored',password:'ignored example'}}},
        {operation:'http_fetch',httpContext:context,request:{url:'https://localhost:8081/Acme',ignoreHttpsErrors:false,maxRetries:2}},
        {operation:'http_fetch',httpContext:context,request:{url:'https://localhost:8081/Acme',ignoreHttpsErrors:true,maxRetries:2}},
        {operation:'http_fetch',httpContext:context,request:{url:'https://127.0.0.1:8081/Acme',method:'POST',body:{kind:'text',text:'Acme private body'},readBody:true,maxRetries:2}},
        {operation:'http_fetch',httpContext:context,request:{url:'https://127.0.0.1:8081/Acme',readBody:true,maxRedirects:0,maxRetries:2}},
        {operation:'http_fetch',httpContext:context,request:{url:'http://127.0.0.1:8081/Acme',readBody:true,failOnStatusCode:true,maxRetries:2}},
        {operation:'context_create',options:{...credentialOptions,proxy:{server:'http://127.0.0.1:8080',bypass:'localhost',username:'Acme proxy',password:'example'}}},
        {operation:'http_context_create',options:{browserContext:context,baseUrl:'http://127.0.0.1:8081'}},
        {operation:'http_context_create',options:{browserContext:context,proxy:{server:'http://127.0.0.1:8082',username:'Acme override',password:''}}},
        {operation:'http_context_create',options:{proxy:'http://Acme:example@127.0.0.1:8080'}},
        {operation:'http_context_create',options:{proxy:{server:'http://127.0.0.1:8080',bypass:'.example.com,localhost',username:'Acme',password:'example'}}},
        {operation:'http_context_create',options:{proxy:{server:'https://127.0.0.1:8080',username:'Acme%3Auser',password:'example%40pass'},ignoreHttpsErrors:true}},
        {operation:'context_create',options:credentialOptions},
        {operation:'http_context_create',options:{baseUrl:'https://example.com',httpCredentials:credentialOptions.httpCredentials}},
        {operation:'http_context_create',options:{browserContext:context,httpCredentials:{username:'Acme',password:'example',send:'always'}}},
        {operation:'http_context_create',options:{browserContext:context,httpCredentials:[]}},
        {operation:'http_context_create',options:{storageState:{cookies:[{name:'Acme',value:'example',domain:'example.com',path:'/',expires:-1,httpOnly:true,secure:true,sameSite:'Lax'}],origins:[]}}},
        {operation:'http_context_create',options:{storageState:'/private/Acme/auth-state.json'}},
        {operation:'http_context_storage_state',httpContext:context,options:{indexedDB:true,opfs:true}},
        {operation:'http_evidence_finalize',captureId:'11111111-1111-4111-8111-111111111111'},
        {operation:'http_fetch',httpContext:context,request:{url:'https://example.com/redirect',headers:[{name:'Authorization',value:'Acme-example'},{name:'Proxy-Authorization',value:'Acme-proxy-example'},{name:'Cookie',value:'Acme=example'},{name:'Host',value:'example.com'},{name:'X-Acme',value:''}]}},
        {operation:'context_create',options:{viewport:{width:640,height:480},deviceScaleFactor:1,clientCertificates:[{origin:'https://localhost:8081',cert:'QWNtZS1jZXJ0',key:'QWNtZS1rZXk='}]}},
        {operation:'http_context_create',options:{clientCertificates:[{origin:'https://localhost:8081',cert:'QWNtZS1jZXJ0',key:'QWNtZS1rZXk='}]}},
        {operation:'http_context_create',options:{browserContext:context,clientCertificates:[]}},
        {operation:'http_context_create',options:{browserContext:context,clientCertificates:null}},
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
      for(const [index,setting] of [
        {kind:'http_credentials',credentials:credentialOptions.httpCredentials},
        {kind:'http_credentials',credentials:null},
        {kind:'http_credentials',credentials:[]},
        {kind:'http_credentials'},
      ].entries()) {
        const request={operation:'context_configure',context,setting};
        const change=profile==='loose'?'allow':'ask';
        rows.push(
          {name:`credential-setting-cli-${index}-${profile}`,profile,argv:['testrun','browser','send',JSON.stringify(request)],expected:change},
          {name:`credential-setting-mcp-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_send',arguments:{targetId:'browser:acme',request},original_input:{}},expected:change},
          {name:`credential-setting-act-${index}-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'act',arguments:{targetId:'browser:acme',actions:[{action:'context_configure',context,setting}]},original_input:{}},expected:'ask'},
        );
      }
      rows.push(
        {name:`proxy-launch-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--context',JSON.stringify({...credentialOptions,proxy:{server:'http://127.0.0.1:8080',username:'Acme proxy',password:'example'}})],expected:'ask'},
        {name:`proxy-launch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'firefox',mode:'headless',context:{proxy:{server:'http://127.0.0.1:8080',bypass:'localhost'}}},original_input:{}},expected:'ask'},
        {name:`proxy-launch-shared-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'webkit',mode:'headed',context:{proxy:{server:'http://127.0.0.1:8080',username:'Acme proxy',password:''}}},original_input:{}},expected:'ask'},
        {name:`client-certificate-launch-cli-${profile}`,profile,argv:['testrun','connect','--engine','firefox','--context',JSON.stringify({viewport:{width:640,height:480},deviceScaleFactor:1,clientCertificates:[{origin:'https://localhost:8081',cert:'QWNtZS1jZXJ0',key:'QWNtZS1rZXk='}]})],expected:'ask'},
        {name:`client-certificate-launch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'firefox',mode:'headless',context:{viewport:{width:640,height:480},deviceScaleFactor:1,clientCertificates:[{origin:'https://localhost:8081',cert:'QWNtZS1jZXJ0',key:'QWNtZS1rZXk='}]}},original_input:{}},expected:'ask'},
        {name:`client-certificate-launch-shared-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'webkit',mode:'headed',context:{viewport:{width:640,height:480},deviceScaleFactor:1,clientCertificates:[{origin:'https://localhost:8081',cert:'QWNtZS1jZXJ0',key:'QWNtZS1rZXk='}]}},original_input:{}},expected:'ask'},
        {name:`credentials-launch-cli-${profile}`,profile,argv:['testrun','connect','--engine','firefox','--context',JSON.stringify(credentialOptions)],expected:'ask'},
        {name:`credentials-launch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'firefox',mode:'headless',context:credentialOptions},original_input:{}},expected:'ask'},
        {name:`credentials-launch-shared-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'firefox',mode:'headless',context:credentialOptions},original_input:{}},expected:'ask'},
        {name:`credentials-native-launch-cli-${profile}`,profile,argv:['testrun','connect','--engine','chrome','--context',JSON.stringify(credentialOptions)],expected:'ask'},
        {name:`credentials-native-launch-mcp-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'browser_connect',arguments:{engine:'chrome',mode:'headless',context:credentialOptions},original_input:{}},expected:'ask'},
        {name:`credentials-native-launch-shared-${profile}`,profile,mcp:headerBinding,input:{kind:'mcp',server:'testrun',tool:'connect',arguments:{engine:'chrome',mode:'headed',context:credentialOptions},original_input:{}},expected:'ask'},
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
    // The evaluator accepts at most 1024 cases per fixture; preserve every case.
    for (let offset=0;offset<rows.length;offset+=1024) {
      const selected=rows.slice(offset,offset+1024),cases=join(dir,`cases-${offset}.json`);
      writeFileSync(cases,JSON.stringify({schema_version:1,cases:selected}));
      const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',new URL('pack.yml',currentDirectory('testrun')).pathname,'--cases',cases],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
      const report=JSON.parse(result.stdout||'{}');
      assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
      assert.equal(report.passed,true);
      assert.equal(report.cases.length,selected.length);
    }
    t.diagnostic(`Evaluated all ${rows.length} independent profile cases in ${Math.ceil(rows.length/1024)} bounded fixtures.`);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

for (const name of Object.keys(currentToolVersions)) {
  test(`${name} current surface reproduces from frozen sources and independent fixtures`,async()=>{
    const pack = await currentToolPack(name);
    const cases = await currentToolCases(name);
    const validate = schemaValidator(schema);
    const fixtures = splitCaseFiles(cases);
    assert.deepEqual(await caseFileNames(currentDirectory(name)),fixtures.map(([file]) => file));
    for (const [file,document] of [['pack.yml',pack],...fixtures]) {
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
  test(`${name} new and retained decisions use the production evaluator`,{skip:!process.env.SHIELD_BINARY},async t=>{
    let total = 0;
    for (const file of await caseFileNames(currentDirectory(name))) {
      const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
        '--pack',new URL('pack.yml',currentDirectory(name)).pathname,
        '--cases',new URL(file,currentDirectory(name)).pathname],
      {encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
      const report = JSON.parse(result.stdout||'{}');
      assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
      assert.equal(report.passed,true);
      assert.equal(report.cases.length,JSON.parse(readFileSync(new URL(file,currentDirectory(name)))).cases.length);
      total += report.cases.length;
    }
    assert.equal(total,(await currentToolCases(name)).cases.length);
    t.diagnostic(`Evaluated all ${total} independent ${name} cases.`);
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
