// Expected outcomes are reviewed independently from the policy constructors.
import {readFile} from 'node:fs/promises';

const profiles = ['loose','recommended','strict'];
const allow = ['allow','allow','allow'];
const routine = ['allow','allow','ask'];
const change = ['allow','ask','ask'];
const review = ['ask','ask','ask'];
const destroy = ['ask','ask','deny'];

export async function currentToolCases(name) {
  const previous = new URL(`../packs/canonic/${name}/0.2.1/cases.json`,import.meta.url);
  const cases = JSON.parse(await readFile(previous));
  if (name === 'testrun') {
    // Explicit targets now select either mobile input or opaque browser batches.
    for (const row of cases.cases) if (row.argv?.includes('act') && row.argv.includes('--target')
      || row.argv?.includes('connect') && row.argv.includes('--engine')) row.expected = 'ask';
    // The previous generic action fixture used an obsolete pre-schema shape.
    for (const row of cases.cases) if (row.name === `mcp-device-action-${row.profile}`)
      row.input.arguments = {actions:[{action:'tap',point:{x:0.5,y:0.5}}]};
  }
  const cli = [];
  const mcp = [];
  if (name === 'gate') {
    cli.push(
      ['rename-preview',['gate','rename','-r','acme','private'],allow],
      ['rename-confirm',['gate','rename','-r','acme','private','--confirm','digest'],change],
      ['discard-preview',['gate','discard','-r','acme','--all','--dry-run'],allow],
      ['discard',['gate','discard','-r','acme','--all'],destroy],
      ['discard-confirm-dry-token',['gate','discard','-r','acme','--all','--confirm','--dry-run'],destroy],
      ['discard-repo-dry-token',['gate','discard','--repo','--dry-run','--all','--confirm','digest'],destroy],
      ['worktree-discard',['gate','worktree','remove','.gate/tasks/feature','--discard-changes','--confirm','digest'],destroy],
      ['unknown',['gate','unknown-operation'],review],
    );
    mcp.push(
      ['rename','rename',{repo:'acme',new_id:'private'},change],
      ['rename-project-outside','rename',{repo:'acme',new_id:'private',project:'/outside/other'},review],
      ['discard','discard',{repo:'acme',all:true},destroy],
      ['discard-untracked','discard',{repo:'acme',all:true,untracked:true},destroy],
      ['discard-preview','discard',{repo:'acme',all:true,untracked:true,dry_run:true},allow],
      ['discard-preview-outside','discard',{repo:'acme',all:true,dry_run:true,project:'/outside/other'},destroy],
      ['worktree-discard','worktree_remove',{path:'.gate/tasks/feature',discard_changes:true},destroy],
    );
  }
  if (name === 'box') {
    const prepare = {workspace:'acme',operation:'11111111111111111111111111111111',generation:'22222222222222222222222222222222',request_id:'33333333333333333333333333333333',repo_from:{a:'origin/review'}};
    cli.push(['workspace-prepare',['box','workspace','prepare','acme','--operation',prepare.operation,'--generation',prepare.generation,'--request-id',prepare.request_id,'--repo-from','a=origin/review'],routine]);
    mcp.push(
      ['workspace-prepare','workspace_prepare',prepare,routine],
      ['workspace-prepare-project','workspace_prepare',{...prepare,project:'/outside/other'},review],
      ['workspace-prepare-missing','workspace_prepare',{workspace:'acme',repo_from:{a:'HEAD'}},review],
      ['workspace-prepare-malformed','workspace_prepare',{...prepare,generation:'not-a-generation'},review],
    );
    cli.push(
      ['managed-exec',['box','exec','--workspace','acme','--','node','scripts/check.mjs'],review],
      ['managed-exec-recorded',['box','--json','exec','--workspace','acme','--request-id',prepare.request_id,'--','node','scripts/check.mjs'],review],
      ['managed-shell',['box','shell','--workspace','acme'],review],
      ['managed-shell-command',['box','shell','--workspace','acme','--','codex'],review],
      ['managed-shell-shortcut',['box','--','codex'],review],
      ['managed-shell-workspace-shortcut',['box','--workspace','acme','--','codex'],review],
      ['remove-deferred-close',['box','workspace','remove','acme'],change],
      ['remove-immediate-close',['box','workspace','remove','acme','--allow-self-stop'],review],
      ['stop-session',['box','stop','acme','--allow-self-stop'],review],
      ['cleanup-preview',['box','workspace','cleanup','acme','--dry-run'],allow],
      ['remove-discard',['box','workspace','remove','acme','--delete-checkout','--discard-changes','--confirm','digest'],destroy],
      ['remove-discard-only',['box','workspace','remove','acme','--discard-changes'],destroy],
      ['remove-discard-immediate',['box','workspace','remove','acme','--delete-checkout','--discard-changes','--allow-self-stop'],destroy],
      ['cleanup-discard',['box','workspace','cleanup','acme','--worktree','--discard-changes','--confirm','digest'],destroy],
      ['cleanup-discard-all',['box','workspace','cleanup','acme','--all','--discard-changes'],destroy],
      ['cleanup-discard-preview-conflict',['box','workspace','cleanup','acme','--dry-run','--discard-changes'],destroy],
      ['recover-workspace',['box','recover','acme'],change],
      ['recover-attempt',['box','recover','--operation',prepare.operation,'--generation',prepare.generation],change],
      // CLI admission does not validate clap's selector conflicts. Box rejects
      // these forms before recovery; the pack retains the mutation decision.
      ['recover-workspace-generation-conflict',['box','recover','acme','--generation',prepare.generation],change],
      ['recover-workspace-attempt-conflict',['box','recover','acme','--operation',prepare.operation,'--generation',prepare.generation],change],
      ['recover-settle',['box','recover','--operation',prepare.operation,'--generation',prepare.generation,'--settle-compose-creation'],destroy],
    );
    mcp.push(
      ['managed-exec','exec',{workspace:'acme',command:['node','scripts/check.mjs']},review],
      ['managed-exec-recorded','exec',{workspace:'acme',command:['node','scripts/check.mjs'],request_id:prepare.request_id},review],
      ['managed-exec-borrowed','exec',{workspace:'acme',command:['node','scripts/check.mjs'],execution:'execution'},review],
      ['managed-exec-project','exec',{workspace:'acme',command:['node','scripts/check.mjs'],project:'/outside/other'},review],
      ['remove-deferred-close','workspace_remove',{workspace:'acme'},change],
      ['remove-immediate-close','workspace_remove',{workspace:'acme',allow_self_stop:true},review],
      ['stop-session','stop',{workspace:'acme',allow_self_stop:true},review],
      ['cleanup-preview','workspace_cleanup',{workspace:'acme',dry_run:true},allow],
      ['cleanup-discard','workspace_cleanup',{workspace:'acme',worktree:true,discard_changes:true},destroy],
      ['cleanup-discard-all','workspace_cleanup',{workspace:'acme',all:true,discard_changes:true},destroy],
      ['cleanup-discard-preview-conflict','workspace_cleanup',{workspace:'acme',dry_run:true,discard_changes:true},destroy],
      ['remove-discard-only','workspace_remove',{workspace:'acme',discard_changes:true},destroy],
      ['remove-discard-immediate','workspace_remove',{workspace:'acme',delete_checkout:true,discard_changes:true,allow_self_stop:true},destroy],
      ['recover-workspace','recover',{workspace:'acme'},change],
      ['recover-attempt','recover',{operation:prepare.operation,generation:prepare.generation},change],
      ['recover-workspace-generation-conflict','recover',{workspace:'acme',generation:prepare.generation},review],
      ['recover-workspace-operation-conflict','recover',{workspace:'acme',operation:prepare.operation},review],
      ['recover-workspace-attempt-conflict','recover',{workspace:'acme',operation:prepare.operation,generation:prepare.generation},review],
      ['recover-conflict-project','recover',{workspace:'acme',generation:prepare.generation,project:'/outside/other'},review],
      ['recover-settle','recover',{operation:prepare.operation,generation:prepare.generation,settle_compose_creation:true},destroy],
      ['shell-unknown','shell',{workspace:'acme',command:['codex']},review],
    );
    for (const words of ['plugin list','plugin show','plugin context show','plugin prepare','plugin workflow list','plugin workflow show']) {
      cli.push([words.replaceAll(' ','-'),['box',...words.split(' '),'speckit'],allow]);
      mcp.push([words.replaceAll(' ','-'),words.replaceAll(' ','_'),{plugin:'speckit',command:['codex'],operation:'acme'},allow]);
    }
    for (const verb of ['enable','disable','reset']) {
      cli.push([`plugin-${verb}`,['box','plugin',verb,'speckit'],change]);
      mcp.push([`plugin-${verb}`,`plugin_${verb}`,{plugin:'speckit'},change]);
      cli.push([`plugin-${verb}-preview`,['box','plugin',verb,'speckit','--dry-run'],allow]);
      mcp.push([`plugin-${verb}-preview`,`plugin_${verb}`,{plugin:'speckit',dry_run:true},allow]);
    }
    for (const verb of ['run','resume']) {
      cli.push([`workflow-${verb}`,['box','plugin','workflow',verb,'acme','--request-id','11111111111111111111111111111111'],review]);
      mcp.push([`workflow-${verb}`,`plugin_workflow_${verb}`,{plugin:'speckit',workflow:'review',request_id:'11111111111111111111111111111111'},review]);
      mcp.push([`workflow-${verb}-preview`,`plugin_workflow_${verb}`,{plugin:'speckit',dry_run:true},allow]);
    }
    cli.push(['plugin-launch',['box','plugin','launch','speckit','--','codex'],review]);
    cli.push(['plugin-option-dry-token',['box','plugin','enable','speckit','--option','--dry-run'],change]);
    cli.push(['plugin-check',['box','plugin','check','speckit','verify','--request-id','11111111111111111111111111111111'],routine]);
    mcp.push(
      ['plugin-check','plugin_check',{plugin:'speckit',target:'verify',request_id:'11111111111111111111111111111111'},routine],
      ['plugin-project','plugin_list',{project:'/outside/other'},review],
      ['binding','plugin_binding_add',{plugin:'speckit',work:'specs/001-acme',if_revision:0},routine],
      ['reconcile','plugin_workflow_reconcile',{operation:'acme'},change],
      ['abandon','plugin_workflow_abandon',{operation:'acme',reason:'reviewed'},change],
      ['config-sync','config_sync',{},change],
      ['config-preview','config_sync',{dry_run:true},allow],
      ['discard','workspace_remove',{workspace:'acme',delete_checkout:true,discard_changes:true},destroy],
      ['unknown','plugin_unknown',{},review],
    );
  }
  if (name === 'testrun') {
    const tap = {action:'tap',point:{x:0.5,y:0.5}};
    const context = {connectionId:'11111111-1111-4111-8111-111111111111',id:'22222222-2222-4222-8222-222222222222',generation:'33333333-3333-4333-8333-333333333333'};
    cli.push(
      ['mobile',['testrun','act',JSON.stringify(tap)],routine],
      ['browser-connect',['testrun','connect','--engine','firefox'],review],
      ['browser-connect-options',['testrun','connect','--engine','chrome','--mode','headless','--context','{"viewport":{"width":640,"height":480},"deviceScaleFactor":1,"extraHTTPHeaders":[{"name":"X-Acme","value":"example"}]}'],review],
      ['browser-connect-options-before-engine',['testrun','--json','connect','--context','{}','--mode','headed','--engine','webkit'],review],
      ['browser-connect-attached-options',['testrun','connect','--context={}','--mode=headless','--engine=firefox'],review],
      ['browser-connect-unknown-option',['testrun','connect','--engine','chrome','--unknown-option'],review],
      ['browser-connect-missing-context-value',['testrun','connect','--engine','chrome','--context'],review],
      ['browser-connect-missing-engine-value',['testrun','connect','--engine'],review],
      ['browser-connect-legacy',['testrun','browser','connect','--engine','firefox'],review],
      ['targeted-act',['testrun','act','--target','browser:acme',JSON.stringify({action:'http_fetch'})],review],
      ['targeted-leading-act',['testrun','--target','browser:acme','act',JSON.stringify({action:'http_fetch'})],review],
      ['performance-lifecycle',['testrun','browser','send',JSON.stringify({operation:'trace_start',context,options:{performance:{}}})],change],
      ['performance-lifecycle-act',['testrun','act','--target','browser:acme',JSON.stringify({action:'trace_start',context,options:{performance:{reload:false,autoStop:false}}})],review],
      ['trace-export-start',['testrun','browser','send',JSON.stringify({operation:'trace_start',context,options:{filePath:'/private/tmp/acme-trace/trace.json.gz'}})],change],
      ['trace-export-stop',['testrun','browser','send',JSON.stringify({operation:'trace_stop',filePath:'/private/tmp/acme-trace/trace.json'})],change],
    );
    mcp.push(
      ['mobile','act',{actions:[tap]},routine],
      ['mobile-eight','act',{actions:Array.from({length:8},()=>tap)},routine],
      ['empty','act',{actions:[]},review],
      ['missing','act',{},review],
      ['malformed','act',{actions:[{}]},review],
      ['browser','act',{targetId:'browser:acme',actions:[{action:'page_snapshot'}]},review],
      ['http','act',{targetId:'browser:acme',actions:[{action:'http_fetch',url:'https://example.com'}]},review],
      ['performance-lifecycle','browser_send',{targetId:'browser:acme',request:{operation:'trace_start',context,options:{performance:{}}}},change],
      ['performance-lifecycle-manual','browser_send',{targetId:'browser:acme',request:{operation:'trace_start',context,options:{performance:{reload:false,autoStop:false}}}},change],
      ['performance-lifecycle-act','act',{targetId:'browser:acme',actions:[{action:'trace_start',context,options:{performance:{}}}]},review],
      ['trace-export-start','browser_send',{targetId:'browser:acme',request:{operation:'trace_start',context,options:{filePath:'/private/tmp/acme-trace/trace.json.gz'}}},change],
      ['trace-export-stop','browser_send',{targetId:'browser:acme',request:{operation:'trace_stop',filePath:'/private/tmp/acme-trace/trace.json'}},change],
      ['trace-export-start-act','act',{targetId:'browser:acme',actions:[{action:'trace_start',context,options:{filePath:'/private/tmp/acme-trace/trace.json.gz'}}]},review],
      ['trace-export-stop-act','act',{targetId:'browser:acme',actions:[{action:'trace_stop',filePath:'/private/tmp/acme-trace/trace.json'}]},review],
      ['host-file','act',{actions:[{action:'heap_import',path:'/outside/secrets'}]},review],
      ['mixed-last','act',{actions:[...Array.from({length:7},()=>tap),{action:'storage_export'}]},review],
      ['overflow','act',{actions:Array.from({length:9},()=>tap)},review],
      ['launch-env','act',{actions:[tap,{action:'app_launch',appId:'com.example.acme',env:{DYLD_INSERT_LIBRARIES:'/outside/inject'}}]},review],
      ['browser-connect','connect',{engine:'firefox',mode:'headless'},review],
      ['browser-context','connect',{engine:'chrome',context:{permissions:['clipboard-read']}},review],
      ['browser-connect-legacy','browser_connect',{engine:'firefox',mode:'headless'},review],
      ['device-connect','connect',{targetId:'simulator:ACME'},routine],
      ['unknown','future_tool',{},review],
    );
  }
  const binding = {[name]:{transport:{type:'defaults',pack:`canonic/${name}`,integration:name},
    agents:{codex:name},packs:{[`canonic/${name}`]:name}}};
  for (const [index,profile] of profiles.entries()) {
    for (const [label,argv,expected] of cli) cases.cases.push({name:`current-cli-${label}-${profile}`,profile,argv,expected:expected[index]});
    for (const [label,tool,arguments_,expected] of mcp) cases.cases.push({name:`current-mcp-${label}-${profile}`,profile,mcp:binding,
      input:{kind:'mcp',server:name,tool,arguments:arguments_,original_input:{}},expected:expected[index]});
  }
  return cases;
}
