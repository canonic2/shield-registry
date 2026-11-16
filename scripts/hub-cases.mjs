// Independent expected decisions for canonic/hub, reviewed against hub 0.39.0.
// Keep these explicit rather than importing the policy's inventory or deriving
// expectations from its decisions.
const profiles = ['loose','recommended','strict'];
const allow = ['allow','allow','allow'];
const routine = ['allow','allow','ask'];
const execute = ['allow','ask','ask'];
const review = ['ask','ask','ask'];
const destroy = ['ask','ask','deny'];

const id = '11111111111111111111111111111111';
const prepare = {operation:id,generation:'22222222222222222222222222222222',request_id:'33333333333333333333333333333333'};
const mutation = {if_revision:3,request_id:id};

// Every current MCP tool with an ordinary request.
export const tools = [
  ['init',{},routine],
  ['config_check',{},allow],
  ['config_plan',{targets:['web']},allow],
  ['config_schema',{local:true},allow],
  ['setup',{agents:['claude','codex']},routine],
  ['workspace_create',{name:'feature',goal:'Ship Acme search'},routine],
  ['workspace_attach',{name:'review',path:'/outside/review'},routine],
  ['workspace_list',{removed:true},allow],
  ['workspace_show',{workspace:'feature'},allow],
  ['workspace_remove',{workspace:'feature'},routine],
  ['workspace_prepare',{workspace:'feature',...prepare},routine],
  ['workspace_data_reset',{workspace:'feature'},routine],
  ['task_show',{section:'summary'},allow],
  ['task_update',{goal:'Ship Acme search',...mutation},routine],
  ['task_history',{limit:10},allow],
  ['task_export',{format:'markdown'},allow],
  ['task_import',{changes:[{op:'note_add',text:'Acme'}],...mutation},routine],
  ['task_step_list',{},allow],
  ['task_step_next',{all:true},allow],
  ['task_step_add',{title:'Index',...mutation},routine],
  ['task_step_update',{step:'s1',status:'done',...mutation},routine],
  ['task_step_remove',{step:'s1',...mutation},routine],
  ['task_check_add',{text:'Tests pass',...mutation},routine],
  ['task_check_update',{check:'c1',state:'met',...mutation},routine],
  ['task_check_remove',{check:'c1',...mutation},routine],
  ['task_note_add',{text:'Acme',...mutation},routine],
  ['task_note_update',{note:'n1',text:'Acme',...mutation},routine],
  ['task_note_remove',{note:'n1',...mutation},routine],
  ['process_run',{targets:['web'],workspace:'feature'},routine],
  ['process_exec',{command:['node','scripts/check.mjs']},execute],
  ['process_stop',{workspace:'feature'},routine],
  ['process_list',{workspace:'feature',limit:10},allow],
  ['process_logs',{service:'web',stream:'stderr'},allow],
  ['process_url',{},allow],
  ['process_gateway_enable',{port:4780},routine],
  ['process_gateway_disable',{},routine],
  ['process_gateway_status',{},allow],
  ['agent_start',{kind:'codex',prompt:'Review Acme'},execute],
  ['agent_list',{refresh:true},allow],
  ['agent_show',{agent:'a1'},allow],
  ['agent_message',{agent:'a1',prompt:'Continue'},execute],
  ['agent_stop',{agent:'a1'},routine],
  ['plugin_list',{},allow],
  ['plugin_show',{plugin:'speckit'},allow],
  ['plugin_enable',{plugin:'speckit'},routine],
  ['plugin_disable',{plugin:'speckit'},routine],
  ['plugin_reset',{plugin:'speckit'},routine],
  ['plugin_binding_add',{plugin:'speckit',work:'specs/001-acme',...mutation},routine],
  ['plugin_binding_remove',{binding:'b1',...mutation},routine],
  ['plugin_binding_list',{workspace:'feature',limit:10},allow],
  ['plugin_context_show',{plugin:'speckit'},allow],
  ['plugin_prepare',{plugin:'speckit',command:['codex']},allow],
  ['plugin_workflow_run',{plugin:'speckit',workflow:'review',request_id:id},execute],
  ['plugin_workflow_resume',{operation:'o1',request_id:id},execute],
  ['plugin_workflow_list',{},allow],
  ['plugin_workflow_show',{operation:'o1'},allow],
  ['plugin_workflow_reconcile',{operation:'o1'},routine],
  ['plugin_workflow_abandon',{operation:'o1',reason:'reviewed'},routine],
  ['plugin_check',{plugin:'speckit',target:'test',check:'c1',request_id:id},routine],
  ['status',{},allow],
  ['doctor',{},allow],
  ['manager_status',{},allow],
  ['manager_stop',{},routine],
  ['manager_drain',{},routine],
  ['manager_blocker_list',{limit:10},allow],
  ['operation_list',{workspace:'feature',limit:10},allow],
  ['operation_show',{id:'o1'},allow],
  ['operation_cancel',{id:'o1',reason:'reviewed'},routine],
  ['docs_list',{limit:10},allow],
  ['docs_search',{query:'workspace'},allow],
  ['docs_read',{path:'workspaces.md'},allow],
];

const previews = ['setup','workspace_remove','task_update','task_import','task_step_add','task_step_update','task_step_remove',
  'task_check_add','task_check_update','task_check_remove','task_note_add','task_note_update','task_note_remove',
  'plugin_enable','plugin_disable','plugin_reset','plugin_binding_add','plugin_binding_remove',
  'plugin_workflow_run','plugin_workflow_resume','plugin_check'];
const docs = tools.splice(-3);
for (const source of previews) tools.push([`${source}_preview`,structuredClone(tools.find(([tool]) => tool === source)[1]),allow]);
tools.push(...docs);

const mcp = [
  ...tools.map(([tool,arguments_,expected]) => [`tool-${tool}`,tool,arguments_,expected]),
  // Continuations are opaque and validated by Hub, not permission selectors.
  ...['workspace_list','process_list','operation_list','manager_blocker_list','agent_list',
    'plugin_list','plugin_binding_list','plugin_workflow_list','task_show','task_step_list',
    'task_step_next','task_history','task_export','process_url','process_logs','docs_list','docs_search','docs_read']
    .flatMap(tool => [
      [`paged-${tool}`,tool,{...tools.find(([name]) => name === tool)[1],cursor:'opaque-cursor',limit:1},allow],
      [`malformed-page-${tool}`,tool,{cursor:7,limit:0},allow],
    ]),
  // Missing required fields keep the operation decision; Hub refuses the call.
  ['docs-read-missing-path','docs_read',{},allow],
  ['docs-search-missing-query','docs_search',{},allow],
  // Retained older documentation arguments; see the guide's retirement ledger.
  ['legacy-docs-list-offset','docs_list',{offset:0,limit:10},allow],
  ['legacy-docs-read-lines','docs_read',{path:'workspaces.md',start_line:1,end_line:20},allow],
  // Selection, configuration files, options and malformed arguments are Hub's
  // to validate; they keep the operation's decision.
  ['project-other','task_show',{project:'/outside/other'},allow],
  ['project-workspace-checkout','process_run',{project:'/outside/acme-feature',targets:['web']},routine],
  ['project-malformed','workspace_list',{project:7},allow],
  ['config-file','process_run',{targets:['web'],config:'/outside/hub.yml',set_env:['NODE_ENV=test']},routine],
  ['setup-agent-config','setup',{agent_config:'/outside/.hub/config.yml',repair_hooks:true},routine],
  ['setup-preview','setup',{dry_run:true},routine],
  ['create-path','workspace_create',{name:'feature',path:'/outside/acme-feature',provider:'gate',repo_from:{a:'HEAD'}},routine],
  ['create-cached-source','workspace_create',{name:'optimization',from:'HEAD',source:'feature',copy_source:'main',no_fetch:true},routine],
  ['create-malformed-source','workspace_create',{name:'optimization',source:7,no_fetch:'yes'},routine],
  ['prepare-malformed','workspace_prepare',{workspace:'feature',generation:'not-a-generation'},routine],
  ['run-detach','process_run',{targets:['web'],detach:true,wait_ms:0},routine],
  ['stop-self','process_stop',{workspace:'feature',allow_self_stop:true},routine],
  ['plugin-preview','plugin_workflow_run',{plugin:'speckit',workflow:'review',request_id:id,dry_run:true},execute],
  // MCP removal is confirmed by the host user; only irreversible options are reviewed.
  ['remove-preview','workspace_remove',{workspace:'feature',dry_run:true},routine],
  ['remove-keep','workspace_remove',{workspace:'feature',keep:['data']},routine],
  ['remove-self','workspace_remove',{workspace:'feature',allow_self_stop:true},routine],
  ['remove-discard','workspace_remove',{workspace:'feature',discard_changes:true},destroy],
  ['remove-forget','workspace_remove',{workspace:'feature',forget:true},destroy],
  ['remove-discard-malformed','workspace_remove',{workspace:'feature',discard_changes:'true'},routine],
  ['exec-borrowed','process_exec',{command:['curl','http://127.0.0.1:4780'],execution:'e1'},execute],
  ['agent-start-silent','agent_start',{kind:'claude',host:'unix:///outside/control.sock'},execute],
  // Unknown names may be newer operations; Box names are unknown to Hub.
  ...['future_tool','process_shell','plugin_launch','workspace_cleanup','recover','conversation_message','box_docs_read']
    .map(tool => [`unknown-${tool}`,tool,{},execute]),
];

const cli = [
  // Help, version and inspection.
  ['version',['hub','--version'],allow],
  ['help',['hub','help','workspace'],allow],
  ['command-help',['hub','process','exec','--help'],allow],
  ['status',['hub','--json','status'],allow],
  ['doctor',['hub','doctor'],allow],
  ['workspace-list',['hub','workspace','list','--removed','--label','acme'],allow],
  ['workspace-show',['hub','workspace','--json','show','--workspace','acme#feature'],allow],
  ['process-list',['hub','process','list','-w','feature','--cursor','opaque-cursor','--limit','1'],allow],
  ['operation-list',['hub','operation','list','--workspace=feature','--limit=10'],allow],
  ['manager-blocker-list',['hub','--json','manager','blocker','list','--limit','100'],allow],
  ['plugin-binding-list',['hub','plugin','binding','list','--workspace','feature','--cursor','opaque-cursor'],allow],
  ['process-list-malformed',['hub','process','list','--limit','0','--cursor'],allow],
  ['task-show',['hub','task','show','--section','summary','-w','feature'],allow],
  ['task-step-next',['hub','task','step','next','--all'],allow],
  ['task-export',['hub','task','export','--output','/outside/task.json','--overwrite'],allow],
  ['agent-list',['hub','agent','list','--refresh'],allow],
  ['logs-follow',['hub','process','logs','--operation','o1','--follow'],allow],
  ['config-plan',['hub','config','plan','web','--set-env','NODE_ENV=test'],allow],
  ['docs-read',['hub','docs','read','workspaces.md','--start-line','1'],allow],
  ['docs-read-cursor',['hub','docs','read','workspaces.md','--cursor','opaque-cursor','--limit','20'],allow],
  ['docs-search-cursor',['hub','docs','search','workspace','--path','workspaces.md','--cursor','opaque-cursor','--limit','10'],allow],
  ['plugin-prepare',['hub','plugin','prepare','speckit','--','codex'],allow],
  ['auth-list',['hub','mcp','auth','list'],allow],
  ['serve',['hub','mcp','serve'],allow],
  ['serve-check',['hub','mcp','serve','--check'],allow],
  ['other-project',['hub','--project','/outside/other','status'],allow],
  ['other-config',['hub','--config','/outside/hub.yml','config','check'],allow],
  ['data-reset-inventory',['hub','workspace','data-reset','-w','feature'],allow],
  // Ordinary changes.
  ['init',['hub','init','--provider','gate'],routine],
  ['setup',['hub','setup','--agent','claude','--agent','codex','--repair-hooks'],routine],
  ['setup-preview',['hub','setup','--dry-run','--json'],routine],
  ['mcp-setup',['hub','mcp','setup','--agent','codex','--reset-tool-permissions'],routine],
  ['auth-setup',['hub','mcp','auth','setup','slack','--yes'],routine],
  ['auth-logout',['hub','mcp','auth','logout','slack'],routine],
  ['auth-headers',['hub','mcp','auth','headers'],routine],
  ['app-create',['hub','mcp','app','create','slack'],routine],
  ['task-update',['hub','task','update','--if-revision','3','--goal','Ship Acme search'],routine],
  ['task-update-file',['hub','task','update','--if-revision','3','--goal-file','notes/goal.md'],routine],
  ['task-import',['hub','task','import','--if-revision','3','--file','changes.json','--mode','merge'],routine],
  ['step-update-file',['hub','task','step','update','s1','--if-revision','3','--description-file','notes/step.md'],routine],
  ['check-update',['hub','task','check','update','c1','--if-revision','3','--state','met','--evidence','Tests pass'],routine],
  ['note-add',['hub','task','note','add','--if-revision','3','--text','Acme'],routine],
  ['create',['hub','workspace','create','feature','--goal','Ship Acme search','--check','Tests pass'],routine],
  ['create-cached-source',['hub','workspace','create','optimization','--from','HEAD','--source','feature','--copy-source','main','--no-fetch'],routine],
  ['create-cached-goal-file',['hub','workspace','create','optimization','--no-fetch','--source','feature','--copy-source','main','--goal-file','notes/goal.md'],routine],
  ['create-cached-sensitive-file',['hub','workspace','create','optimization','--no-fetch','--source','feature','--copy-source','main','--goal-file','.ssh/config'],review],
  ['create-path',['hub','workspace','create','feature','--path','../acme-feature','--provider','gate','--repo-from','a=HEAD'],routine],
  ['attach',['hub','workspace','attach','review','/outside/review'],routine],
  ['prepare',['hub','workspace','prepare','-w','feature','--operation',id,'--generation',id,'--request-id',id],routine],
  ['remove',['hub','workspace','remove','-w','feature'],routine],
  ['remove-keep',['hub','workspace','remove','-w','feature','--keep','data','--allow-self-stop'],routine],
  ['remove-preview',['hub','workspace','remove','--dry-run'],routine],
  ['run',['hub','process','run','web','api','-w','acme#feature','--detach','--set-env','NODE_ENV=production'],routine],
  ['stop-self',['hub','process','stop','--allow-self-stop'],routine],
  ['gateway-enable',['hub','process','gateway','enable','--port','4780'],routine],
  ['agent-stop',['hub','agent','stop','a1'],routine],
  ['operation-cancel',['hub','operation','cancel','o1','--reason','reviewed'],routine],
  ['manager-drain',['hub','manager','drain'],routine],
  ['plugin-enable',['hub','plugin','enable','speckit','--local'],routine],
  ['plugin-check',['hub','plugin','check','speckit','test','--check','c1','--request-id',id],routine],
  ['unknown',['hub','unknown-operation'],execute],
  ['box-recover',['hub','recover'],execute],
  // Self-confirmed or irreversible deletion.
  ['remove-confirm',['hub','workspace','remove','-w','feature','--confirm','digest'],destroy],
  ['remove-confirm-attached',['hub','--json','workspace','remove','--workspace=feature','--confirm=digest'],destroy],
  ['remove-discard',['hub','workspace','remove','--discard-changes'],destroy],
  ['remove-forget',['hub','workspace','remove','-w','feature','--forget'],destroy],
  ['remove-option-confirm-token',['hub','workspace','remove','-w','--confirm'],routine],
  ['data-reset-confirm',['hub','workspace','data-reset','-w','feature','--confirm','digest'],destroy],
  // Arbitrary programs and other agents.
  ['exec',['hub','process','exec','--','node','scripts/check.mjs'],execute],
  ['exec-json',['hub','--json','process','exec','-w','feature','--request-id',id,'--','make','test'],execute],
  ['shell',['hub','process','shell','-w','feature'],execute],
  ['current-shell',['hub','shell','-w','feature'],execute],
  ['shell-command',['hub','shell','--execution','e1','--','node','scripts/check.mjs'],execute],
  ['shell-options',['hub','--config','/outside/hub.yml','shell','--shell','/bin/sh','--timeout-ms','1000'],execute],
  ['create-shell',['hub','workspace','create','feature','--shell'],execute],
  // Raw `--` command forms ask in every profile.
  ['shortcut',['hub','--','rm','-rf','/outside'],review],
  ['shortcut-empty',['hub','--'],review],
  ['shortcut-json',['hub','--json','--','codex'],review],
  ['shortcut-project',['hub','--project','.','--','codex'],review],
  ['shortcut-workspace',['hub','-w','feature','--','codex'],execute],
  ['shortcut-config',['hub','--config','/outside/hub.yml','--','codex'],execute],
  ['other-config-run',['hub','--agent-config','/outside/config.yml','process','run','web'],routine],
  ['shortcut-workspace-long',['hub','--workspace=feature','--','rm','-rf','/outside'],execute],
  ['create-command',['hub','workspace','create','feature','--','codex'],review],
  ['create-command-json',['hub','workspace','--json','create','feature','--','rm','-rf','/outside'],review],
  ['plugin-launch',['hub','plugin','launch','speckit','--','codex'],execute],
  ['workflow-run',['hub','plugin','workflow','run','speckit','review','--request-id',id],execute],
  ['agent-start',['hub','agent','start','codex','--prompt','Review Acme'],execute],
  ['agent-start-file',['hub','agent','start','codex','--prompt-file','notes/prompt.md'],execute],
  ['agent-message',['hub','agent','message','a1','--prompt','Continue'],execute],
  // Named files in credential or agent-settings locations, or outside the approved roots.
  ['task-update-env',['hub','task','update','--if-revision','3','--goal-file','.env'],review],
  ['task-update-ssh',['hub','task','update','--if-revision','3','--description-file','.ssh/id_ed25519'],review],
  ['task-update-outside',['hub','task','update','--if-revision','3','--goal-file','/outside/secrets.txt'],review],
  ['task-import-agent-settings',['hub','task','import','--if-revision','3','--file','.claude/settings.json'],review],
  ['create-goal-git',['hub','workspace','create','feature','--goal-file','.git/config'],review],
  ['agent-message-shield',['hub','agent','message','a1','--prompt-file','.shield/policy.yml'],review],
];

export function binding(transport = {type:'defaults',pack:'canonic/hub',integration:'hub'}, server = 'hub') {
  return {[server]:{transport,agents:{codex:server},packs:{'canonic/hub':'hub'}}};
}

export function hubCases() {
  const cases = [];
  for (const [index,profile] of profiles.entries()) {
    for (const [label,argv,expected] of cli) cases.push({name:`cli-${label}-${profile}`,profile,argv,expected:expected[index]});
    for (const [label,tool,arguments_,expected] of mcp) cases.push({name:`mcp-${label}-${profile}`,profile,mcp:binding(),
      input:{kind:'mcp',server:'hub',tool,arguments:arguments_,original_input:{}},expected:expected[index]});
    for (const command of ['hub','/usr/local/bin/hub','/opt/homebrew/bin/hub','/Users/acme/.local/bin/hub','/home/acme/.local/bin/hub'])
      cases.push({name:`transport-${command.replaceAll('/','-')}-${profile}`,profile,
        mcp:binding({type:'stdio',command,args:['mcp','serve'],env:{}}),
        input:{kind:'mcp',server:'hub',tool:'task_show',arguments:{},original_input:{}},expected:'allow'});
    cases.push({name:`alias-${profile}`,profile,mcp:binding(undefined,'workspaces'),
      input:{kind:'mcp',server:'workspaces',tool:'process_exec',arguments:{command:['make']},original_input:{}},expected:execute[index]});
  }
  return {schema_version:1,cases};
}
