// Independent reviewed contract for Testrun 0.20.0: every operation is allowed
// unless it names a host file outside the approved roots, or one Shield cannot
// check. Keep these expectations separate from the policy's rule constructors.
// Fixtures run with the registry checkout as project, read and write root:
// relative paths for browser files and inline build files need review because
// Shield cannot observe the directory used to resolve them.
export const trustedExecutables=['testrun','/usr/bin/testrun','/usr/local/bin/testrun','/opt/homebrew/bin/testrun','testrun.exe'];
export function binding(server='testrun') {
  return {[server]:{transport:{type:'defaults',pack:'canonic/testrun',integration:'testrun'},
    agents:{codex:server},packs:{'canonic/testrun':'testrun'}}};
}

const page={connectionId:'11111111-1111-4111-8111-111111111111',generation:'22222222-2222-4222-8222-222222222222',id:'33333333-3333-4333-8333-333333333333'};
const request2='44444444-4444-4444-8444-444444444444';
const inside='acme-fixture.json';
const nested='fixtures/acme/state.json';
const outside='/outside/acme.json';
const escape='../outside/acme.json';
const endpoint='wss://browser.example.com/devtools/browser/fixture';
const activityMonitor={kind:'native_trace',backend:'xctrace',mode:'capture',targetId:'device:ACME',
  appId:'com.example.acme',processId:42,template:'Activity Monitor',allowSystemTrace:true};
const iosDiagnostics={kind:'ios',targetId:'simulator:ACME',appId:'com.example.acme'};

// [tool, arguments, expected for every profile]
export const requests=[
  ['connect',{engine:'chrome',mode:'headless'},'allow'],
  ['browser_connect',{engine:'firefox',mode:'headless',context:{permissions:['clipboard-read']}},'allow'],
  ['act',{targetId:'browser:acme',actions:[{action:'page_navigate',page,navigation:{kind:'goto',url:'http://app.localhost'}},{action:'page_snapshot',page}]},'allow'],
  ['act',{targetId:'browser:acme',actions:[{action:'page_navigate',page,navigation:{kind:'goto',url:'https://example.com'}}]},'allow'],
  ['act',{actions:[{action:'app_launch',appId:'com.example.acme',env:{ACME_TEST_MODE:'1'}}]},'allow'],
  ['browser_send',{request:{operation:'batch',requests:[{operation:'page_navigate',page,navigation:{kind:'goto',url:'http://app.localhost'}},{operation:'page_snapshot',page}]}},'allow'],
  // A script tag file outside the approved roots is read from the host.
  ['browser_send',{request:{operation:'page_add_script_tag',scope:page,path:'/outside/fixture.js'}},'ask'],
  ['browser_send',{request:{operation:'http_fetch',httpContext:page,request:{url:'https://example.com',method:'POST'}}},'allow'],
  // Unreviewed operations have no host-file check: a documented gap.
  ['browser_send',{request:{operation:'future_qa_operation',options:{path:'/outside/fixture',env:{ACME_TEST_MODE:'1'}}}},'allow'],
  ['browser_send',{request:{operation:'context_configure',context:page,setting:{kind:'permissions_grant',origin:'https://example.com',permissions:['camera']}}},'allow'],
  ['build_start',{project:'/outside/qa',inline:{command:'acme-build'},env:{ACME_TEST_MODE:'1'}},'ask'],
  ['app_install',{path:'/outside/app.apk',replace:true},'ask'],
  ['app_uninstall',{appId:'com.example.acme'},'allow'],
  ['diagnostics_export',{path:'/outside/report.json'},'ask'],
  ['diagnostics_remove',{investigationId:'acme'},'allow'],
  ['future_tool',{path:'/outside/qa'},'allow'],
  ['testrun_docs_read',{path:'cli.md'},'allow'],
  ['build_start',{project:'.',inline:{command:'acme-build'},env:{ACME_TEST_MODE:'1'}},'allow'],
  ['app_install',{path:'build/acme.apk',replace:true},'allow'],
  ['diagnostics_export',{path:'reports/acme.json'},'allow'],
];

export function trustedTestrunCases() {
  const cases=[];
  for(const profile of ['loose','recommended','strict']) {
    for(const [index,[tool,args,expected]] of requests.entries()) for(const [variant,arguments_,decision] of [
      ['request',args,expected],['empty',{},'allow'],['malformed',{request:null,actions:'invalid'},'allow'],
    ]) cases.push({name:`trusted-mcp-${index}-${variant}-${profile}`,profile,mcp:binding(),
      input:{kind:'mcp',server:'testrun',tool,arguments:arguments_,original_input:{}},expected:decision});
    cases.push({name:`trusted-server-alias-${profile}`,profile,mcp:binding('qa'),
      input:{kind:'mcp',server:'qa',tool:'connect',arguments:{engine:'webkit'},original_input:{}},expected:'allow'});
    for(const executable of trustedExecutables) for(const [index,[args,expected]] of [
      [['connect','--engine','chrome'],'allow'],[['act','--target','browser:acme',JSON.stringify(requests[2][1].actions)],'allow'],
      [['browser','send',JSON.stringify(requests[5][1].request)],'allow'],[['app','uninstall','com.example.acme'],'allow'],
      [['manager','stop'],'allow'],[['mcp','setup','--yes'],'allow'],
      // An unknown option's value is not a known host file: a documented gap.
      [['future-command','--future-option','/outside/qa'],'allow'],
      [['app','install','/outside/app.apk'],'ask'],[['app','install','build/acme.apk','--replace'],'allow'],
    ].entries()) cases.push({name:`trusted-cli-${cases.length}-${index}-${profile}`,profile,argv:[executable,...args],expected});
    for(const argv of [['acme','connect'],['testrun-other','connect'],['/tmp/forged/testrun','connect'],['./testrun.exe','connect'],
      ['hub','operation','show','acme','--json']]) cases.push({name:`unrelated-${cases.length}-${profile}`,profile,argv,expected:'ask'});
  }
  return cases;
}

function windowsExecutableCases() {
  const executable=String.raw`C:\Program Files\Testrun\testrun.exe`;
  const otherExecutable=String.raw`C:\Other\testrun.exe`;
  const variables={windows_executable:executable};
  const launch=['browser','connect','--engine','chrome','--mode','headless','--disposable-profile'];
  const cases=[];
  for(const profile of ['loose','recommended','strict']) {
    for(const [label,argv,expected,settings] of [
      ['bare',['testrun.exe',...launch],'allow'],
      ['bare-empty-path',['testrun.exe','browser','connect','--engine','chrome','--attachment-ca='],'ask'],
      ['unbound',[executable,...launch],'ask'],
      ['bound',[executable,...launch],'allow',variables],
      ['bound-outside-path',[executable,'browser','fixture-register','/outside/acme.png'],'ask',variables],
      ['bound-inside-path',[executable,'browser','fixture-register','fixtures/acme.png'],'allow',variables],
      ['bound-json-path',[executable,'browser','send','{"operation":"har_register","path":"/outside/acme.har"}'],'ask',variables],
      ['other-path',[otherExecutable,...launch],'ask',variables],
    ]) cases.push({name:`windows-cli-${label}-${profile}`,profile,argv,expected,
      ...(settings ? {variables:settings} : {})});
    const mcp=binding('qa');
    mcp.qa.transport={type:'stdio',command:'testrun.exe',args:['mcp','serve'],env:{}};
    for(const [label,tool,arguments_,expected] of [
      ['connect','browser_connect',{engine:'chrome',mode:'headless',profile:{kind:'disposable'}},'allow'],
      ['outside-export','browser_send',{targetId:'browser:acme',
        request:{operation:'har_capture_start',context:page,path:'/outside/acme.har'}},'ask'],
      ['future','future_tool',{},'allow'],
    ]) cases.push({name:`windows-mcp-${label}-${profile}`,profile,mcp,
      input:{kind:'mcp',server:'qa',tool,arguments:arguments_,original_input:{}},expected});
  }
  return cases;
}

function homeInstallCases() {
  const cases=[];
  const investigationId='diag-11111111111111111111111111111111';
  const analysisId='analysis-33333333333333333333333333333333';
  for(const [host,executable] of [
    ['macos','/Users/acme/.local/bin/testrun'],
    ['linux','/home/acme/.local/bin/testrun'],
  ]) for(const profile of ['loose','recommended','strict']) {
    for(const [label,args,expected] of [
      ['setup-yes',['mcp','setup','--scope','user','--agent','codex','--yes'],'allow'],
      ['setup-picker',['mcp','setup','--agent','codex','--tool-permissions'],'allow'],
      ['app-in-root',['app','install','fixtures/acme.apk'],'allow'],
      ['app-outside',['app','install','/outside/acme.apk'],'ask'],
      ['export-in-root',['diagnostics','export',investigationId,analysisId,'--path','reports/acme.json'],'allow'],
      ['export-outside',['diagnostics','export',investigationId,analysisId,'--path','/outside/acme.json'],'ask'],
    ]) cases.push({name:`home-cli-${host}-${label}-${profile}`,profile,argv:[executable,...args],expected});
    cases.push({name:`home-cli-other-executable-${host}-${profile}`,profile,
      argv:[`${executable}.sh`,'mcp','serve'],expected:'ask'});

    const mcp=binding('qa');
    mcp.qa.transport={type:'stdio',command:executable,args:['mcp','serve'],env:{}};
    for(const [label,tool,arguments_,expected] of [
      ['docs','docs_read',{path:'cli.md'},'allow'],
      ['retained-docs','testrun_docs_read',{path:'cli.md'},'allow'],
      ['future','future_tool',{},'allow'],
      ['app-in-root','app_install',{path:'fixtures/acme.apk'},'allow'],
      ['app-outside','app_install',{path:'/outside/acme.apk'},'ask'],
      ['export-in-root','diagnostics_export',{investigationId,analysisId,path:'reports/acme.json'},'allow'],
      ['export-outside','diagnostics_export',{investigationId,analysisId,path:'/outside/acme.json'},'ask'],
    ]) cases.push({name:`home-mcp-${host}-${label}-${profile}`,profile,mcp,
      input:{kind:'mcp',server:'qa',tool,arguments:arguments_,original_input:{}},expected});
  }
  return cases;
}

// One browser request per reviewed host-file field; `at` places the path.
const browserFieldRequests=[
  ['storage-register','storage_register',path=>({path})],
  ['har-register','har_register',path=>({path})],
  ['heap-import','heap_import',path=>({developer:page,path})],
  ['script-tag','page_add_script_tag',path=>({scope:page,path})],
  ['style-tag','page_add_style_tag',path=>({scope:page,path})],
  ['route-fulfill','callback_resolve',path=>({callback:page,response:{kind:'route_fulfill',path}})],
  ['context-state','context_create',path=>({options:{storageState:path}})],
  ['http-state','http_context_create',path=>({options:{storageState:path}})],
  ['har-archive','har_capture_start',path=>({context:page,path,mode:'full'})],
  ['har-resources','har_capture_start',path=>({context:page,path:'acme.har',content:'attach',resourcesDir:path})],
  ['trace-stop','trace_stop',path=>({filePath:path})],
  ['trace-start','trace_start',path=>({context:page,options:{filePath:path}})],
  ['trace-sources','trace_start',path=>({context:page,options:{sources:true,sourceFiles:['src/acme.js',path]}})],
  ['trace-source-last','trace_start',path=>({context:page,options:{sources:true,sourceFiles:[...Array.from({length:3},(_,i)=>`src/acme-${i}.js`),path]}})],
  ['storage-export','storage_export',path=>({context:page,options:{path,indexedDB:false}})],
  ['http-state-export','http_context_storage_state',path=>({httpContext:page,options:{path}})],
  ['record-har','context_create',path=>({options:{recordHar:{path}}})],
  ['screenshot','page_screenshot',outputPath=>({page,capture:{outputPath}})],
  ['certificate','context_create',path=>({options:{clientCertificates:[{origin:'https://example.com',certPath:path,keyPath:'certs/acme-key.pem'}]}})],
  ['certificate-key','http_context_create',path=>({options:{clientCertificates:[{origin:'https://example.com',certPath:'certs/acme.pem',keyPath:path}]}})],
  ['certificate-pfx-last','context_create',path=>({options:{clientCertificates:[{origin:'https://example.com',cert:'QUNNRQ=='},{origin:'https://example.com',pfxPath:path}]}})],
  ['multipart','http_fetch',path=>({httpContext:page,request:{url:'https://example.com/upload',method:'POST',body:{kind:'multipart',fields:[{kind:'text',name:'note',value:'acme'},{kind:'file_path',name:'upload',path}]}}})],
  ['multipart-last','http_fetch',path=>({httpContext:page,request:{url:'https://example.com/upload',method:'POST',body:{kind:'multipart',fields:[...Array.from({length:7},(_,i)=>({kind:'text',name:`n${i}`,value:'acme'})),{kind:'file_path',name:'upload',path}]}}})],
  ['multipart-replay','http_fetch_request',path=>({httpContext:page,sourceRequestId:request2,options:{body:{kind:'multipart',fields:[{kind:'file_path',name:'upload',path}]}}})],
];
const locations=[['inside',inside,'allow'],['nested',nested,'allow'],['outside',outside,'ask'],['escape',escape,'ask'],['empty','','ask']];
const snapshot={action:'page_snapshot',page};

function browserHostFileCases() {
  const rows=[];
  for(const [label,operation,build] of browserFieldRequests) {
    for(const [where,path] of locations)
      rows.push([`send-${label}-${where}`,'browser_send',{targetId:'browser:acme',request:{operation,...build(path)}},'ask']);
    for(const [where,path] of [locations[0],locations[2]]) {
      const entry={operation,...build(path)};
      rows.push([`batch-first-${label}-${where}`,'browser_send',{targetId:'browser:acme',request:{operation:'batch',requests:[entry,{operation:'page_snapshot',page}]}},'ask']);
      rows.push([`batch-last-${label}-${where}`,'browser_send',{targetId:'browser:acme',request:{operation:'batch',
        requests:[...Array.from({length:7},()=>({operation:'page_snapshot',page})),entry]}},'ask']);
      const action={action:operation,...build(path)};
      rows.push([`act-first-${label}-${where}`,'act',{targetId:'browser:acme',actions:[action,snapshot]},'ask']);
      rows.push([`act-last-${label}-${where}`,'act',{targetId:'browser:acme',actions:[...Array.from({length:7},()=>snapshot),action]},'ask']);
    }
  }
  return rows;
}

// Values that are not host files, and arrays longer than the pack checks.
function browserFormCases() {
  const send=request=>({targetId:'browser:acme',request});
  const state={cookies:[{name:'session',value:'acme',domain:'example.com',path:'/',expires:-1,httpOnly:true,secure:true,sameSite:'Lax'}],origins:[{origin:'https://example.com',localStorage:[{name:'theme',value:'dark'}]}]};
  return [
    ...['connect','browser_connect'].flatMap(tool => [
      ['borrowed-relative',{profile:{kind:'borrowed',path:'fixtures/profile'}},'ask'],
      ['borrowed-outside',{profile:{kind:'borrowed',path:'/outside/profile'}},'ask'],
      ['borrowed-empty',{profile:{kind:'borrowed',path:''}},'ask'],
      ['retained-channel',{channel:'msedge',profile:{kind:'retained',name:'acme-qa'}},'allow'],
      ['disposable',{profile:{kind:'disposable'}},'allow'],
      ['attachment-relative',{attachment:{endpoint,credentialPath:inside,caPath:'fixtures/ca.pem'}},'ask'],
      ['attachment-credential-outside',{attachment:{endpoint,credentialPath:outside,caPath:'fixtures/ca.pem'}},'ask'],
      ['attachment-ca-outside',{attachment:{endpoint,credentialPath:inside,caPath:escape}},'ask'],
      ['attachment-ca-empty',{attachment:{endpoint,caPath:''}},'ask'],
    ].map(([label,selection,decision])=>[`${tool}-${label}`,tool,{engine:'chrome',...selection},decision])),
    ['inline-context-state','browser_send',send({operation:'context_create',options:{storageState:state}}),'allow'],
    ['inline-http-state','browser_send',send({operation:'http_context_create',options:{storageState:state}}),'allow'],
    ['null-http-state','browser_send',send({operation:'http_context_create',options:{storageState:null}}),'allow'],
    ['empty-inline-http-state','browser_send',send({operation:'http_context_create',options:{storageState:{}}}),'allow'],
    ['inline-connect-state','browser_connect',{engine:'chrome',mode:'headless',context:{storageState:state}},'allow'],
    ['inline-shared-connect-state','connect',{engine:'firefox',context:{storageState:state}},'allow'],
    ...['connect','browser_connect'].flatMap(tool => [
      ['both-relative',{microphonePath:'fixtures/acme.wav',cameraPath:'fixtures/acme.y4m'},'ask'],
      ['microphone-outside',{microphonePath:'/outside/acme.wav',cameraPath:'fixtures/acme.y4m'},'ask'],
      ['camera-outside',{microphonePath:'fixtures/acme.wav',cameraPath:'../outside/acme.y4m'},'ask'],
      ['empty-path',{microphonePath:''},'ask'],
      ['malformed-path',{cameraPath:42},'allow'],
    ].map(([label,mediaFixtures,decision])=>[`${tool}-media-${label}`,tool,{engine:'chrome',mediaFixtures},decision])),
    ['har-without-file','browser_send',send({operation:'har_capture_start',context:page,path:null,resourcesDir:null}),'allow'],
    ['trace-stop-without-file','browser_send',send({operation:'trace_stop',filePath:null}),'allow'],
    ['screenshot-default','browser_send',send({operation:'page_screenshot',page,capture:{fullPage:true}}),'allow'],
    ['observe-screenshot-default','observe',{targetId:'browser:acme',page},'allow'],
    ...locations.map(([where,outputPath])=>['observe-screenshot-'+where,'observe',{targetId:'browser:acme',page,capture:{outputPath}},'ask']),
    ['numeric-path','browser_send',send({operation:'storage_export',context:page,options:{path:42}}),'allow'],
    ['inline-certificates','browser_send',send({operation:'context_create',options:{clientCertificates:Array.from({length:2},()=>({origin:'https://example.com',cert:'QUNNRQ==',key:'QUNNRQ=='}))}}),'allow'],
    ['certificate-overflow','browser_send',send({operation:'context_create',options:{clientCertificates:Array.from({length:3},()=>({origin:'https://example.com',cert:'QUNNRQ=='}))}}),'ask'],
    ['connect-certificate-overflow','browser_connect',{engine:'chrome',context:{clientCertificates:Array.from({length:3},()=>({origin:'https://example.com',cert:'QUNNRQ=='}))}},'ask'],
    ['trace-sources-four','browser_send',send({operation:'trace_start',context:page,options:{sources:true,sourceFiles:Array.from({length:4},(_,i)=>`src/acme-${i}.js`)}}),'ask'],
    ['trace-sources-overflow','browser_send',send({operation:'trace_start',context:page,options:{sources:true,sourceFiles:Array.from({length:5},(_,i)=>`src/acme-${i}.js`)}}),'ask'],
    ['multipart-text-eight','browser_send',send({operation:'http_fetch',httpContext:page,request:{url:'https://example.com',method:'POST',body:{kind:'multipart',fields:Array.from({length:8},(_,i)=>({kind:'text',name:`n${i}`,value:'acme'}))}}}),'allow'],
    ['multipart-text-nine','browser_send',send({operation:'http_fetch',httpContext:page,request:{url:'https://example.com',method:'POST',body:{kind:'multipart',fields:Array.from({length:9},(_,i)=>({kind:'text',name:`n${i}`,value:'acme'}))}}}),'allow'],
    ['multipart-text-nine-act','act',{targetId:'browser:acme',actions:[{action:'http_fetch',httpContext:page,request:{url:'https://example.com',method:'POST',body:{kind:'multipart',fields:Array.from({length:9},(_,i)=>({kind:'text',name:`n${i}`,value:'acme'}))}}}]},'allow'],
    // Same field names that are not host files in these operations.
    ['cookie-filter-path','browser_send',send({operation:'context_cookies_clear',context:page,options:{name:'session',path:'/'}}),'allow'],
    ['directory-entry-path','browser_send',send({operation:'directory_register',name:'uploads',entries:[{path:'/outside/upload.png',fixture:page}]}),'allow'],
    ['debugger-location','browser_send',send({operation:'trace_group_start',name:'checkout',location:{file:'/outside/app.js',line:1}}),'allow'],
    ['batch-entry-nine','browser_send',send({operation:'batch',requests:[...Array.from({length:8},()=>({operation:'page_snapshot',page})),{operation:'storage_export',context:page,options:{path:outside}}]}),'allow'],
  ];
}

// Testrun 0.9.0 browser storage operations change only Testrun-owned state.
function storageOperationCases() {
  const send=(request,engine='chrome')=>({targetId:`browser:${engine}`,request});
  const rows=[
    ['cookies-read',{operation:'context_cookies_read',context:page,urls:['https://example.com'],limit:50}],
    ['cookies-read-page',{operation:'context_cookies_read',context:page,cursor:'opaque',limit:10}],
    ['cookies-add',{operation:'context_cookies_add',context:page,cookies:[{name:'session',value:'acme',url:'https://example.com'}]}],
    ['cookies-clear',{operation:'context_cookies_clear',context:page}],
    ['cookies-clear-filter',{operation:'context_cookies_clear',context:page,options:{name:'session',domain:'example.com',path:'/'}}],
    ['web-storage-read',{operation:'page_web_storage_read',page,kind:'local',limit:50}],
    ['web-storage-read-name',{operation:'page_web_storage_read',page,kind:'session',name:'token',cursor:'opaque',limit:10}],
    ['web-storage-set',{operation:'page_web_storage_update',page,kind:'local',update:{kind:'setItem',name:'theme',value:'dark'}}],
    ['web-storage-remove',{operation:'page_web_storage_update',page,kind:'session',update:{kind:'removeItem',name:'token'}}],
    ['web-storage-clear',{operation:'page_web_storage_update',page,kind:'local',update:{kind:'clear'}}],
    ['cache-read',{operation:'context_cache_storage_read',context:page,origin:'https://example.com'}],
    ['cache-read-entry',{operation:'context_cache_storage_read',context:page,origin:'https://example.com',cacheName:'v1',url:'https://example.com/app.js',cursor:'opaque',limit:10}],
    ['cache-delete',{operation:'context_cache_storage_delete',context:page,origin:'https://example.com',cacheName:'v1'}],
    ['cache-delete-entry',{operation:'context_cache_storage_delete',context:page,origin:'https://example.com',cacheName:'v1',url:'https://example.com/app.js'}],
    ['snapshot-register-inside',{operation:'storage_register',path:inside},'ask'],
    ['snapshot-export',{operation:'storage_export',context:page}],
    ['snapshot-export-options',{operation:'storage_export',context:page,options:{indexedDB:false,opfs:false}}],
    ['snapshot-export-file',{operation:'storage_export',context:page,options:{path:nested}},'ask'],
    ['snapshot-apply-replace',{operation:'storage_apply',context:page,snapshot:page,mode:'replace'}],
    ['snapshot-apply-merge',{operation:'storage_apply',context:page,snapshot:page,mode:'merge'}],
    // Retained form for Testrun 0.8.0 and earlier: boolean replace instead of mode.
    ['snapshot-apply-retired-replace',{operation:'storage_apply',context:page,snapshot:page,replace:true}],
    ['snapshot-apply-retired-merge',{operation:'storage_apply',context:page,snapshot:page,replace:false}],
    ['snapshot-forget',{operation:'storage_forget',snapshot:page}],
    ['context-state-file',{operation:'context_create',options:{storageState:inside}},'ask'],
    ['http-context-state-file',{operation:'http_context_create',options:{storageState:nested}},'ask'],
  ];
  return [
    ...rows.flatMap(([label,request,decision='allow'])=>['chrome','firefox'].map(engine=>[`storage-${label}-${engine}`,'browser_send',send(request,engine),decision])),
    ...rows.map(([label,{operation,...request},decision='allow'])=>[`storage-${label}-act`,'act',{targetId:'browser:chrome',actions:[{action:operation,...request}]},decision]),
    ['storage-batch','browser_send',send({operation:'batch',requests:rows.slice(0,8).map(([,request])=>request)}),'allow'],
    ['storage-register-outside','browser_send',send({operation:'storage_register',path:'/outside/state.json'}),'ask'],
    ['storage-export-outside','browser_send',send({operation:'storage_export',context:page,options:{path:'/outside/state.json'}}),'ask'],
    ['storage-export-outside-act','act',{targetId:'browser:chrome',actions:[{action:'storage_export',context:page,options:{path:'/outside/state.json'}}]},'ask'],
    ['storage-apply-retired-with-export','browser_send',send({operation:'batch',requests:[{operation:'storage_apply',context:page,snapshot:page,replace:true},{operation:'storage_export',context:page,options:{path:escape}}]}),'ask'],
    ['context-state-outside','browser_send',send({operation:'context_create',options:{storageState:'/outside/state.json'}}),'ask'],
    ['http-context-state-outside','browser_send',send({operation:'http_context_create',options:{storageState:escape}}),'ask'],
    ['connect-state-file','browser_connect',{engine:'chrome',mode:'headless',context:{storageState:inside}},'ask'],
    ['connect-state-outside','browser_connect',{engine:'chrome',mode:'headless',context:{storageState:'/outside/state.json'}},'ask'],
    ['connect-state-empty','browser_connect',{engine:'chrome',context:{storageState:''}},'ask'],
    ['shared-connect-state-file','connect',{engine:'webkit',context:{storageState:nested}},'ask'],
    ['shared-connect-state-outside','connect',{engine:'webkit',context:{storageState:escape}},'ask'],
    ['connect-record-har-outside','browser_connect',{engine:'firefox',context:{recordHar:{path:'/outside/acme.har'}}},'ask'],
    ['connect-record-har-inside','connect',{engine:'firefox',context:{recordHar:{path:'acme.har'}}},'ask'],
    ['connect-certificate-outside','browser_connect',{engine:'chrome',context:{clientCertificates:[{origin:'https://example.com',certPath:'/outside/acme.pem',keyPath:'acme-key.pem'}]}},'ask'],
    ['shared-connect-certificate-last-outside','connect',{engine:'chrome',context:{clientCertificates:[{origin:'https://example.com',cert:'QUNNRQ=='},{origin:'https://example.com',pfxPath:escape}]}},'ask'],
    ['connect-certificate-inside','connect',{engine:'chrome',context:{clientCertificates:[{origin:'https://example.com',pfxPath:'certs/acme.p12',passphrase:'acme'}]}},'ask'],
  ];
}

// Non-browser host files: installation, diagnostics and project configuration.
function toolHostFileCases() {
  const investigation='diag-11111111111111111111111111111111';
  const analysis='analysis-33333333333333333333333333333333';
  const start=source=>({investigationId:investigation,submissionId:'acme',source});
  const sources={
    import:path=>({kind:'import',path,format:'bytes'}),
    ios:path=>({kind:'ios',targetId:'simulator:ACME',appId:'com.example.acme',reportDirectory:path}),
    dart:path=>({kind:'dart',endpointFile:path,targetId:'android:ACME',appId:'com.example.acme',runtimeKind:'flutter_native'}),
    box:path=>({kind:'box_logs',targetId:'service:Acme:api',serviceId:'api',project:path,workspace:'acme#feature',operationId:'node-1',stream:'stderr'}),
    observability:path=>({kind:'observability_http',configFile:path,sourceId:'incident',scope:{account:'acme'},window:{from:'2026-01-01T00:00:00Z',to:'2026-01-01T00:01:00Z'}}),
    'native-import':path=>({kind:'native_trace',backend:'perfetto',mode:'import',targetId:'android:ACME',appId:'com.example.acme',path}),
    'native-tool':path=>({kind:'native_trace',backend:'perfetto',mode:'capture',targetId:'android:ACME',appId:'com.example.acme',toolPath:path}),
  };
  const rows=[
    ['install-artifact','app_install',{artifactRef:'build-11111111111111111111111111111111'},'allow'],
    ['diagnostics-browser-result','diagnostics_start',start({kind:'browser_operation',targetId:'browser:acme',operationId:request2,
      request:{operation:'storage_export',context:page,options:{path:outside}}}),'allow'],
    ['diagnostics-android','diagnostics_start',start({kind:'android',targetId:'android:ACME',appId:'com.example.acme',userId:0}),'allow'],
    ['diagnostics-ios-default-device-set','diagnostics_start',start(iosDiagnostics),'allow'],
    ['diagnostics-ios-relative-device-set','diagnostics_start',start({...iosDiagnostics,deviceSet:'fixtures/simulators'}),'ask'],
    ['diagnostics-ios-outside-device-set','diagnostics_start',start({...iosDiagnostics,deviceSet:'/outside/simulators'}),'ask'],
    ['diagnostics-ios-empty-device-set','diagnostics_start',start({...iosDiagnostics,deviceSet:''}),'ask'],
    ['diagnostics-ios-cpu','diagnostics_start',start(activityMonitor),'allow'],
    ['diagnostics-ios-cpu-outside-import','diagnostics_start',
      start({...activityMonitor,mode:'import',path:'/outside/acme.trace'}),'ask'],
    ['diagnostics-ios-cpu-outside-tool','diagnostics_start',
      start({...activityMonitor,toolPath:'/outside/xctrace'}),'ask'],
    ['diagnostics-ios-cpu-empty-tool','diagnostics_start',start({...activityMonitor,toolPath:''}),'ask'],
    ['project-show-name','project_show',{root:'.',project:'mobile'},'allow'],
    ['project-show-escape','project_show',{root:'.',project:'../mobile'},'ask'],
    ['discover-eight','project_discover',{root:'.',paths:Array.from({length:8},(_,i)=>`apps/a${i}`)},'allow'],
    ['discover-overflow','project_discover',{root:'.',paths:Array.from({length:9},(_,i)=>`apps/a${i}`)},'ask'],
    ['init-overflow','project_init',{root:'.',planDigest:'1'.repeat(64),projects:Array.from({length:9},(_,i)=>({path:`apps/a${i}`}))},'ask'],
    ['init-preview-overflow','project_init_preview',{root:'.',projects:Array.from({length:9},(_,i)=>({path:`apps/a${i}`}))},'ask'],
    ['init-preview-retained-digest','project_init_preview',{root:'.',planDigest:'1'.repeat(64)},'allow'],
    ['init-preview-retained-digest-outside','project_init_preview',{root:'/outside/acme',planDigest:'1'.repeat(64)},'ask'],
    ['build-inline-glob','build_start',{project:'.',inline:{builder:'custom',artifact:{glob:'/outside/*.apk'}}},'ask'],
    ['build-inline-workspace','build_start',{project:'.',inline:{builder:'xcode',xcode:{workspace:'/outside/Acme.xcworkspace'}}},'ask'],
    ['docs-path','docs_read',{path:'/outside/private.txt'},'allow'],
  ];
  for(const [where,path,expected] of locations) {
    rows.push([`install-${where}`,'app_install',{path},expected],
      [`export-${where}`,'diagnostics_export',{investigationId:investigation,analysisId:analysis,path},expected]);
    for(const [kind,source] of Object.entries(sources))
      rows.push([`diagnostics-${kind}-${where}`,'diagnostics_start',start(source(path)),expected]);
    for(const tool of ['config_check','config_show','config_schema','config_init','project_list','project_status',
      'project_start','project_open','project_discover','project_init_preview','build_start'])
      rows.push([`${tool}-root-${where}`,tool,{root:path,profile:'dev'},expected],
        [`${tool}-config-${where}`,tool,{root:'.',config:path},expected]);
    for(const tool of ['config_check','config_init','project_status','project_start','project_open','build_start'])
      rows.push([`${tool}-project-${where}`,tool,{project:path,profile:'dev'},expected]);
    rows.push([`project-init-root-${where}`,'project_init',{root:path,planDigest:'1'.repeat(64)},expected],
      [`project-init-config-${where}`,'project_init',{root:'.',config:path,planDigest:'1'.repeat(64)},expected],
      [`project-init-path-${where}`,'project_init',{root:'.',planDigest:'1'.repeat(64),projects:[{path:'web'},{path}]},expected],
      [`project-init-preview-last-${where}`,'project_init_preview',{root:'.',projects:[...Array.from({length:7},(_,i)=>({path:`apps/a${i}`})),{path}]},expected],
      [`project-discover-path-${where}`,'project_discover',{root:'.',paths:[path]},expected],
      [`build-artifact-${where}`,'build_start',{project:'.',inline:{builder:'custom',artifact:{path}}},'ask'],
      [`build-xcode-project-${where}`,'build_start',{project:'.',inline:{builder:'xcode',xcode:{project:path,scheme:'Acme'}}},'ask']);
  }
  return rows;
}

// CLI arguments: explicit path options are checked; JSON payloads are opaque.
function cliHostFileCases() {
  const investigation='diag-11111111111111111111111111111111';
  const analysis='analysis-33333333333333333333333333333333';
  const rows=[
    ['act-json-path',['act','--target','browser:acme',JSON.stringify([{action:'storage_export',context:page,options:{path:inside}}])],'ask'],
    ['send-json-path',['browser','send',JSON.stringify({operation:'storage_register',path:inside})],'ask'],
    ['send-json-screenshot',['browser','send',JSON.stringify({operation:'page_screenshot',page,capture:{outputPath:inside}})],'ask'],
    ['act-json-screenshot',['act','--target','browser:acme',JSON.stringify([{action:'page_screenshot',page,capture:{outputPath:outside}}])],'ask'],
    ['send-json-screenshot-default',['browser','send',JSON.stringify({operation:'page_screenshot',page,capture:{fullPage:true}})],'allow'],
    ['send-json-spaced-path',['browser','send','{"operation": "trace_stop", "filePath" : "trace.json"}'],'ask'],
    ['send-json-escape',['browser','send','{"operation":"storage_register","p\\u0061th":"acme.json"}'],'ask'],
    ['send-json-storage',['browser','send',JSON.stringify({operation:'context_cookies_read',context:page,limit:10})],'allow'],
    ['send-json-virtual-directory',['browser','send',JSON.stringify({operation:'directory_register',name:'uploads',entries:[{path:'uploads/acme.png',fixture:page}]})],'allow'],
    ['send-json-multipart-file',['browser','send',JSON.stringify({operation:'http_fetch',httpContext:page,
      request:{url:'https://example.com/upload',method:'POST',body:{kind:'multipart',fields:[{kind:'file_path',name:'upload',path:outside}]}}})],'ask'],
    ['send-json-path-before-operation',['browser','send',JSON.stringify({path:inside,operation:'storage_register'})],'ask'],
    ['inline-glob',['build','start','--inline',JSON.stringify({builder:'custom',artifact:{glob:'/outside/*.apk'}})],'ask'],
    ['inline-workspace',['build','start','--inline',JSON.stringify({builder:'xcode',
      xcode:{build_settings:{ACME:'yes'},workspace:'/outside/Acme.xcworkspace'}})],'ask'],
    ['send-json-inline-state',['browser','send',JSON.stringify({operation:'context_create',options:{storageState:{cookies:[],origins:[]}}})],'allow'],
    ['send-json-sources',['browser','send',JSON.stringify({operation:'trace_start',context:page,options:{sources:true,sourceFiles:['src/acme.js']}})],'ask'],
    ['connect-context-state',['connect','--engine','chrome','--context',JSON.stringify({storageState:inside})],'ask'],
    ['connect-context-attached',['connect','--engine','chrome',`--context=${JSON.stringify({recordHar:{path:'acme.har'}})}`],'ask'],
    ['connect-context-plain',['connect','--engine','chrome','--context',JSON.stringify({viewport:{width:640,height:480}})],'allow'],
    ...[['connect'],['browser','connect']].flatMap(command => [
      ['both-inside',['--microphone-fixture','fixtures/acme speech.wav','--camera-fixture=fixtures/acme.y4m'],'allow'],
      ['microphone-outside',['--camera-fixture','fixtures/acme.y4m','--microphone-fixture=/outside/acme.wav'],'ask'],
      ['camera-outside',['--microphone-fixture=fixtures/acme.wav','--camera-fixture','../outside/acme.y4m'],'ask'],
      ['empty-path',['--microphone-fixture='],'ask'],
    ].map(([label,options,decision])=>[`${command.join('-')}-media-${label}`,
      ['--json',...command,'--engine=chrome','--mode','headed',...options],decision])),
    ...[['connect'],['browser','connect']].flatMap(command => [
      ['borrowed-inside',['--channel','chrome','--borrowed-profile','fixtures/profile'],'allow'],
      ['borrowed-outside',['--channel=msedge','--borrowed-profile=/outside/profile'],'ask'],
      ['retained',['--channel','msedge','--profile','acme-qa'],'allow'],
      ['disposable',['--disposable-profile'],'allow'],
      ['attachment-inside',['--attach',endpoint,'--attachment-credential',inside,'--attachment-ca=fixtures/ca.pem'],'allow'],
      ['attachment-credential-outside',[`--attach=${endpoint}`,'--attachment-ca','fixtures/ca.pem',`--attachment-credential=${outside}`],'ask'],
      ['attachment-ca-outside',['--attach',endpoint,'--attachment-credential',inside,'--attachment-ca',escape],'ask'],
      ['attachment-ca-empty',['--attach',endpoint,'--attachment-ca='],'ask'],
    ].map(([label,options,decision])=>[`${command.join('-')}-${label}`,
      ['--json',...command,'--engine=chrome','--mode','headed',...options],decision])),
    ['diagnostics-source-path',['diagnostics','start',investigation,'--submission-id','acme','--source',JSON.stringify({kind:'import',path:inside,format:'bytes'})],'ask'],
    ['diagnostics-source-android',['diagnostics','start',investigation,'--submission-id','acme','--source',JSON.stringify({kind:'android',targetId:'android:ACME',appId:'com.example.acme',userId:0})],'allow'],
    ['diagnostics-ios-device-set-default',['diagnostics','start',investigation,'--submission-id','acme','--source',
      JSON.stringify(iosDiagnostics)],'allow'],
    ['diagnostics-ios-device-set-opaque',['--json','diagnostics','start',investigation,'--submission-id','acme',
      `--source=${JSON.stringify({deviceSet:'/outside/simulators',...iosDiagnostics})}`],'ask'],
    ['diagnostics-ios-device-set-opaque-relative',['diagnostics','start',investigation,'--submission-id','acme','--source',
      JSON.stringify({...iosDiagnostics,deviceSet:'fixtures/simulators'})],'ask'],
    ['diagnostics-ios-cpu',['diagnostics','start',investigation,'--submission-id','acme','--source',JSON.stringify(activityMonitor)],'allow'],
    ['diagnostics-ios-cpu-import',['diagnostics','start',investigation,'--submission-id','acme','--source',
      JSON.stringify({...activityMonitor,mode:'import',path:'/outside/acme.trace'})],'ask'],
    ['build-inline-artifact',['build','start','--inline',JSON.stringify({builder:'custom',artifact:{path:'build/acme.apk'}})],'ask'],
    ['install-attached-replace',['app','install','--replace','build/acme.apk'],'allow'],
    ['install-leading-target',['--target','android:ACME','app','install','/outside/acme.apk'],'ask'],
    ['install-escape',['app','install','../outside/acme.apk','--play-protect','send'],'ask'],
    ['install-artifact',['app','install','--artifact-ref','build-11111111111111111111111111111111'],'allow'],
    ['fixture-inside',['browser','fixture-register','fixtures/acme.png','--mime-type','image/png','--provenance','synthetic_generated','--cleared-by','acme','--clearance-method','review'],'allow'],
    ['fixture-outside',['browser','fixture-register','/outside/acme.png','--mime-type','image/png','--provenance','synthetic_generated','--cleared-by','acme','--clearance-method','review'],'ask'],
    ['export-inside',['diagnostics','export',investigation,analysis,'--path','reports/acme.json'],'allow'],
    ['export-attached-outside',['diagnostics','export',investigation,analysis,'--path=/outside/acme.json'],'ask'],
    ['export-escape',['diagnostics','export',investigation,analysis,'--path','../outside/acme.json','--json'],'ask'],
    ['config-root-inside',['config','check','--root','.'],'allow'],
    ['config-init-project-outside',['config','--project','/outside/acme','init'],'ask'],
    ['config-init-inside',['config','init','--config','testrun.yml'],'allow'],
    ['project-path-outside',['project','discover','--root','.','--path','../outside'],'ask'],
    ['project-status-inside',['project','status','ios-dev','--project','.'],'allow'],
    ['build-project-outside',['build','start','dev','--project','/outside/acme'],'ask'],
    ['build-config-outside',['build','start','dev','--config','/outside/testrun.yml'],'ask'],
    ['build-root-inside',['build','start','dev','--app','mobile','--root','.'],'allow'],
    ['init-root-outside',['init','--root','/outside/acme','--yes'],'ask'],
    ['init-path-inside',['init','--path','apps/web','--yes'],'allow'],
    ['init-preview-inside',['init','--dry-run','--root','.','--path','apps/web'],'allow'],
    ['init-preview-outside',['init','--dry-run','--config','/outside/testrun.yml'],'ask'],
    ['docs-host-path',['docs','read','/outside/private.txt'],'allow'],
  ];
  return rows;
}

// Independent expectation for retained historical inputs: a known host-file
// key whose value is absolute, escapes with `..`, or is empty asks; CLI JSON
// that names such a key asks. Everything else is allowed.
const hostKeys=new Set(['path','filePath','resourcesDir','storageState','certPath','keyPath','pfxPath','reportDirectory',
  'endpointFile','configFile','toolPath','sourceFiles','paths']);
const configurationTools=new Set(['config_init','config_check','config_show','config_schema','build_start','project_list',
  'project_show','project_status','project_start','project_open','project_discover','project_init','project_init_preview']);
const knownTools=new Set([...configurationTools,'app_install','diagnostics_export','diagnostics_start','browser_send','act','browser_connect','connect']);
const escapes=value=>value==='' || value.startsWith('/') || value.startsWith('~') || value==='..' || value.startsWith('../') || value.includes('/../');
// Browser operations reviewed as reading or writing host files.
const hostFileOperations=new Set(['storage_register','har_register','heap_import','page_add_script_tag','page_add_style_tag',
  'callback_resolve','context_create','http_context_create','har_capture_start','trace_start','trace_stop','storage_export',
  'http_context_storage_state','http_fetch','http_fetch_request']);
function mcpAsks(tool,args) {
  if(!knownTools.has(tool) || args===null || typeof args!=='object') return false;
  const browser=['browser_send','act'].includes(tool);
  let asks=false;
  const visit=(value,key,parent,operation)=>{
    if(Array.isArray(value)) return value.forEach(item=>visit(item,key,parent,operation));
    if(value && typeof value==='object') {
      // A browser_operation source names an earlier request; it is not re-run.
      if(value.kind==='browser_operation') return;
      const named=value.operation ?? value.action;
      const next=typeof named==='string' && named!=='batch' ? named : operation;
      for(const [name,child] of Object.entries(value)) visit(child,name,value,next);
      return;
    }
    if(typeof value!=='string') return;
    const host=hostKeys.has(key) && (!browser || hostFileOperations.has(operation))
      || ['root','config','project'].includes(key) && parent===args && configurationTools.has(tool)
      || key==='project' && parent?.kind==='box_logs';
    if(host && (escapes(value) || browser || ['connect','browser_connect'].includes(tool)
      || tool==='build_start' && parent!==args && ['path','project'].includes(key))) asks=true;
  };
  visit(args,undefined,undefined,undefined);
  return asks;
}
const jsonHostKey=/"(path|filePath|resourcesDir|storageState|certPath|keyPath|pfxPath|reportDirectory|endpointFile|configFile|toolPath|project)"\s*:\s*"|"sourceFiles"\s*:\s*\[\s*"|\\u/;
function cliAsks(args) {
  if(args.some(arg=>jsonHostKey.test(arg))) return true;
  const words=args.filter((arg,index)=>!arg.startsWith('-') && !['--target','--root','--project','--config','--path'].includes(args[index-1]));
  const command=words[0];
  for(const [index,arg] of args.entries()) {
    const [option,attached]=arg.split(/=(.*)/s);
    if(!['--root','--project','--config','--path'].includes(option)) continue;
    const value=attached ?? args[index+1];
    if(['config','project','init','build'].includes(command) || command==='diagnostics' && option==='--path')
      if(value!==undefined && escapes(value)) return true;
  }
  if(command==='app' && words[1]==='install' || command==='browser' && words[1]==='fixture-register')
    return words.slice(2).some(escapes);
  return false;
}
export function hostFileExpectation(fixture) {
  if(fixture.argv) return trustedExecutables.includes(fixture.argv[0]) && cliAsks(fixture.argv.slice(1)) ? 'ask' : 'allow';
  return mcpAsks(fixture.input.tool,fixture.input.arguments) ? 'ask' : 'allow';
}

export function hostPathCases() {
  const cases=[];
  const mcp=[...browserHostFileCases(),...browserFormCases(),...storageOperationCases(),...toolHostFileCases()];
  const cli=cliHostFileCases();
  for(const profile of ['loose','recommended','strict']) {
    for(const [label,tool,arguments_,expected] of mcp) cases.push({name:`host-mcp-${label}-${profile}`,profile,mcp:binding(),
      input:{kind:'mcp',server:'testrun',tool,arguments:arguments_,original_input:{}},expected});
    for(const [label,args,expected] of cli) cases.push({name:`host-cli-${label}-${profile}`,profile,argv:['testrun',...args],expected});
  }
  return cases;
}

export function applyTrustedTestrunExpectations(cases) {
  for(const fixture of cases.cases) {
    if(trustedExecutables.includes(fixture.argv?.[0]) || fixture.input?.kind==='mcp' && fixture.input.server==='testrun')
      fixture.expected=hostFileExpectation(fixture);
  }
  cases.cases.push(...trustedTestrunCases(),...hostPathCases(),...windowsExecutableCases(),...homeInstallCases());
}
