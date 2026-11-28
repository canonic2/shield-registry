// Current product surfaces extend frozen 0.2.1 releases without rewriting them.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {toolPack} from './tool-pack.mjs';
import {box} from './box-policy.mjs';
import {gate,gateRemoteChanges} from './gate-policy.mjs';
import {testrun} from './testrun-policy.mjs';
import {currentToolCases} from './current-tool-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';
import {addPreviewTools} from './dry-run-tools.mjs';
import {testrunHomeInstallPack,trustedTestrunPack,trustedTestrunGuide} from './testrun-trusted-policy.mjs';

export const currentToolVersions = {box:'0.2.8', gate:'0.2.12', testrun:'0.2.16'};
export const currentDirectory = (name, version = currentToolVersions[name]) =>
  new URL(`../packs/canonic/${name}/${version}/`, import.meta.url);
const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const allow = profiles('allow');
const routine = profiles('allow', 'allow', 'ask');
const review = profiles('ask');
const change = profiles('allow', 'ask', 'ask');
const destroy = profiles('ask', 'ask', 'deny');
const categories = {inspect:allow, routine, change, integration:change, execute:review, destroy, folder:review, unlisted:review};

function extend(pack, original, commands, mcpTools) {
  const added = toolPack({...original, commands, mcpTools, exacts:[], risks:[],
    profileDecisions:categories, activeProjectAdjustments:true});
  const existing = new Set(pack.rules.map(rule => rule.id));
  for (const rule of added.rules) {
    if (existing.has(rule.id) || rule.id === 'project-option') continue;
    if (pack.id === 'canonic/gate' && rule.conditions.domain === 'argv' && rule.conditions.cwd) {
      const template = pack.rules.find(rule => rule.id === 'relocate');
      rule.requirements = structuredClone(template.requirements);
      rule.on_unmet = {decision: Object.fromEntries(Object.entries(rule.decision)
        .map(([profile, value]) => [profile, value === 'deny' ? 'deny' : 'ask'])), message:template.on_unmet.message};
    }
    pack.rules.push(rule);
  }
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  fallback.conditions.tool.not.one_of = [...new Set([
    ...fallback.conditions.tool.not.one_of, ...Object.keys(mcpTools),
  ])];
}

function separatePreview(pack, id) {
  // Prefix and option rules can share a rank: make mutation and preview
  // disjoint instead of expecting a weaker preview to defeat a mutation.
  const preview = pack.rules.find(rule => rule.id === `${id}-dry-run`);
  const grammar = preview.conditions.arguments;
  grammar.values = [...new Set([...grammar.values, '--option','--root','--workspace',
    '--binding','--if-digest','--request-id','--timeout-ms','--input','--confirm','--resume','--repo'])];
  grammar.flags = [...new Set([...grammar.flags, '--local','--all-repos','--all','--untracked','--abandon'])];
  const base = pack.rules.find(rule => rule.id === id);
  base.conditions.arguments = structuredClone(grammar);
  delete base.conditions.arguments.require_any;
  base.conditions.arguments.forbid = ['--dry-run'];
}

function mcpRule(pack, id, tool, decision, fields, requirements) {
  const rule = {id, conditions:{domain:'mcp', server:pack.id.split('/')[1], tool,
    ...(fields ? {fields} : {})}, decision,
    reason:'Keep current operation effects within their reviewed permission boundary.'};
  if (requirements) Object.assign(rule, {requirements,
    on_unmet:{decision:'ask', message:'Review unsupported or incomplete action arguments.'}});
  pack.rules.push(rule);
  return rule;
}

function updateBox(pack) {
  const reads = ['plugin list','plugin show','plugin context show','plugin prepare','plugin workflow list','plugin workflow show'];
  const local = ['plugin binding add','plugin binding remove'];
  const administrative = ['plugin enable','plugin disable','plugin reset','plugin workflow reconcile','plugin workflow abandon'];
  const execution = ['plugin launch','plugin workflow run','plugin workflow resume'];
  const commands = [
    ...['project list','workspace runtime list','manager blocker list','docs list','docs search','docs read']
      .map(words => [words.split(' '),'inspect','Read a bounded page of recorded state or bundled documentation.']),
    [['workspace','prepare'],'routine','Continue a blocked checkout with revised selection, preserving its task and rejecting unresolved provider effects.'],
    ...['remove','cleanup'].map(verb => [['workspace',verb], 'destroy', 'Discard selected workspace resources.', [
      {id:'discard', any:['--discard-changes'], values:['--confirm','--request-id'], category:'destroy',
        reason:'Permanently discard uncommitted checkout files after confirmation.'},
    ]]),
    ...reads.map(words => [words.split(' '),'inspect','Inspect plugin state or prepare a handoff without executing it.']),
    ...local.map(words => [words.split(' '),'routine','Edit revisioned workspace bindings without running external code.']),
    ...administrative.map(words => [words.split(' '),'change','Change plugin configuration or acknowledge retained workflow state.']),
    ...execution.map(words => [words.split(' '),'execute','Launch an external native tool or workflow.']),
    [['plugin','check'],'routine','Run one finite recipe command and retain its evidence.'],
  ];
  const tools = Object.fromEntries(commands.filter(([words]) => words.join(' ') !== 'plugin launch' && words[0] !== 'docs')
    .map(([words, category, reason]) => [words.join('_'),[category,reason]]));
  tools.config_show = ['inspect','Inspect redacted effective agent configuration and publication state without writing.'];
  for (const name of ['project_list','workspace_runtime_list','manager_blocker_list'])
    tools[name] = ['inspect','Read recorded state or bundled documentation without starting services.'];
  tools.setup = ['integration','Choose agents and publish configuration through an exact host-confirmed review.',[
    {id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Preview agent registration and optional hook repair without writing.'}]];
  tools.config_sync = ['integration','Review and publish agent configuration.',[
    {id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Inspect publication without writing.'}]];
  for (const name of ['plugin_enable','plugin_disable','plugin_reset','plugin_workflow_run','plugin_workflow_resume','plugin_check']) {
    tools[name][2] = [{id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Prepare without state or process effects.'}];
    const command = commands.find(([words]) => words.join('_') === name);
    command.push([{id:'dry-run', any:['--dry-run'], category:'inspect', reason:'Prepare without effects.'}]);
  }
  extend(pack, box, commands, tools);
  // Declare value-bearing log options so their values cannot impersonate
  // --follow. Keep the retired max-bytes spelling for installed older tools.
  const logFollow = pack.rules.find(rule => rule.id === 'logs-follow');
  logFollow.conditions.arguments.values = [...new Set([
    ...logFollow.conditions.arguments.values, '--cursor','--limit','--max-bytes',
    '--workspace','--operation','--service','--stream',
  ])];
  logFollow.conditions.arguments.flags.push('--from-start');
  // The frozen CLI `box mcp setup` already owns the rule ID mcp-setup.
  // Keep its decision and give the new MCP setup tool a distinct rule ID.
  mcpRule(pack,'mcp-tool-setup','setup',change);
  const prepare = pack.rules.find(rule => rule.id === 'mcp-workspace_prepare');
  prepare.requirements = {fields:{
    '/workspace':{text:{not:{exact:''}}},
    ...Object.fromEntries(['operation','generation','request_id'].map(field => [`/${field}`,{text:{regex:'[0-9a-f]{32}'}}])),
  }};
  prepare.on_unmet = {decision:'ask',message:'Review a preparation missing its exact workspace, operation, generation or retry identity.'};
  for (const name of ['plugin-enable','plugin-disable','plugin-reset','plugin-workflow-run','plugin-workflow-resume','plugin-check'])
    separatePreview(pack,name);
  mcpRule(pack,'mcp-workspace_remove-discard','workspace_remove',destroy,{'/discard_changes':{exact:true}});
  mcpRule(pack,'mcp-workspace_cleanup-discard','workspace_cleanup',destroy,{'/discard_changes':{exact:true}});
  // Box workspace removal deletes the checkout, merged created branches, data
  // and finished command history unless the request keeps them. Only a preview
  // or keeping every resource deletes nothing. Older Box kept every resource on
  // a plain removal; the pack cannot tell versions apart, so that form is
  // tightened as well. Cleanup names stay for older installed versions.
  // Missing fields never match, so the deletion decision applies to every call
  // at the identity rank. A literal preview or keep-everything request outranks
  // it; other options keep their stronger rules.
  const keepAll = ['checkout','branches','data'];
  mcpRule(pack,'mcp-workspace_remove-delete','workspace_remove',destroy)
    .reason = 'Delete the workspace checkout, branches and data it does not keep.';
  mcpRule(pack,'mcp-workspace_remove-dry-run','workspace_remove',allow,{'/dry_run':{exact:true}})
    .reason = 'Assess workspace resources without deleting them.';
  mcpRule(pack,'mcp-workspace_remove-keep-all','workspace_remove',change,{'/keep':{exact:keepAll}})
    .reason = 'Remove a workspace registration, keeping its checkout, branches and data.';
  // Ending this session does not lower the deletion decision.
  mcpRule(pack,'mcp-workspace_remove-self-delete','workspace_remove',review,{'/allow_self_stop':{exact:true}},
    {fields:{'/keep':{exact:keepAll}}}).on_unmet = {decision:destroy,
    message:'Review a removal that ends this session and deletes workspace resources.'};
  const discard = pack.rules.find(rule => rule.id === 'workspace-remove-discard');
  const deletion = structuredClone(discard);
  deletion.id = 'workspace-remove-delete';
  Object.assign(deletion.conditions.arguments, {flags:['--json','--dry-run'], values:['--project'], forbid:['--dry-run']});
  delete deletion.conditions.arguments.require_any;
  deletion.reason = 'Delete the workspace checkout, branches and data it does not keep.';
  // A CLI preview keeps the frozen registration decision: that prefix rule's
  // working-folder check gives it the same rank as any option rule.
  pack.rules.push(deletion);
  // Selector conflicts are rejected by Box before recovery; they cannot borrow
  // the ordinary Loose allowance, including with an explicit project.
  pack.capabilities = [...new Set([...pack.capabilities,'field-negation-v1'])].sort();
  for (const selector of ['operation','generation'])
    mcpRule(pack,`mcp-recover-workspace-${selector}-conflict`,'recover',review,{
      '/workspace':{not:{exact:null}}, [`/${selector}`]:{not:{exact:null}},
    });
  // Manager ownership does not reduce arbitrary execution effects. Retain the
  // frozen exec/shell Ask decisions and the explicit immediate-self-stop rules.
  // Gate project selection before ranking ordinary rules. A passing gate must
  // not compete with preview/mutation rules or grant arbitrary execution.
  const projectRules = pack.rules.filter(rule => rule.conditions.domain === 'mcp'
    && rule.conditions.fields?.['/project']);
  pack.preconditions = projectRules.map(rule => ({
    id:rule.id,
    conditions:{domain:'mcp',server:'box',tool:rule.conditions.tool,
      fields:{'/project':{not:{exact:null}}}},
    requires_any:[{field_paths:{'/project':{absolute:true,path:{exact:{root:'project'}}}}}],
    on_unmet:{decision:rule.decision,message:'Review project selection that does not resolve to the enrolled checkout.'},
    reason:'An explicit current-checkout path keeps the ordinary operation decision.',
  }));
  // A failed project gate replaces ordinary rules, so retain any stronger
  // destructive Deny branch as a matching project precondition as well.
  for (const rule of pack.rules) {
    if (projectRules.includes(rule) || rule.conditions.domain !== 'mcp') continue;
    const gate = pack.preconditions.find(row => row.conditions.tool === rule.conditions.tool);
    if (!gate || !Object.keys(rule.decision).some(profile => rule.decision[profile] === 'deny'
      && gate.on_unmet.decision[profile] !== 'deny')) continue;
    pack.preconditions.push({...structuredClone(gate),id:`${rule.id}-project-boundary`,
      conditions:{...structuredClone(rule.conditions),fields:{...rule.conditions.fields,'/project':{not:{exact:null}}}},
      on_unmet:{...gate.on_unmet,decision:Object.fromEntries(Object.keys(rule.decision)
        .map(profile => [profile,rule.decision[profile] === 'deny' ? 'deny' : gate.on_unmet.decision[profile]]))}});
  }
  pack.rules = pack.rules.filter(rule => !projectRules.includes(rule));
  // Box publishes only docs_*; retired aliases receive the unknown-tool review.
  const retiredDocs = ['box_docs_list','box_docs_search','box_docs_read'];
  pack.rules = pack.rules.filter(rule => !retiredDocs.includes(rule.conditions.tool));
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  fallback.conditions.tool.not.one_of = fallback.conditions.tool.not.one_of
    .filter(name => !retiredDocs.includes(name));
  pack.capabilities = [...new Set([...pack.capabilities,'field-paths-v1','preconditions-v1'])].sort();
}

function updateGate(pack) {
  extend(pack, gate, [
    [['setup'],'execute','Initialize a repository worktree or change agent registrations.',[
      {id:'dry-run',any:['--dry-run'],values:['--agent','--scope','--config'],
        flags:['--no-agents','--remove','--tool-permissions','--reset-tool-permissions'],
        category:'inspect',reason:'Inspect the worktree and exact registration plan.'}]],
    ...['list','search','read'].map(verb =>
      [['docs',verb],'inspect','Read bundled documentation without accessing host files.']),
    [['rename'],'inspect','Review a repository ID migration.',[
      {id:'confirm', any:['--confirm'], values:['--confirm'], category:'change', reason:'Apply the exact reviewed migration.'}]],
    // Without --dry-run, discard may prompt and apply even without --confirm.
    [['discard'],'destroy','Discard selected staged and working changes.',[
      {id:'dry-run', any:['--dry-run'], category:'inspect', reason:'Inspect the discard inventory without changes.'}]],
    [['remote'],'inspect','List approved remote bindings.'],
    [['remote','list'],'inspect','List approved remote bindings.'],
    [['remote','get-url'],'inspect','Show the verified URL of an approved remote.'],
    ...gateRemoteChanges.flatMap(([verbs,,effect]) => verbs.map(verb =>
      [['remote',verb],'inspect','Review a change to a bound remote.',[
        {id:'confirm', any:['--confirm'], values:['--confirm','--config','--repo'],
          flags:['--dry-run'], category:'destroy', reason:effect}]])),
  ], {
    remote_list:['inspect','List approved remote bindings without contacting them.'],
    add_preview:['inspect','Inspect owned staging without publishing the index.'],
    apply_preview:['inspect','Inspect a patch or check applicability without staging it.'],
    commit_preview:['inspect','Inspect the proposed commit without running hooks.'],
    fetch_preview:['change','Contact an approved remote and preview tracking changes.'],
    push_preview:['change','Contact an approved remote and preview publication.'],
    rename:['change','Rename a repository ID after exact host confirmation.'],
    discard:['destroy','Discard selected staged and working changes after confirmation.',[
      {id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Inspect selected changes without discarding them.'}]],
    ...Object.fromEntries(gateRemoteChanges.map(([,tool,effect]) => [tool,['destroy',effect]])),
  });
  // Bare `remote` lists only with options. An unlisted remote subcommand
  // keeps the ordinary unknown-operation decision.
  const remote = pack.rules.find(rule => rule.id === 'remote');
  remote.conditions.arguments = {
    kind:'options',prefix:['remote'],leading:remote.conditions.arguments.leading,
    flags:['--json','-v','--verbose'],values:['--project','--config','-r','--repo','--cursor','--limit'],operands:false,
  };
  separatePreview(pack,'setup');
  const setupPath = pack.rules.find(rule => rule.id === 'setup-dry-run').requirements.argument_paths;
  setupPath.grammar = structuredClone(pack.rules.find(rule => rule.id === 'setup-dry-run').conditions.arguments);
  delete setupPath.grammar.require_any;
  setupPath.options['--config'] = structuredClone(setupPath.options['--project']);
  setupPath.options['--config'].path.within.root = 'read';
  mcpRule(pack,'mcp-project-setup','setup',review);
  mcpRule(pack,'mcp-project-setup-preview','setup_preview',allow);
  const config = structuredClone(pack.rules.find(rule => rule.id === 'mcp-status-project').requirements.field_paths['/project']);
  mcpRule(pack,'mcp-project-setup-preview-config','setup_preview',allow,{'/config':{not:{exact:null}}},
    {field_paths:{'/config':config}});
  pack.rules.find(rule => rule.id === 'mcp-unlisted').conditions.tool.not.one_of.push('setup','setup_preview');
  separatePreview(pack,'discard');
  const template = pack.rules.find(rule => rule.id === 'mcp-status-project');
  const remoteTools = gateRemoteChanges.map(([,tool]) => tool);
  const confirmedChange = profiles('allow', 'allow', 'deny');
  for (const [name, decision, outside] of [
    ['rename', routine, review],
    ...remoteTools.map(tool => [tool, confirmedChange, destroy]),
  ]) {
    const base = pack.rules.find(rule => rule.id === `mcp-${name}`);
    base.decision = decision;
    const rule = pack.rules.find(rule => rule.id === `mcp-${name}-project`);
    rule.decision = decision;
    rule.requirements = structuredClone(template.requirements);
    rule.requirements.field_paths['/project'].path.within.root = 'write';
    rule.on_unmet = {decision:outside, message:'Review explicit project paths outside approved roots.'};
  }
  const discard = pack.rules.find(rule => rule.id === 'mcp-discard');
  discard.decision = confirmedChange;
  discard.reason = 'Gate obtains user confirmation of the exact discard plan before applying it.';
  pack.rules = pack.rules.filter(rule => rule.id !== 'mcp-discard-project');
  const discardProject = structuredClone(template.requirements);
  discardProject.field_paths['/project'].path.within.root = 'write';
  mcpRule(pack,'mcp-rename-dry-run','rename',change,{'/dry_run':{exact:true}});
  mcpRule(pack,'mcp-rename-project-dry-run','rename',review,{
    '/dry_run':{exact:true}, '/project':{not:{exact:null}},
  });
  const discardChanges = {'/discard_changes':{exact:true}};
  const removeBranch = {'/remove_branch':{exact:true}};
  mcpRule(pack,'mcp-worktree_remove-discard','worktree_remove',confirmedChange,discardChanges);
  mcpRule(pack,'mcp-worktree_remove-discard-dry-run','worktree_remove',destroy,{
    ...discardChanges, '/dry_run':{exact:true},
  });
  // This pack also matches older Gate binaries. Keep host approval where an
  // older removal or preview can perform branch cleanup without its own form.
  mcpRule(pack,'mcp-worktree_remove-branch','worktree_remove',review,removeBranch);
  mcpRule(pack,'mcp-worktree_remove-discard-and-branch','worktree_remove',destroy,{...discardChanges,...removeBranch});
  mcpRule(pack,'mcp-worktree_remove_preview-branch','worktree_remove_preview',review,removeBranch);
  const removal = pack.rules.find(rule => rule.id === 'worktree-remove-confirm');
  const risky = structuredClone(removal);
  risky.id = 'worktree-remove-discard';
  risky.conditions.arguments.require_any = ['--discard-changes'];
  risky.conditions.arguments.flags.push('--discard-changes','--remove-branch');
  risky.decision = destroy;
  risky.reason = 'Review worktree removal that can discard uncommitted files.';
  // Gate 0.33.0 can remove branches during a replay even without --confirm.
  const branch = structuredClone(risky);
  branch.id = 'worktree-remove-branch';
  branch.conditions.arguments.require_any = ['--remove-branch'];
  branch.conditions.arguments.forbid = ['--discard-changes'];
  branch.decision = review;
  branch.reason = 'Review branch cleanup, which older Gate can apply on a completed removal.';
  pack.rules.push(risky, branch);
  // Gate names .gate/worktrees/<name> as its in-project worktree location. It
  // takes the decision and path checks of the retained .gate/tasks rule.
  const taskFolder = pack.rules.findIndex(rule => rule.id === 'mcp-worktree_add-task-folder');
  const worktreeFolder = structuredClone(pack.rules[taskFolder]);
  worktreeFolder.id = 'mcp-worktree_add-worktree-folder';
  worktreeFolder.conditions.fields['/path'].text.regex = '\\.gate/worktrees/[A-Za-z0-9_][A-Za-z0-9_.-]*';
  worktreeFolder.reason = 'Create a combined worktree under .gate/worktrees.';
  pack.rules.splice(taskFolder + 1, 0, worktreeFolder);
  // A resume digest identifies a saved plan. Both CLI rules still check
  // the destination as a writable operand.
  for (const id of ['worktree-add', 'worktree-add-folder']) {
    const rule = pack.rules.find(candidate => candidate.id === id);
    rule.requirements.argument_paths.grammar.values.push('--resume');
    if (rule.conditions.arguments.kind === 'options') {
      rule.conditions.arguments.values.push('--resume');
    }
  }
  // Keep reviewed gate_docs_* permissions, the .gate/tasks worktree folder, and the relocate, worktree repair
  // and worktree_repair permissions, for older installed Gate versions until
  // their documented retirement windows have elapsed.
  declarePolicyFile(pack);
  allowEverydayGate(pack);
  pack.preconditions.push({id:'mcp-discard-project-write',
    conditions:{domain:'mcp',server:'gate',tool:'discard',fields:{'/project':{not:{exact:null}}}},
    requires_any:[discardProject],
    on_unmet:{decision:destroy,message:'Select a project inside approved writable roots.'},
    reason:'An explicit discard project needs writable scope.'});
  gateRemovalPathChecks(pack);
  gateInputFileChecks(pack);
  pack.description = 'Gate repository workflows allowed by default inside the project, with explicit remote, data-loss, ownership and policy-acceptance boundaries.';
}

function gateInputFileChecks(pack) {
  const reason = 'Gate reads the selected patch, message or pathspec from a host file.';
  const on_unmet = {decision:'ask',message:'Use a file inside an approved read root and outside protected folders.'};
  const read = {path:structuredClone(pack.rules.find(rule => rule.id === 'mcp-status-project')
    .requirements.field_paths['/project'].path)};
  for (const [tools,field] of [[['apply','apply_preview'],'patch'],[['commit','commit_preview'],'file']]) {
    for (const tool of tools) pack.preconditions.push({id:`mcp-${tool}-input-file`,reason,on_unmet,
      conditions:{domain:'mcp',server:'gate',tool,fields:{[`/${field}`]:{not:{exact:null}}}},
      requires_any:[{field_paths:{[`/${field}`]:{...read,relative_to:'project'}}}],
    });
  }
  for (const [command,files,flags,values,optional_values] of [
    ['add',['--pathspec-from-file'],['-A','--all','-u','--update','-p','--patch','-f','--force','-n','--dry-run','-N','--intent-to-add','--pathspec-file-nul'],['--chmod'],[]],
    ['commit',['-F','--file'],['-a','--all','--amend','--no-edit','--reset-author','-s','--signoff','-S','--no-gpg-sign','--allow-empty','--dry-run'],['-m','--message','-C','--reuse-message'],['--gpg-sign','--sign']],
    ['apply',[],['--cached','--recount','--check','--stat','--numstat','--summary','-R','--reverse'],[],[]],
  ]) {
    const base = pack.rules.find(rule => rule.id === command);
    const grammar = {kind:'options',prefix:[command],leading:base.conditions.arguments.leading,
      flags:['--json',...flags],values:['--project','--config','-r','--repo',...files,...values],optional_values,operands:true,unknown_options:'skip'};
    const selection = files.length ? {options:Object.fromEntries(files.map(file => [file,read]))} : {operands:read};
    // Gate's literal `-` reads stdin. An alternative must match every input
    // value, so an additional named input still gets checked as a file.
    const stdin = {...grammar};
    if (files.length) {
      stdin.values = grammar.values.map(value => files.includes(value) ? {name:value,match:{exact:'-'}} : value);
      stdin.require_any = files;
    } else {
      delete stdin.unknown_options;
      stdin.operands = {match:{exact:'-'},min:1,max:1};
    }
    pack.preconditions.push({id:`${command}-input-file`,reason,on_unmet,
      conditions:{domain:'argv',executable:base.conditions.executable,arguments:{kind:'prefix',values:[command],leading:grammar.leading}},
      requires_any:[{argument_paths:{grammar,...selection}},{arguments:stdin}],
    });
  }
}

function gateRemovalPathChecks(pack) {
  const destination = pack.rules.find(rule => rule.id === 'worktree-add-folder')
    .requirements.argument_paths.operands;
  for (const id of ['worktree-remove', 'worktree-remove-confirm', 'worktree-remove-discard',
    'worktree-remove-branch']) {
    const rule = pack.rules.find(candidate => candidate.id === id);
    const arguments_ = rule.requirements.argument_paths;
    arguments_.operands = structuredClone(destination);
    arguments_.operands.path.within.root = id === 'worktree-remove' ? 'read' : 'write';
    if (rule.decision.strict === 'deny') rule.on_unmet.decision = destroy;
  }
  const paths = pack.rules.find(rule => rule.id === 'mcp-worktree_remove-project').requirements.field_paths;
  for (const [tool, access, fields, decision] of [
    ['worktree_remove','write',{'/discard_changes':{exact:true}},destroy],
    ['worktree_remove_preview','read',{'/path':{not:{exact:null}}},review],
  ]) {
    const explicit = structuredClone(paths);
    explicit['/project'].path.within.root = access;
    explicit['/path'].path.within.root = access;
    const implicit = {...explicit['/path']};
    delete implicit.absolute;
    const gate = {id:`mcp-${tool}-destination`, reason:'Review worktree destinations outside approved roots.',
      conditions:{domain:'mcp',server:'gate',tool,fields},
      requires_any:[{field_paths:{'/path':implicit}}],
      on_unmet:{decision,message:'Select a worktree inside approved roots.'}};
    pack.preconditions.push(gate, {...gate, id:`${gate.id}-explicit-project`,
      conditions:{...gate.conditions, fields:{...fields,'/project':{not:{exact:null}}}},
      requires_any:[{field_paths:explicit}]});
  }
}

// Gate's global `--config PATH` (MCP `config`) names the policy file Gate reads
// instead of gate.yml. Gate refuses a file other than the accepted one until
// `gate sync` accepts it, and sync keeps its own review, so the option only
// needs declaring wherever `--project` is: each command keeps its own decision.
function declarePolicyFile(pack) {
  const declare = grammar => {
    for (const phase of [grammar?.leading, grammar?.kind === 'options' ? grammar : undefined])
      if (phase?.values?.includes('--project') && !phase.values.includes('--config')) phase.values.push('--config');
  };
  for (const rule of pack.rules.filter(rule => rule.conditions.domain === 'argv')) {
    declare(rule.conditions.arguments);
    declare(rule.requirements?.argument_paths?.grammar);
  }
}

// Gate 0.2.6 allows everyday use by default and reviews known-harmful forms.
// Earlier releases asked for any Gate command, option or MCP tool the pack did
// not list. Here, inside the approved project:
//
// - an unlisted command or option is allowed in Loose and Recommended, while an
//   explicit `--project` outside the approved roots or in a protected folder,
//   and Gate run from outside the project, still ask;
// - an unknown MCP tool is allowed in Loose and Recommended;
// - Loose allows `commit --amend`, and Recommended allows removing a clean
//   worktree with `--confirm`, as its MCP tool already does.
//
// CLI discard, forced branch deletion, force-push, session deletion, discarding
// worktree removal, staging ignored files, remote binding, policy acceptance
// and migration keep their decisions. Strict still asks for anything unlisted.
// Path checks skip undeclared options. `--force` is declared because the
// shared grammar lists only `-f`, and `gate add --force` failed its check in
// Loose while `-f` passed.
export function widenGrammar(grammar) {
  grammar.unknown_options = 'skip';
  if (grammar.flags.includes('-f') && !grammar.flags.includes('--force')) grammar.flags.push('--force');
}
export const gateRelaxed = {
  'commit-amend': {decision:{loose:'allow'}},
  'mcp-commit-amend': {decision:{loose:'allow'}},
  'worktree-remove-confirm': {decision:{recommended:'allow'}},
  'unlisted': {decision:{loose:'allow', recommended:'allow'},
    reason:'Unlisted Gate commands and options inside the approved project are everyday use; Strict reviews them.'},
  'mcp-unlisted': {decision:{loose:'allow', recommended:'allow'},
    reason:'Unknown Gate MCP tools are everyday use; Strict reviews them.'},
};
function allowEverydayGate(pack) {
  for (const [id, {decision, reason}] of Object.entries(gateRelaxed)) {
    const rule = pack.rules.find(rule => rule.id === id);
    Object.assign(rule.decision, decision);
    if (reason) rule.reason = reason;
  }
  // A grammar that refuses undeclared options would turn a new option into an
  // unmet path check; skip it, so its value is still path-checked as an operand.
  for (const rule of pack.rules) {
    const grammar = rule.requirements?.argument_paths?.grammar;
    if (grammar?.kind === 'options' && grammar.operands === true) widenGrammar(grammar);
  }
  projectBoundary(pack);
}

// The unlisted rules rank below every listed rule, so the project boundary that
// the listed rules check for themselves is gated once, before ranking, for
// every request. A failed gate replaces the pack's rules, so each Deny branch
// gets its own gate that keeps that Deny.
function projectBoundary(pack) {
  const message = 'Run Gate inside the approved project, and select a project inside the approved roots and outside protected folders.';
  const reason = 'Gate inside the approved project keeps the ordinary operation decision.';
  const kept = decision => Object.fromEntries(Object.entries(decision)
    .map(([profile, value]) => [profile, value === 'deny' ? 'deny' : 'ask']));
  const denies = rule => Object.values(rule.decision).includes('deny');
  const argv = pack.rules.filter(rule => rule.conditions.domain === 'argv');
  const status = pack.rules.find(rule => rule.id === 'status');
  const executable = structuredClone(status.conditions.executable);
  const gates = [{id:'gate-folder', reason, conditions:{domain:'argv', executable, arguments:{kind:'any'}},
    requires_any:[{cwd:{within:{root:'read'}}}], on_unmet:{decision:'ask', message}}];
  // Commands that change files keep needing a writable folder.
  const writing = new Map();
  for (const rule of argv) if (rule.conditions.cwd?.within?.root === 'write' && rule.conditions.arguments.kind === 'prefix')
    writing.set(JSON.stringify(rule.conditions.arguments.values), rule);
  for (const rule of writing.values()) {
    const conditions = structuredClone(rule.conditions);
    delete conditions.cwd;
    gates.push({id:`${rule.id}-write-folder`, reason, conditions,
      requires_any:[{cwd:{within:{root:'write'}}}], on_unmet:{decision:'ask', message}});
  }
  const grammar = structuredClone(status.requirements.argument_paths.grammar);
  const project = [{argument_paths:{grammar, options:{'--project':structuredClone(status.requirements.argument_paths.options['--project'])}}}];
  gates.push({id:'gate-project-option', reason, conditions:{domain:'argv', executable:structuredClone(executable),
    arguments:{...structuredClone(grammar), require_any:['--project']}},
    requires_any:project, on_unmet:{decision:'ask', message}});
  for (const rule of argv.filter(denies)) {
    const conditions = structuredClone(rule.conditions);
    conditions.arguments.require_all = [...(conditions.arguments.require_all ?? []), '--project'];
    gates.push({id:`${rule.id}-project-boundary`, reason, conditions,
      requires_any:structuredClone(project), on_unmet:{decision:kept(rule.decision), message}});
  }
  const projectPath = pack.rules.find(rule => rule.id === 'mcp-status-project').requirements.field_paths['/project'];
  const mcpProject = [{field_paths:{'/project':structuredClone(projectPath)}}];
  const present = {'/project':{not:{exact:null}}};
  // Documentation tools read only bundled guides and take no project.
  const docs = pack.rules.find(rule => rule.id === 'mcp-unlisted').conditions.tool.not.one_of
    .filter(tool => tool.includes('docs_'));
  gates.push({id:'mcp-project', reason,
    conditions:{domain:'mcp', server:'gate', tool:{not:{one_of:docs}}, fields:structuredClone(present)},
    requires_any:mcpProject, on_unmet:{decision:'ask', message}});
  for (const rule of pack.rules.filter(rule => rule.conditions.domain === 'mcp' && denies(rule)))
    gates.push({id:`${rule.id}-project-boundary`, reason,
      conditions:{...structuredClone(rule.conditions), fields:{...rule.conditions.fields, ...present}},
      requires_any:structuredClone(mcpProject), on_unmet:{decision:kept(rule.decision), message}});
  pack.preconditions = gates;
  pack.capabilities = [...new Set([...pack.capabilities, 'field-negation-v1', 'preconditions-v1'])];
}

function updateTestrun(pack) {
  extend(pack, testrun, [
    ...['list','search','read'].map(verb =>
      [['docs',verb],'inspect','Read embedded Testrun documentation without host-file access.']),
    [['init'],'execute','Review detected application projects and create project configuration without overwriting existing files.'],
    [['project','discover'],'inspect','Inspect application candidates without running project code or writing files.'],
    [['project','list'],'inspect','List configured applications.'],
    [['project','show'],'inspect','Inspect one application configuration.'],
    [['project','status'],'inspect','Inspect configured Expo and optional app inventory.',[
      {id:'project',any:['--project'],values:['--project'],category:'folder',reason:'Review explicit project selection.'}]],
    [['project','start'],'execute','Run a project-declared command, server or composed build.'],
    [['project','open'],'execute','Launch the selected app and open its configured development URL.'],
    [['build','log'],'inspect','Read the private retained operation log.'],
    [['diagnostics','open'],'routine','Create a private retained investigation without attaching to an app.'],
    [['diagnostics','status'],'inspect','Inspect diagnostic ownership and retained progress.'],
    [['diagnostics','start'],'execute','Collect private evidence. Native traces run trusted converters, finite system/CPU recording or explicit attach, including separate Apple allocation recording/heap inspection opt-ins, and create private artifacts. RN can run a fixed probe/control Hermes profilers or take over a debugger; Dart reads service credentials and can allocate/dispose inspector groups. Embedded CDP attaches a selected borrowed page and enables observation without enabling its endpoint. Host snapshots read one selected native process; Box reads exact retained operation logs without service lifecycle control. ADB can start its server.'],
    [['diagnostics','read'],'execute','Expose private captured bytes, which may contain application secrets.'],
    [['diagnostics','stop'],'routine','Stop owned diagnostic readers without stopping their source command.'],
    [['diagnostics','close'],'routine','Close an investigation and stop its owned readers, retaining evidence.'],
    [['diagnostics','remove'],'destroy','Delete only closed, settled investigation records and their owned evidence.'],
    [['diagnostics','analyze'],'execute','Parse retained private evidence and publish a derived index; explicit Apple symbolication materializes retained symbol files and runs UUID/architecture verification plus atos.'],
    [['diagnostics','analysis-status'],'inspect','Inspect retained analysis lifecycle and provenance without captured content.'],
    [['diagnostics','analysis-cancel'],'routine','Cancel an owned parser process, preserving original evidence.'],
    [['diagnostics','query'],'execute','Expose private diagnostic evidence, remote telemetry and exact trace joins, test results and retained-evidence assertions; imported identities and associations are not authority or causal proof.'],
    [['diagnostics','compare'],'execute','Read private retained analyses and compare declared scope and measurements.'],
    [['diagnostics','capabilities'],'inspect','Inspect static diagnostic effects, scope, costs and dependency metadata without starting helpers.'],
    [['diagnostics','plan'],'inspect','Plan bounded reproduction collectors and existing fault/fixture owners without source reads, execution or readiness probes.'],
    [['diagnostics','prepare'],'routine','Verify only the bundled parser through a bounded owned process; no installation or downloads.'],
    [['diagnostics','project'],'execute','Expose scoped numeric evidence that omits free text but can remain sensitive.'],
    [['diagnostics','export'],'execute','Write an explicit redacted report page or unredacted native trace artifact outside private retention without overwriting different bytes.'],
  ], {
    project_discover:['inspect','Detect project candidates and preview configuration without running project code or writing files.'],
    project_init:['execute','Create selected project configuration only after a matching initialization preview digest.'],
    project_list:['inspect','List named applications without starting runtimes.'],
    project_show:['inspect','Inspect redacted named application configuration.'],
    project_status:['inspect','Inspect the selected project and Expo without running project commands.'],
    project_start:['execute','Execute project-declared preparation, server, check or build commands.'],
    project_open:['execute','Launch the selected app and open its configured development URL.'],
    build_log:['inspect','Read a bounded private retained operation log.'],
    diagnostics_open:['routine','Create private investigation metadata without attachment.'],
    diagnostics_start:['execute','Collect private evidence. Native traces run trusted converters, finite system/CPU recording or explicit attach, including separate Apple allocation recording/heap inspection opt-ins, and create private artifacts. RN can run a fixed probe/control Hermes profilers or take over a debugger; Dart reads service credentials and can allocate/dispose inspector groups. Embedded CDP attaches a selected borrowed page and enables observation without enabling its endpoint. Host snapshots read one selected native process; Box reads exact retained operation logs without service lifecycle control. ADB can start its server.'],
    diagnostics_status:['inspect','Inspect retained diagnostic ownership and progress.'],
    diagnostics_read:['execute','Expose private retained collector content.'],
    diagnostics_stop:['routine','Stop only owned collectors, preserving source commands and evidence.'],
    diagnostics_close:['routine','Close an investigation and stop its readers, preserving evidence.'],
    diagnostics_remove:['destroy','Delete a closed and settled investigation and its owned evidence.'],
    diagnostics_analyze:['execute','Run a bounded private parser; optional explicit Apple symbolication reads retained artifacts, creates private temporary copies and runs dwarfdump/atos after UUID/architecture checks.'],
    diagnostics_analysis_status:['inspect','Inspect retained analysis state without captured content.'],
    diagnostics_analysis_cancel:['routine','Stop only an owned parser, preserving evidence.'],
    diagnostics_query:['execute','Expose private diagnostic evidence, remote telemetry and exact trace joins, test results and retained-evidence assertions; imported identities and associations are not authority or causal proof.'],
    diagnostics_compare:['execute','Expose private retained analysis measurements and compatibility.'],
    diagnostics_capabilities:['inspect','Inspect static effects, limits and dependency metadata without source access.'],
    diagnostics_plan:['inspect','Plan bounded reproduction presets, effects and existing cleanup owners without executing actions or probing targets.'],
    diagnostics_prepare:['routine','Verify only the bundled parser without installing tools or changing app/device state.'],
    diagnostics_project:['execute','Expose a scoped numeric projection; numeric/timing data can remain sensitive.'],
    diagnostics_export:['execute','Publish a projection page or explicitly selected unredacted native trace artifact to a caller-owned host file.'],
  });
  for (const id of ['diagnostics-start','mcp-diagnostics_start']) {
    pack.rules.find(rule=>rule.id===id).reason += ' Configured observability reads one explicit private config/optional bearer file and sends one bounded GET which can incur provider query cost; no refresh, stronger credential fallback, retry, redirect or mutation.';
  }
  for (const id of ['diagnostics-query','mcp-diagnostics_query']) {
    pack.rules.find(rule=>rule.id===id).reason += ' Investigation/report views read up to four retained private analyses; caller hypotheses are not causal proof.';
  }
  for (const id of ['diagnostics-export','mcp-diagnostics_export']) {
    pack.rules.find(rule=>rule.id===id).reason += ' Investigation JSON/Markdown exports require an explicit path and scope; minimal reports omit text/identities, explicit private reports retain sensitive text. No automatic upload or overwrite of different bytes.';
  }
  const reproductionPlan=pack.rules.find(rule=>rule.id==='diagnostics-plan');
  reproductionPlan.conditions.arguments={kind:'options',prefix:['diagnostics','plan'],leading:testrun.leading,flags:['--json'],values:['--platform','--options'],operands:true,require_any:['--platform']};
  const reproductionMcp=pack.rules.find(rule=>rule.id==='mcp-diagnostics_plan');
  reproductionMcp.requirements={fields:{'/preset':{text:{one_of:['crash','hang','memory_growth','slow_interaction','startup','network','background_media','soak']}},'/platform':{text:{one_of:['android','ios','browser','import']}}}};
  reproductionMcp.on_unmet={decision:'ask',message:'Review an unknown or incomplete diagnostic preset/platform selection.'};
  const initPreview=structuredClone(pack.rules.find(rule=>rule.id==='init'));
  const prepareParser=pack.rules.find(rule=>rule.id==='diagnostics-prepare');
  prepareParser.conditions.arguments={kind:'options',prefix:['diagnostics','prepare','builtin-parser'],leading:testrun.leading,flags:['--json'],values:['--version'],operands:false};
  const prepareParserMcp=pack.rules.find(rule=>rule.id==='mcp-diagnostics_prepare');
  prepareParserMcp.requirements={fields:{'/component':{exact:'builtin-parser'}}};
  prepareParserMcp.on_unmet={decision:'ask',message:'Only the bundled parser self-check has this preparation permission.'};
  initPreview.id='init-dry-run';
  const initGrammar={kind:'options',prefix:['init'],leading:testrun.leading,flags:['--json','--yes','--dry-run'],values:['--root','--path','--kind','--platform','--config'],operands:false};
  pack.rules.find(rule=>rule.id==='init').conditions.arguments={...initGrammar,forbid:['--dry-run']};
  initPreview.conditions.arguments={...initGrammar,require_any:['--dry-run']};
  initPreview.requirements={cwd:{within:{root:'write'}},argument_paths:{grammar:initGrammar,options:{'--root':{path:{within:{root:'read'}}},'--path':{path:{within:{root:'read'}}},'--config':{path:{within:{root:'read'}}}}}};
  initPreview.decision=allow;
  initPreview.on_unmet={decision:'ask',message:'Review initialization discovery outside approved read roots.'};
  pack.rules.push(initPreview);
  const discovery=pack.rules.find(rule=>rule.id==='mcp-project_discover');
  discovery.requirements={field_paths:{'/root':{relative_to:'project',path:{within:{root:'read'}}}}};
  discovery.on_unmet={decision:'ask',message:'Select a project discovery root inside approved read roots.'};
  mcpRule(pack,'mcp-project_init-preview','project_init',allow,{'/dryRun':{exact:true}},{field_paths:{'/root':{relative_to:'project',path:{within:{root:'read'}}}}});
  for (const name of ['project_list','project_show']) {
    const rule=pack.rules.find(rule=>rule.id===`mcp-${name}`);
    rule.requirements={field_paths:{'/root':{relative_to:'project',path:{within:{root:'read'}}}},...(name==='project_show'?{fields:{'/project':{text:{regex:'[a-z][a-z0-9-]{0,63}'}}}}:{})};
    rule.on_unmet={decision:'ask',message:'Select a configuration root inside approved read roots and a symbolic project.'};
  }
  for (const name of ['config_check','config_show','config_schema','project_status']) {
    mcpRule(pack,`mcp-${name}-root`,name,allow,{'/root':{text:{not:{exact:''}}}},{field_paths:{'/root':{relative_to:'project',path:{within:{root:'read'}}}}});
  }
  // Explicit roots have filesystem meaning; project IDs do not.
  for (const words of [['project','list'],['project','show'],['project','status'],['config','check'],['config','show'],['config','schema']]) {
    const rule=structuredClone(pack.rules.find(rule=>rule.id===words.join('-')));
    rule.id=`${words.join('-')}-root`;
    rule.conditions.arguments={kind:'options',prefix:words,leading:testrun.leading,flags:['--json','--local'],values:['--root','--profile','--offset','--cursor','--limit','--version','--target','--config'],operands:true,unknown_options:'skip',require_any:['--root']};
    rule.requirements={cwd:{within:{root:'write'}},argument_paths:{grammar:{kind:'options',prefix:words,leading:testrun.leading,flags:['--json','--local'],values:['--root','--profile','--offset','--cursor','--limit','--version','--target','--config'],operands:true,unknown_options:'skip'},options:{'--root':{path:{within:{root:'read'}}}}}};
    rule.decision=allow;
    rule.on_unmet={decision:'ask',message:'Review explicit configuration roots outside approved read roots.'};
    pack.rules.push(rule);
  }
  const status = pack.rules.find(rule=>rule.id==='mcp-project_status');
  status.requirements={fields:{'/profile':{text:{not:{exact:''}}}},field_paths:{'/project':{relative_to:'project',path:{within:{root:'read'}}}}};
  const namedStatus=pack.rules.find(rule=>rule.id==='mcp-project_status-root');
  namedStatus.requirements.fields={'/project':{text:{regex:'[a-z][a-z0-9-]{0,63}'}},'/profile':{text:{not:{exact:''}}}};
  mcpRule(pack,'mcp-build_start-root','build_start',review,{'/root':{text:{not:{exact:''}}}});
  const namedBuild=structuredClone(pack.rules.find(rule=>rule.id==='build-start-inline'));
  namedBuild.id='build-start-root';
  namedBuild.conditions.arguments.values=[...new Set([...namedBuild.conditions.arguments.values,'--root','--app'])];
  namedBuild.conditions.arguments.require_any=['--root','--app'];
  namedBuild.decision=review;
  pack.rules.push(namedBuild);
  status.on_unmet={decision:'ask',message:'Select a profile and project inside approved read roots.'};
  pack.capabilities=[...new Set([...pack.capabilities,'field-paths-v1'])].sort();
  const log=pack.rules.find(rule=>rule.id==='mcp-build_log');
  const diagnosticStatus=pack.rules.find(rule=>rule.id==='mcp-diagnostics_status');
  diagnosticStatus.requirements={fields:{'/investigationId':{text:{regex:'diag-[0-9a-f]{32}'}}}};
  diagnosticStatus.on_unmet={decision:'ask',message:'Select a valid retained investigation.'};
  const analysisStatus=pack.rules.find(rule=>rule.id==='mcp-diagnostics_analysis_status');
  analysisStatus.requirements={fields:{'/investigationId':{text:{regex:'diag-[0-9a-f]{32}'}},'/analysisId':{text:{regex:'analysis-[0-9a-f]{32}'}}}};
  analysisStatus.on_unmet={decision:'ask',message:'Select valid retained investigation and analysis references.'};
  log.requirements={fields:{'/operationId':{text:{regex:'build-[0-9a-f]{32}'}}}};
  log.on_unmet={decision:'ask',message:'Select a valid retained operation.'};
  mcpRule(pack,'mcp-build_start-prepare','build_start',review,{'/prepare':{exact:true}});
  const preparation=structuredClone(pack.rules.find(rule=>rule.id==='build-start-inline'));
  preparation.id='build-start-prepare';
  preparation.conditions.arguments.flags=['--prepare'];
  preparation.conditions.arguments.values=[];
  preparation.conditions.arguments.require_any=['--prepare'];
  preparation.decision=review;
  pack.rules.push(preparation);
  // Public `act` now also routes arbitrary browser operations. Keep the existing
  // mobile workflow, but require review for browser/file/network action batches.
  const mobile = ['tap','swipe','long_press','key','type_text','app_launch','app_terminate','app_restart','open_url','delay'];
  const base = pack.rules.find(rule => rule.id === 'mcp-act');
  base.requirements = {fields:{'/actions/0/action':{text:{one_of:mobile}}}};
  base.on_unmet = {decision:'ask', message:'Review browser batches and incomplete action arguments.'};
  for (let index = 0; index < 8; index++) {
    mcpRule(pack,`mcp-act-action-${index}`,'act',routine,
      {[`/actions/${index}`]:{not:{exact:null}}},
      {fields:{[`/actions/${index}/action`]:{text:{one_of:mobile}}}});
  }
  mcpRule(pack,'mcp-act-overflow','act',review,{'/actions/8':{not:{exact:null}}});
  // Browser launch has caller-selected context settings. Keep shared and legacy
  // entry points at the same review boundary rather than borrowing device input.
  mcpRule(pack,'mcp-connect-browser','connect',review,{'/engine':{text:{not:{exact:''}}}});
  for (const id of ['mcp-browser_connect','browser-connect'])
    pack.rules.find(rule => rule.id === id).decision = review;
  const cli = structuredClone(pack.rules.find(rule => rule.id === 'act-environment'));
  cli.id = 'act-browser-target';
  cli.conditions.arguments = {kind:'options', leading:{flags:['--json'],values:['--target'],interleaved:true},
    prefix:['act'],flags:[],values:['--target'],operands:true,require_any:['--target']};
  // CLI JSON is opaque; explicit targets can select browser actions. Review the
  // whole targeted form rather than scanning serialized JSON for safe names.
  cli.decision = review;
  cli.reason = 'An explicit target may select a browser batch with host or network effects.';
  pack.rules.push(cli);
  const connect = structuredClone(pack.rules.find(rule => rule.id === 'connect'));
  connect.id = 'connect-browser';
  connect.conditions.arguments = {kind:'options',leading:{flags:['--json'],values:['--target'],interleaved:true},
    prefix:['connect'],flags:[],values:['--engine'],operands:true,require_any:['--engine'],unknown_options:'skip'};
  connect.decision = review;
  pack.rules.push(connect);
  // An engine marker with no value is invalid CLI input, but must not fall
  // back to the mobile connection allowance. The value rule above owns the
  // attached --engine=... spelling; this guard owns the bare marker.
  const marker = structuredClone(connect);
  marker.id = 'connect-browser-marker';
  marker.conditions.arguments.flags = ['--engine'];
  marker.conditions.arguments.values = [];
  pack.rules.push(marker);
  // A route_fulfill `path` makes the manager read a host file into the page.
  // That leaves the isolated-browser allowance and keeps host-transfer review.
  pack.rules.push({id:'mcp-browser_send-callback-file', decision:{...change},
    conditions:{domain:'mcp',server:'testrun',tool:'browser_send',fields:{
      '/request/operation':{exact:'callback_resolve'},'/request/response/path':{not:{exact:null}}}},
    reason:'Serve a host file to the page from a route callback.'});
  testrunConfigurationPaths(pack);
}

// Configuration selection is a path effect, independent of output/paging options.
// These guards also cover options placed before a config/project subcommand.
function testrunConfigurationPaths(pack) {
  const template = pack.rules.find(rule => rule.id === 'project-list');
  const path = root => ({path:{within:{root}}});
  pack.preconditions ??= [];
  pack.capabilities = [...new Set([...pack.capabilities,'preconditions-v1'])].sort();
  // --config is global within these groups, so it may precede the verb.
  // Preconditions below still parse its path, independently of rule matching.
  for (const rule of pack.rules) {
    const arguments_ = rule.conditions.arguments;
    if (!['config','project'].includes((arguments_?.prefix ?? arguments_?.values)?.[0])) continue;
    for (const grammar of [arguments_,rule.requirements?.argument_paths?.grammar]) {
      if (!grammar?.leading) continue;
      grammar.leading = {...grammar.leading,interleaved:true,
        values:[...new Set([...grammar.leading.values,'--config'])]};
    }
  }
  for (const [id,prefix,options] of [
    ['config',['config'],{'--project':path('read'),'--root':path('read'),'--config':path('read')}],
    ['config-init',['config','init'],{'--project':path('write'),'--root':path('write'),'--config':path('write')}],
    ['project',['project'],{'--project':path('read'),'--root':path('read'),'--path':path('read'),'--config':path('read')}],
    ['build',['build','start'],{'--project':path('write'),'--root':path('write'),'--config':path('read')}],
  ]) {
    const grammar = {kind:'options',prefix,leading:testrun.leading,operands:true,unknown_options:'skip',
      flags:['--json','--local','--all','--install','--launch','--replace','--boot','--no-wait','--prepare'],
      values:['--target','--project','--root','--path','--config','--profile','--app','--cursor','--limit','--offset',
        '--version','--task','--check','--submission-id','--inline','--set-env','--configuration','--variant',
        '--flavor','--entry-point','--mode','--timeout-ms','--launch-arg','--launch-env']};
    if (id==='config-init') grammar.leading = {...testrun.leading,interleaved:true,
      values:[...testrun.leading.values,'--project','--root','--config']};
    pack.preconditions.push({id:`cli-${id}-paths`,
      conditions:{domain:'argv',executable:structuredClone(template.conditions.executable),
        arguments:{...grammar,require_any:Object.keys(options)}},
      requires_any:[{argument_paths:{grammar,options}}],
      on_unmet:{decision:'ask',message:'Select configuration files and project paths inside approved roots.'},
      reason:'Explicit configuration and discovery paths must respect the host filesystem boundary.'});
  }
  for (const tool of ['config_check','config_show','config_schema','build_start','project_list','project_show',
    'project_status','project_start','project_open','project_discover','project_init','project_init_preview']) {
    pack.preconditions.push({id:`mcp-${tool}-config-file`,
      conditions:{domain:'mcp',server:'testrun',tool,fields:{'/config':{not:{exact:null}}}},
      requires_any:[{field_paths:{'/config':{relative_to:'project',...path('read')}}}],
      on_unmet:{decision:'ask',message:'Select a configuration file inside approved read roots.'},
      reason:'A caller-selected configuration file is read from the host.'});
  }
  for (const field of ['root','project','config']) {
    pack.preconditions.push({id:`mcp-config_init-${field}-path`,
      conditions:{domain:'mcp',server:'testrun',tool:'config_init',fields:{[`/${field}`]:{not:{exact:null}}}},
      requires_any:[{field_paths:{[`/${field}`]:{relative_to:'project',...path('write')}}}],
      on_unmet:{decision:'ask',message:'Create configuration only inside approved write roots.'},
      reason:'Configuration initialization writes the selected file and its local ignore entry.'});
  }
}

export async function currentToolPack(name) {
  let pack = JSON.parse(await readFile(new URL('pack.yml',currentDirectory(name,'0.2.1'))));
  pack.version = currentToolVersions[name];
  ({box:updateBox, gate:updateGate, testrun:updateTestrun})[name](pack);
  addPreviewTools(pack, name);
  if (name === 'gate') {
    pack.engines.shield = '>=0.60.0, <1.0.0';
    // Treat the default install as the same executable across decisions and path checks.
    for (const rule of [...pack.rules, ...pack.preconditions]) {
      const executable = rule.conditions.executable;
      if (executable?.one_of?.includes('gate')) {
        rule.conditions.executable = {one_of:[...executable.one_of, '~/.local/bin/gate']};
      }
    }
  }
  if (name === 'testrun') pack = trustedTestrunPack(pack);
  const fields = pack.mcp_integrations[name].fields;
  delete fields['/args/0'];
  delete fields['/args/1'];
  fields['/args'] = {exact:['mcp','serve']};
  return name === 'testrun' ? testrunHomeInstallPack(pack) : pack;
}

export async function buildCurrentToolPacks(names = Object.keys(currentToolVersions)) {
  for (const name of names) {
    if (!Object.hasOwn(currentToolVersions,name)) throw new Error(`Unknown current tool pack: ${name}`);
    const directory = currentDirectory(name);
    await mkdir(directory,{recursive:true});
    const pack = await currentToolPack(name);
    await writeFile(new URL('pack.yml',directory),JSON.stringify(pack,null,2)+'\n');
    for (const [file, cases] of splitCaseFiles(await currentToolCases(name)))
      await writeFile(new URL(file,directory),JSON.stringify(cases,null,2)+'\n');
    const inventory = {schema_version:1,commands:[{name,rule_ids:pack.rules
      .filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]};
    await writeFile(new URL('commands.json',directory),JSON.stringify(inventory,null,2)+'\n');
    await copyFile(new URL('../LICENSE',import.meta.url),new URL('LICENSE',directory));
    if (name === 'testrun') {
      await writeFile(new URL('README.md',directory),`# Testrun permissions ${currentToolVersions[name]}\n\nRequires Shield \`${pack.engines.shield}\`.\n\n${trustedTestrunGuide()}`);
      continue;
    }
    if (name !== 'box') {
      const previous = {gate:'0.2.7',testrun:'0.2.9'}[name];
      await writeFile(new URL('README.md',directory), `# ${name === 'gate' ? 'Gate' : 'Testrun'} permissions ${currentToolVersions[name]}

Requires Shield \`${pack.engines.shield}\`.

Use the separately named \`*_preview\` tools to inspect a proposed operation.
Local previews are Allow in every profile within approved roots. Network
previews and retained branch-cleanup forms have separate decisions described
below. Approved-root and stdio connection boundaries apply. Unknown tool names
keep their fallback.

${name === 'gate' ? 'Bundled CLI `docs list|search|read` and MCP `docs_list|docs_search|docs_read`\nare Allow in every profile with opaque `cursor` and `limit`. Gate validates\nqueries, page names and paging arguments without acquiring host-file access.\nThe former MCP `offset` and `start_line` forms retain their permissions and\nindependent fixtures. Their first verified absence is this 2026-11-15 source\ncheckout (0.26.1); Gate has no published feature release starting retirement.\nRemoval remains deferred until three subsequent published feature releases.\n' : ''}

${name === 'gate' ? gateCurrentGuide() : ''}

All other coverage, supported older interfaces and retirement constraints remain
as described in [${previous}](../${previous}/README.md). No coverage is retired.
${name === 'gate' ? '\nGate status supports `--entries-only` and MCP `entries_only: true` to return public\nrepository navigation entries without inspecting working changes. It remains a\nread-only Allow operation in every profile; independent fixtures cover both forms.\n' : ''}

${name === 'gate' ? gatePushDestinationGuide() : ''}
${name === 'gate' ? gateRemoteGuide() : ''}
${name === 'gate' ? gateConfirmationGuide() : ''}
${name === 'gate' ? gateParityGuide() : ''}
Regenerate with \`node scripts/build-current-tool-packs.mjs ${name}\` and validate
with \`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs\`.
`);
    }
  }
}
function gateCurrentGuide() {
  return `The MCP \`dry_run\` argument on \`discard\`, \`rename\`,
\`sync\`, \`migrate\`, \`branch_remove\`, \`session_remove\` and \`worktree_remove\`
is first verified absent in 0.27.0 on 2026-11-15. Use each tool’s
\`*_preview\` identity instead. The retained argument forms keep their decisions
except where the worktree branch-cleanup rule requires approval. Strict still
denies the retained forms for forced branch deletion, session deletion and
removal with discarded changes. Independent fixtures cover every retained form
across profiles. Gate has no published feature release starting this window.
Retirement requires three subsequent published feature releases.

\`gate setup\` and the MCP \`setup\` tool use Ask in each profile because they
can initialize repositories or publish agent registrations. The CLI dry run
and \`setup_preview\` are Allow within approved roots. Explicit policy files
in these previews are checked against approved read paths.

The CLI \`worktree status --runtime\` reports readiness and repository entry
bindings. It keeps the same read-only decisions and project boundary as
\`worktree status\`.

\`worktree add --resume PLAN\` and MCP \`worktree_add\` with \`resume\` identify a
saved plan. Gate checks the plan before continuing, and Shield applies the
same destination and project checks as for ordinary creation.

MCP \`status\` accepts \`details\` and \`paths\` to select report rows within the
worktree. CLI discard and worktree removal previews accept \`--details\`.
Their MCP previews accept \`details: true\`. Detail flags keep the operation's
review and path checks.
`;
}

function gateParityGuide() {
  return `Reviewed against Gate 0.35.0. Gate lists verified bindings through
\`remote\`, \`remote list\`, and MCP \`remote_list\`. Use \`remote get-url\` to
read a bound URL.
Remote listing and index, patch and commit previews are Allow in every
profile within approved roots. Fetch and push previews may contact
an approved destination and ask in Recommended and Strict. File inputs for
patches, commit messages and CLI pathspec lists require an approved read root
and must stay outside protected paths. The CLI accepts \`-\` to read these inputs
from standard input. Gate 0.35.0 requires absolute file paths in MCP calls. Use
\`patch_text\` or \`message\` to pass content inline. Historical tool permissions
remain available for older installations.

Shield asks on \`commit -S<key>\` because its argument grammar cannot parse an
optional attached value on a short flag while checking file inputs. Use
\`--gpg-sign=<key>\` for the equivalent form.
`;
}

function gatePushDestinationGuide() {
  return `Reviewed 2026-11-16 against Gate 0.28.0 source and installed CLI: \`push --destination\`
and MCP \`destination_branch\` select a remote branch name, with no host-path
effect. Existing prefix matching and unknown-option skipping cover both CLI
value forms without an option allowance. Ordinary CLI publication remains
Allow/Ask/Ask in Loose/Recommended/Strict; leased rewrites remain Ask/Ask/Deny.
MCP publication remains Allow in all profiles because Gate confirms it;
leased MCP rewrites remain Allow/Allow/Deny. Independent fixtures cover both
interfaces, exact lease forms, malformed selection and outside-project guards.
No policy decision or historical source changes for destination selection.

`;
}

function gateRemoteGuide() {
  return `\`gate remote list -r acme\` reads approved local remote bindings and is Allow
in every profile inside the approved project. The same CLI rules apply to the
default \`~/.local/bin/gate\` installation, including project checks and push
decisions. For older Shield engines, use the [0.2.11 pack](../0.2.11/README.md).

Gate 0.33.0 exposes \`remote set-url\`, \`remote rename\`, and
\`remote remove\` (alias \`rm\`). CLI reviews and the three dedicated MCP
preview tools are Allow in all profiles inside approved project roots.
The applying MCP tools are Allow in Loose and Recommended within approved
writable roots, with Gate confirming the exact change. CLI \`--confirm\` keeps
Ask in those profiles. Strict denies applying through either interface.
These commands only edit local repository metadata.
\`remote set-url\` records the destination for subsequent Git transport.
Reviewing or applying the URL change leaves the destination untouched.

`;
}

function gateConfirmationGuide() {
  return `The applying MCP tool \`discard\` is Allow in Loose and Recommended inside
the approved project. Gate obtains the user's confirmation of the exact plan
before it restores files or deletes opted-in untracked files. This lets a
Shield-managed host resolve the generic tool approval without a second prompt.
Strict denies applying discard. An explicit project outside approved writable
roots still requires review in Loose and Recommended and is denied in Strict.
CLI discard remains Ask/Ask/Deny. \`discard_preview\` and the retained legacy
\`dry_run: true\` form keep their existing decisions.

Repository \`rename\` uses Gate's confirmation in Loose and Recommended,
including with an explicit approved project. Strict keeps the additional host
review for this cross-worktree operation.

Dirty \`worktree_remove\` without branch cleanup uses Gate's confirmation in
Loose and Recommended when the destination is within approved writable roots.
Strict denies dirty removal. Clean CLI removal previews and MCP previews check
approved read roots. CLI removal with confirmation checks approved write roots.

Gate 0.33.0 can delete branches when a completed removal is replayed with
\`--remove-branch\`, even for a dry run. The CLI now asks in all profiles for
branch cleanup. With \`--discard-changes\`, Strict denies it. MCP retains its
existing review or denial for \`remove_branch: true\` inside approved roots.
Gate 0.34.0 confirms branch cleanup regardless of whether removal has completed.
For inspection on older versions, omit the branch-cleanup option.
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildCurrentToolPacks(process.argv.length > 2 ? process.argv.slice(2) : undefined);
