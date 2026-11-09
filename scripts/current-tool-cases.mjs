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
  if (name === 'box') {
    // These names are not exposed by Box 0.29; current fixtures review them as unknown.
    for (const row of cases.cases) {
      if (['box_docs_list','box_docs_search','box_docs_read'].includes(row.input?.tool))
        row.expected = 'ask';
    }
  }
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
    // Optional MCP interaction modes keep the ordinary operation's effects.
    mcp.push(
      ['config-show','config_show',{},allow],
      ['config-setup','setup',{agents:['claude','codex']},change],
      ['retired-config-setup','config_setup',{agents:['codex'],dry_run:true},review],
      ['config-setup-preview','setup',{agents:['codex'],dry_run:true},allow],
      ['config-setup-repair','setup',{agents:['codex'],repair_hooks:true},change],
      ['config-setup-remove','setup',{remove:true},change],
      ['config-setup-project','setup',{agents:['codex'],project:'/outside/other'},review],
      ['config-setup-preview-project','setup',{agents:['codex'],dry_run:true,project:'/outside/other'},review],
      ['config-setup-malformed-preview','setup',{agents:[],dry_run:'true'},change],
      ['setup-missing-agents','setup',{},change],
      ['setup-empty-agents','setup',{agents:[]},change],
      ['setup-removal-agent-conflict','setup',{agents:['codex'],remove:true},change],
      ['setup-removal-repair-conflict','setup',{remove:true,repair_hooks:true},change],
      ['setup-user-repair','setup',{scope:'user',agents:['codex'],repair_hooks:true},change],
      ['setup-user-repair-preview','setup',{scope:'user',agents:['codex'],repair_hooks:true,dry_run:true},allow],
      ['setup-user-removal','setup',{scope:'user',remove:true},change],
      ['setup-malformed-repair-preview','setup',{agents:['codex'],repair_hooks:'true',dry_run:'true'},change],
      ['config-hook-repair','config_sync',{servers:['shield'],repair_hooks:true},change],
      ['config-hook-repair-preview','config_sync',{servers:['shield'],repair_hooks:true,dry_run:true},allow],
      ['config-hook-repair-project','config_sync',{servers:['shield'],repair_hooks:true,project:'/outside/other'},review],
      ['config-hook-repair-user','config_sync',{scope:'user',agents:['codex'],repair_hooks:true},change],
      ['config-hook-repair-user-preview','config_sync',{scope:'user',agents:['codex'],repair_hooks:true,dry_run:true},allow],
      ['config-hook-repair-malformed-preview','config_sync',{repair_hooks:true,dry_run:'true'},change],
      ['config-show-user','config_show',{scope:'user'},allow],
      ['config-show-project','config_show',{project:'/outside/other'},review],
      ...['', '.', '../other', 7, false, {}, []].flatMap((project,index) => [
        [`config-show-invalid-project-${index}`,'config_show',{project},review],
        [`config-preview-invalid-project-${index}`,'config_sync',{project,dry_run:true},review],
      ]),
      ['config-show-null-project','config_show',{project:null},allow],
      ['config-preview-null-project','config_sync',{project:null,dry_run:true},allow],
      ['deferred-create','workspace_create',{name:'acme',deferred:true},routine],
      ['deferred-create-path','workspace_create',{name:'acme',deferred:true,path:'/outside/acme'},review],
      ['deferred-attach','workspace_attach',{name:'acme',path:'/outside/acme',deferred:true},review],
      ['deferred-prepare','workspace_prepare',{...prepare,deferred:true},routine],
      ['deferred-prepare-missing','workspace_prepare',{workspace:'acme',deferred:true},review],
      ['deferred-prepare-invalid-request','workspace_prepare',{...prepare,deferred:true,request_id:'G'.repeat(32)},review],
      ['deferred-prepare-project','workspace_prepare',{...prepare,deferred:true,project:'/outside/other'},review],
      ['config-select','config_sync',{select:true},change],
      ['config-select-preview','config_sync',{select:true,dry_run:true},allow],
      ['config-select-preview-project','config_sync',{select:true,dry_run:true,project:'/outside/other'},review],
      ['dashboard-status','status',{workspace:'acme'},allow],
      ['dashboard-unknown','dashboard_refresh',{},review],
    );
    cli.push(['workspace-prepare',['box','workspace','prepare','acme','--operation',prepare.operation,'--generation',prepare.generation,'--request-id',prepare.request_id,'--repo-from','a=origin/review'],routine]);
    mcp.push(
      ['workspace-prepare','workspace_prepare',prepare,routine],
      ['workspace-prepare-project','workspace_prepare',{...prepare,project:'/outside/other'},review],
      ['workspace-prepare-missing','workspace_prepare',{workspace:'acme',repo_from:{a:'HEAD'}},review],
      ['workspace-prepare-malformed','workspace_prepare',{...prepare,generation:'not-a-generation'},review],
    );
    cli.push(
      ['setup-hook-repair',['box','setup','--agent','codex','--repair-hooks'],change],
      ['setup-hook-repair-preview',['box','setup','--agent','codex','--repair-hooks','--dry-run'],allow],
      ['setup-user-hook-repair',['box','setup','--scope','user','--agent','codex','--repair-hooks'],change],
      ['setup-user-hook-repair-preview',['box','setup','--scope','user','--agent','codex','--repair-hooks','--dry-run'],allow],
      ['setup-remove-repair-conflict',['box','setup','--remove','--repair-hooks'],change],
      ['setup-remove-agent-conflict',['box','setup','--remove','--agent','codex'],change],
      ['sync-hook-repair',['box','config','sync','--server','shield','--repair-hooks'],change],
      ['sync-hook-repair-preview',['box','config','sync','--server','shield','--repair-hooks','--dry-run'],allow],
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
    mcp.push(
      ['project-discover','project_discover',{root:'.'},allow],
      ['project-discover-outside','project_discover',{root:'/outside/other'},review],
      ['project-discover-missing','project_discover',{},review],
      ['project-init-preview','project_init',{root:'.',projects:[{path:'web',kind:'vue',platforms:['web']}],dryRun:true},allow],
      ['project-init-preview-outside','project_init',{root:'/outside/other',dryRun:true},review],
      ['project-init-preview-missing','project_init',{dryRun:true},review],
      ['project-init-default','project_init',{root:'.'},review],
      ['project-init-apply','project_init',{root:'.',dryRun:false,planDigest:'1'.repeat(64)},review],
      ['project-init-missing-plan','project_init',{root:'.',dryRun:false},review],
      ['project-init-dry-string','project_init',{root:'.',dryRun:'true'},review],
    );
    cli.push(
      ['init',['testrun','init'],review],
      ['init-yes',['testrun','init','--yes'],review],
      ['init-preview',['testrun','init','--dry-run','--json'],allow],
      ['init-preview-root',['testrun','init','--root','.','--dry-run'],allow],
      ['init-preview-outside',['testrun','init','--root','/outside/other','--dry-run'],review],
      ['init-preview-path-outside',['testrun','init','--path','/outside/other','--dry-run'],review],
      ['init-kind-dry-token',['testrun','init','--path','.','--kind','--dry-run','--yes'],review],
      ['init-preview-unknown',['testrun','init','--dry-run','--unknown'],review],
    );
    cli.push(
      ['project-list',['testrun','project','list'],allow],
      ['project-list-root',['testrun','project','list','--root','.'],allow],
      ['project-list-outside',['testrun','project','list','--root','/outside/other'],review],
      ['project-show',['testrun','project','show','mobile','--root','.'],allow],
      ['project-show-outside',['testrun','project','show','mobile','--root','/outside/other'],review],
      ['config-root-outside',['testrun','config','check','--root','/outside/other'],review],
      ['build-named',['testrun','build','start','dev','--app','mobile','--root','.'],review],
    );
    mcp.push(
      ['project-list','project_list',{root:'.'},allow],
      ['project-list-outside','project_list',{root:'/outside/other'},review],
      ['project-list-missing','project_list',{},review],
      ['project-show','project_show',{root:'.',project:'mobile'},allow],
      ['project-show-missing','project_show',{root:'.'},review],
      ['project-show-invalid','project_show',{root:'.',project:'../mobile'},review],
      ['config-root-outside','config_check',{root:'/outside/other'},review],
      ['named-project-status','project_status',{root:'.',project:'mobile',profile:'dev'},allow],
      ['named-project-status-outside','project_status',{root:'/outside/other',project:'mobile',profile:'dev'},review],
      ['named-project-status-missing','project_status',{root:'.',project:'mobile'},review],
      ['build-named','build_start',{root:'.',project:'mobile',profile:'dev'},review],
    );
    const investigation='diag-11111111111111111111111111111111';
    const analysis='analysis-33333333333333333333333333333333';
    for(const operation of ['summary','timeline','failures','stacks','resources','frames','retention','requests']) {
      const filters={view:'investigation',investigation:{analysisIds:['analysis-44444444444444444444444444444444'],operation},limit:20};
      cli.push([`reports-compose-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify(filters)],review]);
      mcp.push([`reports-compose-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,...filters},review]);
    }
    for(const privacy of ['minimal','private']) {
      const report={privacy,facts:[{statement:'Caller observation',witnesses:[{analysisId:analysis,ordinal:0}]}],hypotheses:[{statement:'Caller hypothesis'}]};
      cli.push([`reports-view-${privacy}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'report',report})],review]);
      mcp.push([`reports-view-${privacy}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'report',report},review]);
      for(const format of ['investigation-json','investigation-markdown']) {
        cli.push([`reports-export-${format}-${privacy}`,['testrun','diagnostics','export',investigation,analysis,'--path','/outside/report','--filters',JSON.stringify({format,scope:'all',report})],review]);
        mcp.push([`reports-export-${format}-${privacy}`,'diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/report',format,scope:'all',report},review]);
      }
    }
    mcp.push(['reports-malformed-execution','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'report',report:{execute:true,causalityEstablished:true}},review],['reports-unknown-upload','diagnostics_upload',{path:'/outside/report',destination:'https://example.com'},review]);
    const incident={kind:'observability_http',configFile:'/outside/private/provider.json',sourceId:'incident',scope:{account:'acme',project:'api',environment:'staging',region:'eu',resource:'api',release:'v1'},window:{from:'2026-01-01T00:00:00Z',to:'2026-01-01T00:01:00Z'}};
    for(const source of [incident,{...incident,method:'POST',endpoint:'https://example.com/delete',credentialFallback:true},...['observability-evidence-v1','otlp-json','prometheus-json','loki-json','sentry-json','jaeger-json','cloudwatch-json','crashlytics-json','play-vitals-json','deployment-evidence-v1'].map(format=>({kind:'import',path:'/outside/private/provider-export',format}))]) {
      const key=source.format??(source.method?'malformed':'configured');
      cli.push([`observability-${key}`,['testrun','diagnostics','start',investigation,'--submission-id','incident','--source',JSON.stringify(source)],review]);
      mcp.push([`observability-${key}`,'diagnostics_start',{investigationId:investigation,submissionId:'incident',source},review]);
    }
    cli.push(['observability-joins',['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'observability'})],review]);
    mcp.push(['observability-joins','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'observability'},review],['observability-unknown-mutation','observability_remediate',{environment:'production',action:'restart'},review]);
    for (const source of [
      {kind:'host_process',targetId:'process:Acme:42',serviceId:'api',hostId:'Acme',processId:42,expectedGeneration:'linux:boot:42:birth'},
      {kind:'box_logs',targetId:'service:Acme:api',serviceId:'api',project:'/outside/acme',workspace:'acme#feature',operationId:'node-1',stream:'stderr'},
    ]) {
      cli.push([`services-source-${source.kind}`,['testrun','diagnostics','start',investigation,'--submission-id','service','--source',JSON.stringify(source)],review]);
      mcp.push([`services-source-${source.kind}`,'diagnostics_start',{investigationId:investigation,submissionId:'service',source},review]);
    }
    for (const format of ['service-evidence-v1','host-process-v1','box-log-v1','js-cpu-profile','jfr-json','pprof','stackprof-json','xdebug-cachegrind','windows-minidump']) {
      cli.push([`services-import-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','service','--source',JSON.stringify({kind:'import',path:'/outside/private/service',format})],review]);
      mcp.push([`services-import-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'service',source:{kind:'import',path:'/outside/private/service',format}},review]);
    }
    mcp.push(['services-malformed-exec','diagnostics_start',{investigationId:investigation,submissionId:'service',source:{kind:'host_process',processId:42,exec:['never'],signal:9,remote:'production'}},review],['services-unknown-control','service_launch',{command:['never'],takeover:true},review]);
    for (const mode of ['discover','observe']) {
      const source={kind:'embedded_cdp',endpoint:'http://127.0.0.1:9222',targetId:'android:ACME',appId:'com.example.acme',mode,...(mode==='observe'?{pageId:'acme',expectedUrl:'https://example.com',allowDebuggerAttachment:true,network:true}: {})};
      cli.push([`framework-embedded-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','embedded','--source',JSON.stringify(source)],review]);
      mcp.push([`framework-embedded-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'embedded',source},review]);
    }
    for (const format of ['framework-evidence-v1','runtime-samples-v1','embedded-cdp-v1','speedscope']) {
      cli.push([`framework-import-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','framework','--source',JSON.stringify({kind:'import',path:'/outside/private/framework',format})],review]);
      mcp.push([`framework-import-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'framework',source:{kind:'import',path:'/outside/private/framework',format}},review]);
    }
    mcp.push(['framework-unsafe-endpoint-enable','diagnostics_start',{investigationId:investigation,submissionId:'unsafe',source:{kind:'embedded_cdp',endpoint:'http://example.com',enableEndpoint:true,evaluate:'must-not-run()'}},review],['framework-unknown-controller','framework_connect',{engine:'unity',takeover:true},review]);
    cli.push(
      ...['test-results-v1','junit-xml'].map(format=>[`testing-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','tests','--source',JSON.stringify({kind:'import',path:'/outside/private/tests',format})],review]),
      ...['ui','api','accessibility','visual','media','performance'].map(domain=>[`testing-${domain}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'assertions',assertions:{checks:[{id:'check',domain,name:'checkout',predicate:{type:'equals',pointer:'/test/outcome',expected:'passed'}}]}})],review]),
      ['testing-metric',['testrun','diagnostics','query',investigation,analysis,'--filters','{"view":"assertions","assertions":{"checks":[{"id":"latency","domain":"performance","predicate":{"type":"metric","unit":"milliseconds","definition":"request to rendered result","max":100,"aggregation":"max"}}]}}'],review],
    );
    mcp.push(
      ...['test-results-v1','junit-xml'].map(format=>[`testing-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'tests',source:{kind:'import',path:'/outside/private/tests',format}},review]),
      ...['ui','api','accessibility','visual','media','performance'].map(domain=>[`testing-${domain}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'assertions',assertions:{checks:[{id:'check',domain,name:'checkout',predicate:{type:'equals',pointer:'/test/outcome',expected:'passed'}}]}},review]),
      ['testing-metric','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'assertions',assertions:{checks:[{id:'latency',domain:'performance',predicate:{type:'metric',unit:'milliseconds',definition:'request to rendered result',max:100,aggregation:'max'}}]}},review],
      ['testing-malformed-evaluation','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'assertions',assertions:{checks:[{id:'unsafe',domain:'ui',predicate:{type:'evaluate',expression:'must-not-run()'}}]}},review],
      ['testing-unknown-runner','diagnostics_test_run',{runner:'arbitrary',command:['never']},review],
    );
    cli.push(
      ...['crash','hang','memory_growth','slow_interaction','startup','network','background_media','soak'].map(preset=>[`reproduction-plan-${preset}`,['testrun','diagnostics','plan',preset,'--platform','android','--options','{"targetId":"android:ACME","appId":"com.example.acme","userId":0,"fault":"offline"}'],allow]),
      ['reproduction-plan-missing-platform',['testrun','diagnostics','plan','soak'],review],
      ['reproduction-marker',['testrun','diagnostics','start',investigation,'--submission-id','before','--source','{"kind":"marker","name":"before checkout","actionId":"checkout","phase":"before_action"}'],review],
      ['reproduction-import',['testrun','diagnostics','start',investigation,'--submission-id','baseline','--source','{"kind":"import","path":"/outside/run.json","format":"reproduction-v1"}'],review],
      ['reproduction-compare',['testrun','diagnostics','compare',investigation,analysis,investigation,analysis],review],
    );
    mcp.push(
      ...['android','ios','browser','import'].map(platform=>[`reproduction-plan-${platform}`,'diagnostics_plan',{preset:'network',platform,fault:'offline'},allow]),
      ['reproduction-plan-missing','diagnostics_plan',{preset:'soak'},review],
      ['reproduction-plan-unknown','diagnostics_plan',{preset:'run_shell',platform:'android'},review],
      ['reproduction-marker','diagnostics_start',{investigationId:investigation,submissionId:'marker',source:{kind:'marker',name:'before checkout',actionId:'checkout',phase:'before_action'}},review],
      ['reproduction-marker-malformed','diagnostics_start',{investigationId:investigation,submissionId:'marker',source:{kind:'marker',name:'before',actionId:'checkout',phase:'before_action',command:'never'}},review],
      ['reproduction-import','diagnostics_start',{investigationId:investigation,submissionId:'baseline',source:{kind:'import',path:'/outside/run.json',format:'reproduction-v1'}},review],
      ['reproduction-compare','diagnostics_compare',{investigationId:investigation,analysisId:analysis,otherInvestigationId:investigation,otherAnalysisId:analysis},review],
      ['reproduction-future-runner','diagnostics_run',{preset:'soak',repeat:true},review],
    );
    const debugPage={connectionId:'11111111-1111-4111-8111-111111111111',id:'22222222-2222-4222-8222-222222222222',generation:'33333333-3333-4333-8333-333333333333'};
    const debugActions=[{kind:'variables',pauseId:'11111111-1111-4111-8111-111111111111',frame:0,scope:0,offset:0,limit:20},
      {kind:'logpoint_set',url:'https://example.com/app.js',line:4,marker:'Acme'},
      {kind:'evaluate',pauseId:'11111111-1111-4111-8111-111111111111',frame:0,expression:'local'}, {kind:'disable'}];
    const nativeSource=(backend,mode)=>({kind:'native_trace',backend,mode,targetId:backend==='xctrace'?'device:ACME':backend==='stack_sample'?'host:macos':'android:ACME',appId:'com.example.acme',processId:42,...(mode==='import'?{path:'/outside/trace'}:{}),toolPath:'/outside/native-tool',allowSystemTrace:true,allowAttach:true,...(backend==='xctrace'?{template:'Time Profiler'}:{})});
    cli.push(
      ['diagnostics-open',['testrun','diagnostics','open','--submission-id','acme','--question','Investigate Acme'],routine],
      ['diagnostics-status',['testrun','diagnostics','status',investigation],allow],
      ['diagnostics-import',['testrun','diagnostics','start',investigation,'--submission-id','capture','--source','{"kind":"import","path":"/outside/private.log","format":"bytes"}'],review],
      ['diagnostics-android',['testrun','diagnostics','start',investigation,'--submission-id','android','--source','{"kind":"android","targetId":"android:ACME","appId":"com.example.acme","userId":0}'],review],
      ['diagnostics-apple-simulator',['testrun','diagnostics','start',investigation,'--submission-id','apple','--source','{"kind":"ios","targetId":"simulator:ACME","appId":"com.example.acme","reportDirectory":"/outside/private-reports"}'],review],
      ['diagnostics-apple-network',['testrun','diagnostics','start',investigation,'--submission-id','apple','--source','{"kind":"ios","targetId":"device:ACME","appId":"com.example.acme","transport":"network"}'],review],
      ['diagnostics-browser-result',['testrun','diagnostics','start',investigation,'--submission-id','browser','--source','{"kind":"browser_operation","targetId":"browser:11111111-1111-4111-8111-111111111111","operationId":"22222222-2222-4222-8222-222222222222","request":{"operation":"page_list"}}'],review],
      ...['discover','logs','cpu','heap_sampling'].map(mode=>[`diagnostics-rn-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','rn','--source',JSON.stringify({kind:'react_native',endpoint:'http://127.0.0.1:8081',targetId:'android:ACME',appId:'com.example.acme',pageId:'device-1',logicalDeviceId:'device',mode,probe:true,allowProfilerControl:true})],review]),
      ...['discover','observe','cpu','memory','inspect'].map(mode=>[`diagnostics-dart-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','dart','--source',JSON.stringify({kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'android:ACME',appId:'com.example.acme',runtimeKind:'flutter_native',mode,isolateId:'isolates/1',vmStartTime:1,isolateStartTime:2,inspector:true,network:true,objectIds:['objects/1'],classIds:['classes/1']})],review]),
      ['diagnostics-android-state',['testrun','diagnostics','start',investigation,'--submission-id','state','--source','{"kind":"android_state","targetId":"android:ACME","appId":"com.example.acme","userId":0,"groups":["process","memory","power"]}'],review],
      ['diagnostics-android-state-follow',['testrun','diagnostics','start',investigation,'--submission-id','state','--source','{"kind":"android_state","targetId":"android:ACME","appId":"com.example.acme","userId":10,"groups":["scheduling","connectivity","frames"],"mode":"follow","intervalMs":500}'],review],
      ['diagnostics-android-deep',['testrun','diagnostics','start',investigation,'--submission-id','android','--source','{"kind":"android","targetId":"android:ACME","appId":"com.example.acme","userId":10,"mode":"follow","includeReports":true,"systemContext":true}'],review],
      ['diagnostics-read',['testrun','diagnostics','read',investigation,'collector-22222222222222222222222222222222'],review],
      ['diagnostics-stop',['testrun','diagnostics','stop',investigation],routine],
      ['diagnostics-close',['testrun','diagnostics','close',investigation],routine],
      ['diagnostics-remove',['testrun','diagnostics','remove',investigation],destroy],
      ['diagnostics-future',['testrun','diagnostics','future',investigation],review],
      ['diagnostics-analyze',['testrun','diagnostics','analyze',investigation,'collector-22222222222222222222222222222222','--submission-id','parse'],review],
      ['diagnostics-apple-symbolicate',['testrun','diagnostics','analyze',investigation,'collector-22222222222222222222222222222222','--submission-id','symbols','--metadata','{"symbolicate":true,"symbols":[]}'],review],
      ['diagnostics-analysis-status',['testrun','diagnostics','analysis-status',investigation,analysis],allow],
      ['diagnostics-analysis-cancel',['testrun','diagnostics','analysis-cancel',investigation,analysis],routine],
      ['diagnostics-query',['testrun','diagnostics','query',investigation,analysis,'--filters','{"kind":"failure"}'],review],
      ['diagnostics-compare',['testrun','diagnostics','compare',investigation,analysis,investigation,analysis],review],
      ['diagnostics-internal-worker',['testrun','diagnostic-parser-worker'],review],
      ['diagnostics-capabilities',['testrun','diagnostics','capabilities'],allow],
      ['diagnostics-prepare',['testrun','diagnostics','prepare','builtin-parser'],routine],
      ['diagnostics-prepare-version',['testrun','diagnostics','prepare','builtin-parser','--version','testrun-diagnostics/1'],routine],
      ['diagnostics-prepare-unknown',['testrun','diagnostics','prepare','perfetto'],review],
      ['diagnostics-prepare-missing',['testrun','diagnostics','prepare'],review],
      ['diagnostics-project',['testrun','diagnostics','project',investigation,analysis,'--filters','{"scope":"all"}'],review],
      ['diagnostics-export',['testrun','diagnostics','export',investigation,analysis,'--path','/outside/report.json'],review],
      ...['perfetto','simpleperf','xctrace','stack_sample'].flatMap(backend=>['capture','import'].map(mode=>[`native-${backend}-${mode}`,['testrun','diagnostics','start',investigation,'--submission-id','native','--source',JSON.stringify(nativeSource(backend,mode))],review])),
      ['native-export',['testrun','diagnostics','export',investigation,analysis,'--path','/outside/native.trace','--filters','{"format":"native_artifact","scope":"all"}'],review],
      ['native-thread',['testrun','diagnostics','query',investigation,analysis,'--filters','{"view":"timeline","nativeUpid":5,"nativeUtid":3}'],review],
      ...['runtime-checks-v1','sanitizer-report-text'].map(format=>[`runtime-checks-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','checks','--source',JSON.stringify({kind:'import',path:'/outside/private/checks',format})],review]),
      ['runtime-checks-query',['testrun','diagnostics','query',investigation,analysis,'--filters','{"kind":"failure","correlationId":"fault-1"}'],review],
      ...debugActions.map(action=>[`interactive-${action.kind}`,['testrun','browser','send',JSON.stringify({operation:'page_debugger',page:debugPage,action})],change]),
      ['scenario-import',['testrun','diagnostics','start',investigation,'--submission-id','scenario','--source','{"kind":"import","path":"/outside/private/scenario.json","format":"scenario-context-v1"}'],review],
      ['scenario-android-context',['testrun','diagnostics','start',investigation,'--submission-id','context','--source','{"kind":"android_state","targetId":"android:ACME","appId":"com.example.acme","userId":0,"groups":["media","device_context"]}'],review],
      ...['summary','timeline','lifecycle','media','peripherals','energy','settings','restore'].map(operation=>[`scenario-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'scenario',scenario:{operation}})],review]),
      ...['network-evidence-v1','data-snapshot-v1','pcap'].map(format=>[`network-data-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','network-data','--source',JSON.stringify({kind:'import',path:'/outside/private/evidence',format})],review]),
      ...['requests','phases','messages','spans','logs','packets','correlate','data','schema','query_plan'].map(operation=>[`network-data-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'network_data',networkData:{operation,...(operation==='correlate'?{traceId:'11111111111111111111111111111111'}:operation==='data'?{collection:'orders',equals:{field:'state',value:null}}:{})}})],review]),
      ...['ui-performance-v1','package-size-v1'].map(format=>[`performance-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','performance','--source',JSON.stringify({kind:'import',path:'/outside/private/performance.json',format})],review]),
      ...['summary','startup','frames','stages','interaction','trees','accessibility','gpu','sizes'].map(operation=>[`performance-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'performance',performance:{operation,...(operation==='accessibility'?{minTargetSize:44}:{})}})],review]),
      ...['java-hprof','memory-graph-v1','memory-series-v1'].map(format=>[`memory-${format}`,['testrun','diagnostics','start',investigation,'--submission-id','memory','--source',JSON.stringify({kind:'import',path:'/outside/private/heap',format})],review]),
      ...['summary','classes','objects','object','edges','retainers','paths','dominators','series'].map(operation=>[`memory-${operation}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view:'memory',memory:{operation,...(['object','edges','retainers','paths'].includes(operation)?{objectId:'0x42'}:{})}})],review]),
      ...['Allocations','Leaks'].map(template=>[`memory-apple-${template}`,['testrun','diagnostics','start',investigation,'--submission-id','memory','--source',JSON.stringify({kind:'native_trace',backend:'xctrace',mode:'capture',targetId:'device:ACME',appId:'com.example.acme',processId:42,template,allowAttach:true,allowAllocationRecording:true,allowHeapInspection:true})],review]),
      ...['timeline','call_tree','flamegraph'].map(view=>[`native-${view}`,['testrun','diagnostics','query',investigation,analysis,'--filters',JSON.stringify({view})],review]),
    );
    mcp.push(
      ['diagnostics-open','diagnostics_open',{submissionId:'acme',question:'Investigate Acme'},routine],
      ['diagnostics-status','diagnostics_status',{investigationId:investigation},allow],
      ['diagnostics-malformed','diagnostics_status',{investigationId:'../../private'},review],
      ['diagnostics-missing','diagnostics_status',{},review],
      ['diagnostics-import','diagnostics_start',{investigationId:investigation,submissionId:'capture',source:{kind:'import',path:'/outside/private.log',format:'bytes'}},review],
      ['diagnostics-android','diagnostics_start',{investigationId:investigation,submissionId:'android',source:{kind:'android',targetId:'android:ACME',appId:'com.example.acme',userId:0}},review],
      ['diagnostics-apple-simulator','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'simulator:ACME',appId:'com.example.acme',reportDirectory:'/outside/private-reports'}},review],
      ['diagnostics-apple-usb','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'device:ACME',appId:'com.example.acme',transport:'usb',collectLogs:true}},review],
      ['diagnostics-browser-result','diagnostics_start',{investigationId:investigation,submissionId:'browser',source:{kind:'browser_operation',targetId:'browser:11111111-1111-4111-8111-111111111111',operationId:'22222222-2222-4222-8222-222222222222',request:{operation:'page_list'}}},review],
      ['diagnostics-browser-private-query','diagnostics_start',{investigationId:investigation,submissionId:'browser',source:{kind:'browser_operation',targetId:'browser:11111111-1111-4111-8111-111111111111',operationId:'22222222-2222-4222-8222-222222222222',request:{operation:'diagnostics_read',context:{connectionId:'11111111-1111-4111-8111-111111111111',id:'33333333-3333-4333-8333-333333333333',generation:'44444444-4444-4444-8444-444444444444'},query:{includeText:true}}}},review],
      ['diagnostics-browser-mutating-fallback','diagnostics_start',{investigationId:investigation,submissionId:'browser',source:{kind:'browser_operation',targetId:'browser:11111111-1111-4111-8111-111111111111',operationId:'bad',request:{operation:'unknown_shell',command:'never'},execute:true}},review],
      ['diagnostics-apple-network','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'device:ACME',appId:'com.example.acme',transport:'network',systemContext:true}},review],
      ['diagnostics-apple-invalid','diagnostics_start',{investigationId:investigation,submissionId:'apple',source:{kind:'ios',targetId:'device:-x',appId:'com.example.acme',prepareSupport:true,removeReports:true}},review],
      ['diagnostics-android-state','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:0,groups:['process','memory','power']}},review],
      ['diagnostics-android-state-all','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:10,groups:['process','memory','scheduling','power','frames','connectivity'],mode:'follow',intervalMs:500,maxProcesses:8}},review],
      ['diagnostics-android-state-mutator','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:0,groups:['force-gc','reset'],command:'reboot'}},review],
      ['diagnostics-android-state-missing','diagnostics_start',{investigationId:investigation,submissionId:'state',source:{kind:'android_state',appId:'com.example.acme'}},review],
      ['diagnostics-android-reports','diagnostics_start',{investigationId:investigation,submissionId:'android',source:{kind:'android',targetId:'android:ACME',appId:'com.example.acme',userId:10,mode:'follow',includeReports:true,systemContext:true}},review],
      ['diagnostics-android-malformed','diagnostics_start',{investigationId:investigation,submissionId:'android',source:{kind:'android',targetId:'../private',appId:'com.example.acme;reboot'}},review],
      ...['discover','logs','cpu','heap_sampling'].map(mode=>[`diagnostics-rn-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',endpoint:'http://127.0.0.1:8081',targetId:'android:ACME',appId:'com.example.acme',pageId:'device-1',logicalDeviceId:'device',mode,probe:true,allowProfilerControl:true}},review]),
      ['diagnostics-rn-takeover','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',endpoint:'http://127.0.0.1:8081',targetId:'device:ACME',appId:'host.exp.Exponent',pageId:'device-1',logicalDeviceId:'device',mode:'logs',network:true,scripts:true,allowDebuggerTakeover:true}},review],
      ['diagnostics-rn-remote','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',endpoint:'http://192.0.2.1:8081',targetId:'android:ACME',appId:'com.example.acme'}},review],
      ['diagnostics-rn-missing','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native'}},review],
      ['diagnostics-rn-arbitrary-cdp','diagnostics_start',{investigationId:investigation,submissionId:'rn',source:{kind:'react_native',command:'Debugger.resume',expression:'arbitrary()'}},review],
      ...['discover','observe','cpu','memory','inspect'].map(mode=>[`diagnostics-dart-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'android:ACME',appId:'com.example.acme',runtimeKind:'flutter_native',mode,isolateId:'isolates/1',vmStartTime:1,isolateStartTime:2,inspector:true,network:true,timeline:true,processMemory:true,objectIds:['objects/1'],classIds:['classes/1']}},review]),
      ['diagnostics-dart-cli','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'dart:ACME',appId:'acme',runtimeKind:'dart_cli',mode:'discover',allowUnauthenticated:true,includeVmOutput:true}},review],
      ['diagnostics-dart-desktop','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',endpointFile:'/outside/private/service-uri',targetId:'desktop:ACME',appId:'com.example.acme',runtimeKind:'flutter_desktop',mode:'observe'}},review],
      ['diagnostics-dart-missing','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart'}},review],
      ['diagnostics-dart-arbitrary-rpc','diagnostics_start',{investigationId:investigation,submissionId:'dart',source:{kind:'dart',method:'resume',params:{isolateId:'isolates/1'},endpoint:'ws://192.0.2.1:8181/ws'}},review],
      ['diagnostics-unknown-source','diagnostics_start',{investigationId:investigation,submissionId:'future',source:{kind:'future_native'}},review],
      ['diagnostics-borrowed-output','diagnostics_start',{investigationId:investigation,submissionId:'capture',source:{kind:'build_output',operationId:'build-11111111111111111111111111111111'}},review],
      ['diagnostics-read','diagnostics_read',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222'},review],
      ['diagnostics-stop','diagnostics_stop',{investigationId:investigation},routine],
      ['diagnostics-close','diagnostics_close',{investigationId:investigation},routine],
      ['diagnostics-remove','diagnostics_remove',{investigationId:investigation},destroy],
      ['diagnostics-future','diagnostics_future',{investigationId:investigation},review],
      ['diagnostics-analyze','diagnostics_analyze',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222',submissionId:'parse'},review],
      ['diagnostics-apple-symbolicate','diagnostics_analyze',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222',submissionId:'symbols',metadata:{symbolicate:true,symbols:[{kind:'dsym',evidenceId:'collector-44444444444444444444444444444444',sha256:'a'.repeat(64),buildId:'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',architecture:'arm64'}]}},review],
      ['diagnostics-apple-symbolicate-invalid','diagnostics_analyze',{investigationId:investigation,collectorId:'collector-22222222222222222222222222222222',submissionId:'symbols',metadata:{symbolicate:true,downloadSymbols:true}},review],
      ['diagnostics-analysis-status','diagnostics_analysis_status',{investigationId:investigation,analysisId:analysis},allow],
      ['diagnostics-analysis-status-malformed','diagnostics_analysis_status',{investigationId:investigation,analysisId:'../../private'},review],
      ['diagnostics-analysis-status-missing','diagnostics_analysis_status',{investigationId:investigation},review],
      ['diagnostics-analysis-cancel','diagnostics_analysis_cancel',{investigationId:investigation,analysisId:analysis},routine],
      ['diagnostics-query','diagnostics_query',{investigationId:investigation,analysisId:analysis,kind:'failure'},review],
      ['diagnostics-compare','diagnostics_compare',{investigationId:investigation,analysisId:analysis,otherInvestigationId:investigation,otherAnalysisId:analysis},review],
      ['diagnostics-capabilities','diagnostics_capabilities',{},allow],
      ['diagnostics-prepare','diagnostics_prepare',{component:'builtin-parser'},routine],
      ['diagnostics-prepare-unknown','diagnostics_prepare',{component:'perfetto'},review],
      ['diagnostics-prepare-missing','diagnostics_prepare',{},review],
      ['diagnostics-project','diagnostics_project',{investigationId:investigation,analysisId:analysis,scope:'all'},review],
      ['diagnostics-export','diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/report.json'},review],
      ...['perfetto','simpleperf','xctrace','stack_sample'].flatMap(backend=>['capture','import'].map(mode=>[`native-${backend}-${mode}`,'diagnostics_start',{investigationId:investigation,submissionId:'native',source:nativeSource(backend,mode)},review])),
      ['native-export','diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/native.trace',format:'native_artifact',scope:'all'},review],
      ['native-thread','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'timeline',nativeUpid:5,nativeUtid:3},review],
      ...['runtime-checks-v1','sanitizer-report-text'].map(format=>[`runtime-checks-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'checks',source:{kind:'import',path:'/outside/private/checks',format}},review]),
      ['runtime-checks-query','diagnostics_query',{investigationId:investigation,analysisId:analysis,kind:'failure',correlationId:'fault-1'},review],
      ...debugActions.map(action=>[`interactive-${action.kind}`,'browser_send',{targetId:'browser:acme',request:{operation:'page_debugger',page:debugPage,action}},change]),
      ['interactive-logpoint-shared','act',{targetId:'browser:acme',actions:[{action:'page_debugger',page:debugPage,input:{action:'logpoint_set',url:'https://example.com/app.js',line:4,marker:'Acme'}}]},review],
      ['interactive-native-unknown','debugger_attach',{targetId:'android:Acme',processId:42,adapter:'lldb'},review],
      ['diagnostic-build-inline','build_start',{project:'.',inline:{builder:'custom',platform:'android',target_kind:'emulator',custom:{command:['make','asan']},artifact:{path:'build/acme.apk'},diagnostics:{symbols:'external',profileable:true,sanitizers:['address'],coverage:false,probes:[],timing:'instrumented'}}},review],
      ['scenario-import','diagnostics_start',{investigationId:investigation,submissionId:'scenario',source:{kind:'import',path:'/outside/private/scenario.json',format:'scenario-context-v1'}},review],
      ['scenario-android-context','diagnostics_start',{investigationId:investigation,submissionId:'context',source:{kind:'android_state',targetId:'android:ACME',appId:'com.example.acme',userId:0,groups:['media','device_context']}},review],
      ...['summary','timeline','lifecycle','media','peripherals','energy','settings','restore'].map(operation=>[`scenario-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'scenario',scenario:{operation}},review]),
      ['scenario-malformed-active-restore','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'scenario',scenario:{operation:'restore',execute:true,activateCamera:true}},review],
      ...['network-evidence-v1','data-snapshot-v1','pcap'].map(format=>[`network-data-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'network-data',source:{kind:'import',path:'/outside/private/evidence',format}},review]),
      ...['requests','phases','messages','spans','logs','packets','correlate','data','schema','query_plan'].map(operation=>[`network-data-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'network_data',networkData:{operation,...(operation==='correlate'?{traceId:'11111111111111111111111111111111'}:operation==='data'?{collection:'orders',equals:{field:'state',value:null}}:{})}},review]),
      ['network-data-scoped-request','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'network_data',networkData:{operation:'correlate',requestId:'acme-request',identityScope:'app-epoch'}},review],
      ['network-data-malformed-sql','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'network_data',networkData:{operation:'data',sql:'DELETE FROM orders',decrypt:true,flush:true}},review],
      ...['ui-performance-v1','package-size-v1'].map(format=>[`performance-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'performance',source:{kind:'import',path:'/outside/private/performance.json',format}},review]),
      ...['summary','startup','frames','stages','interaction','trees','accessibility','gpu','sizes'].map(operation=>[`performance-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'performance',performance:{operation,...(operation==='accessibility'?{minTargetSize:44}:{})}},review]),
      ['performance-malformed','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'performance',performance:{operation:'frames',captureGpu:true,evaluate:'must-not-run'}},review],
      ...['java-hprof','memory-graph-v1','memory-series-v1'].map(format=>[`memory-${format}`,'diagnostics_start',{investigationId:investigation,submissionId:'memory',source:{kind:'import',path:'/outside/private/heap',format}},review]),
      ...['summary','classes','objects','object','edges','retainers','paths','dominators','series'].map(operation=>[`memory-${operation}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'memory',memory:{operation,...(['object','edges','retainers','paths'].includes(operation)?{objectId:'0x42'}:{})}},review]),
      ...['Allocations','Leaks'].flatMap(template=>[true,false].map(optIn=>[`memory-apple-${template}-${optIn}`,'diagnostics_start',{investigationId:investigation,submissionId:'memory',source:{kind:'native_trace',backend:'xctrace',mode:'capture',targetId:'device:ACME',appId:'com.example.acme',processId:42,template,allowAttach:true,allowAllocationRecording:optIn,allowHeapInspection:optIn}},review])),
      ['memory-malformed','diagnostics_query',{investigationId:investigation,analysisId:analysis,view:'memory',memory:{operation:'paths',evaluate:'must-not-run',forceGc:true}},review],
      ['native-export-missing-scope','diagnostics_export',{investigationId:investigation,analysisId:analysis,path:'/outside/native.trace',format:'native_artifact'},review],
      ['native-arbitrary-sql','diagnostics_start',{investigationId:investigation,submissionId:'native',source:{kind:'native_trace',sql:'SELECT readfile(secret)',command:'must-not-run'}},review],
      ...['timeline','call_tree','flamegraph'].map(view=>[`native-${view}`,'diagnostics_query',{investigationId:investigation,analysisId:analysis,view},review]),
    );
    cli.push(
      ['project-status',['testrun','project','status','ios-dev'],allow],
      ['project-status-outside',['testrun','project','status','ios-dev','--project','/outside/other'],review],
      ['project-start',['testrun','project','start','ios-dev','--task','server'],review],
      ['project-preflight',['testrun','project','start','ios-dev','--task','preflight'],review],
      ['project-open',['testrun','project','open','ios-dev','--target','simulator:ACME'],review],
      ['project-check',['testrun','project','start','ios-dev','--task','check','--check','pnpm'],review],
      ['build-log',['testrun','build','log','build-11111111111111111111111111111111','--offset','0','--limit','1024'],allow],
      ['build-prepare',['testrun','build','start','ios-dev','--prepare'],review],
      ['build-prepare-reordered',['testrun','--json','build','--target','device:ACME','start','--prepare','ios-dev'],review],
      ['project-unknown',['testrun','project','future'],review],
    );
    mcp.push(
      ['project-status','project_status',{project:'.',profile:'ios-dev'},allow],
      ['project-status-outside','project_status',{project:'/outside/other',profile:'ios-dev'},review],
      ['project-status-missing','project_status',{project:'.'},review],
      ['project-start','project_start',{project:'.',profile:'ios-dev',task:'server'},review],
      ['project-open','project_open',{project:'.',profile:'ios-dev',targetId:'simulator:ACME'},review],
      ['project-start-env','project_start',{project:'.',profile:'ios-dev',task:'prepare',env:{PATH:'/outside/bin'}},review],
      ['project-start-unknown','project_start',{project:'.',profile:'ios-dev',task:'future'},review],
      ['build-log','build_log',{operationId:'build-11111111111111111111111111111111'},allow],
      ['build-log-malformed','build_log',{operationId:'../../private'},review],
      ['build-prepare','build_start',{project:'.',profile:'ios-dev',prepare:true},review],
    );
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
