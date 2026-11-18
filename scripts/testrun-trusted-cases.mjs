// Independent operator-selected contract: all Testrun operations are approved.
// Keep these expectations separate from the policy's rule constructors.
export const trustedExecutables=['testrun','/usr/bin/testrun','/usr/local/bin/testrun','/opt/homebrew/bin/testrun'];
export function binding(server='testrun') {
  return {[server]:{transport:{type:'defaults',pack:'canonic/testrun',integration:'testrun'},
    agents:{codex:server},packs:{'canonic/testrun':'testrun'}}};
}

const page={connectionId:'11111111-1111-4111-8111-111111111111',generation:'22222222-2222-4222-8222-222222222222',id:'33333333-3333-4333-8333-333333333333'};
export const requests=[
  ['connect',{engine:'chrome',mode:'headless'}],
  ['browser_connect',{engine:'firefox',mode:'headless',context:{permissions:['clipboard-read']}}],
  ['act',{targetId:'browser:acme',actions:[{action:'page_navigate',page,navigation:{kind:'goto',url:'http://app.localhost'}},{action:'page_snapshot',page}]}],
  ['act',{targetId:'browser:acme',actions:[{action:'page_navigate',page,navigation:{kind:'goto',url:'https://example.com'}}]}],
  ['act',{actions:[{action:'app_launch',appId:'com.example.acme',env:{ACME_TEST_MODE:'1'}}]}],
  ['browser_send',{request:{operation:'batch',requests:[{operation:'page_navigate',page,navigation:{kind:'goto',url:'http://app.localhost'}},{operation:'page_snapshot',page}]}}],
  ['browser_send',{request:{operation:'page_add_script_tag',scope:page,path:'/outside/fixture.js'}}],
  ['browser_send',{request:{operation:'http_fetch',httpContext:page,request:{url:'https://example.com',method:'POST'}}}],
  ['browser_send',{request:{operation:'future_qa_operation',options:{path:'/outside/fixture',env:{ACME_TEST_MODE:'1'}}}}],
  ['browser_send',{request:{operation:'context_configure',context:page,setting:{kind:'permissions_grant',origin:'https://example.com',permissions:['camera']}}}],
  ['build_start',{project:'/outside/qa',inline:{command:'acme-build'},env:{ACME_TEST_MODE:'1'}}],
  ['app_install',{path:'/outside/app.apk',replace:true}],
  ['app_uninstall',{appId:'com.example.acme'}],
  ['diagnostics_export',{path:'/outside/report.json'}],
  ['diagnostics_remove',{investigationId:'acme'}],
  ['future_tool',{path:'/outside/qa'}],
  ['testrun_docs_read',{path:'cli.md'}],
];

export function trustedTestrunCases() {
  const cases=[];
  for(const profile of ['loose','recommended','strict']) {
    for(const [index,[tool,args]] of requests.entries()) for(const [variant,arguments_] of [
      ['request',args],['empty',{}],['malformed',{request:null,actions:'invalid'}],
    ]) cases.push({name:`trusted-mcp-${index}-${variant}-${profile}`,profile,mcp:binding(),
      input:{kind:'mcp',server:'testrun',tool,arguments:arguments_,original_input:{}},expected:'allow'});
    cases.push({name:`trusted-server-alias-${profile}`,profile,mcp:binding('qa'),
      input:{kind:'mcp',server:'qa',tool:'connect',arguments:{engine:'webkit'},original_input:{}},expected:'allow'});
    for(const executable of trustedExecutables) for(const [index,args] of [
      ['connect','--engine','chrome'],['act','--target','browser:acme',JSON.stringify(requests[2][1].actions)],
      ['browser','send',JSON.stringify(requests[5][1].request)],['app','uninstall','com.example.acme'],
      ['manager','stop'],['mcp','setup','--yes'],['future-command','--future-option','/outside/qa'],
    ].entries()) cases.push({name:`trusted-cli-${cases.length}-${index}-${profile}`,profile,argv:[executable,...args],expected:'allow'});
    for(const argv of [['acme','connect'],['testrun-other','connect'],['/tmp/forged/testrun','connect'],
      ['hub','operation','show','acme','--json']]) cases.push({name:`unrelated-${cases.length}-${profile}`,profile,argv,expected:'ask'});
  }
  return cases;
}

export function applyTrustedTestrunExpectations(cases) {
  for(const fixture of cases.cases) {
    if(trustedExecutables.includes(fixture.argv?.[0]) || fixture.input?.kind==='mcp' && fixture.input.server==='testrun')
      fixture.expected='allow';
  }
  cases.cases.push(...trustedTestrunCases());
}
