// Current product surfaces extend frozen 0.2.1 releases without rewriting them.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {toolPack} from './tool-pack.mjs';
import {box} from './box-policy.mjs';
import {gate} from './gate-policy.mjs';
import {currentToolCases} from './current-tool-cases.mjs';

export const currentToolVersions = {box:'0.2.2', gate:'0.2.2', testrun:'0.2.2'};
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
  const tools = Object.fromEntries(commands.filter(([words]) => words.join(' ') !== 'plugin launch')
    .map(([words, category, reason]) => [words.join('_'),[category,reason]]));
  tools.config_sync = ['integration','Review and publish agent configuration.',[
    {id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Inspect publication without writing.'}]];
  for (const name of ['plugin_enable','plugin_disable','plugin_reset','plugin_workflow_run','plugin_workflow_resume','plugin_check']) {
    tools[name][2] = [{id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Prepare without state or process effects.'}];
    const command = commands.find(([words]) => words.join('_') === name);
    command.push([{id:'dry-run', any:['--dry-run'], category:'inspect', reason:'Prepare without effects.'}]);
  }
  extend(pack, box, commands, tools);
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
  // Selector conflicts are rejected by Box before recovery; they cannot borrow
  // the ordinary Loose allowance, including with an explicit project.
  pack.capabilities = [...new Set([...pack.capabilities,'field-negation-v1'])].sort();
  for (const selector of ['operation','generation'])
    mcpRule(pack,`mcp-recover-workspace-${selector}-conflict`,'recover',review,{
      '/workspace':{not:{exact:null}}, [`/${selector}`]:{not:{exact:null}},
    });
  // Manager ownership does not reduce arbitrary execution effects. Retain the
  // frozen exec/shell Ask decisions and the explicit immediate-self-stop rules.
}

function updateGate(pack) {
  extend(pack, gate, [
    [['rename'],'inspect','Review a repository ID migration.',[
      {id:'confirm', any:['--confirm'], values:['--confirm'], category:'change', reason:'Apply the exact reviewed migration.'}]],
    // Without --dry-run, discard may prompt and apply even without --confirm.
    [['discard'],'destroy','Discard selected staged and working changes.',[
      {id:'dry-run', any:['--dry-run'], category:'inspect', reason:'Inspect the discard inventory without changes.'}]],
  ], {
    rename:['change','Rename a repository ID after exact host confirmation.'],
    discard:['destroy','Discard selected staged and working changes after confirmation.',[
      {id:'dry-run', fields:{'/dry_run':{exact:true}}, category:'inspect', reason:'Inspect selected changes without discarding them.'}]],
  });
  separatePreview(pack,'discard');
  const template = pack.rules.find(rule => rule.id === 'mcp-status-project');
  for (const name of ['rename','discard']) {
    const rule = pack.rules.find(rule => rule.id === `mcp-${name}-project`);
    rule.requirements = structuredClone(template.requirements);
    rule.requirements.field_paths['/project'].path.within.root = 'write';
    rule.on_unmet = {decision:rule.decision, message:'Review explicit project paths outside approved roots.'};
  }
  // A project-qualified preview allows only when both the path and explicit
  // dry-run are proved. Other forms retain the destructive profile decision.
  const projectDiscard = pack.rules.find(rule => rule.id === 'mcp-discard-project');
  projectDiscard.decision = allow;
  projectDiscard.requirements.fields = {'/dry_run':{exact:true}};
  projectDiscard.on_unmet.decision = destroy;
  mcpRule(pack,'mcp-worktree_remove-discard','worktree_remove',destroy,{'/discard_changes':{exact:true}});
  const removal = pack.rules.find(rule => rule.id === 'worktree-remove-confirm');
  const risky = structuredClone(removal);
  risky.id = 'worktree-remove-discard';
  risky.conditions.arguments.require_any = ['--discard-changes'];
  risky.conditions.arguments.flags.push('--discard-changes','--remove-branch');
  risky.decision = destroy;
  pack.rules.push(risky);
}

function updateTestrun(pack) {
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
    prefix:['connect'],flags:[],values:['--engine'],operands:true,require_any:['--engine']};
  connect.decision = review;
  pack.rules.push(connect);
}

export async function currentToolPack(name) {
  const pack = JSON.parse(await readFile(new URL('pack.yml',currentDirectory(name,'0.2.1'))));
  pack.version = currentToolVersions[name];
  ({box:updateBox, gate:updateGate, testrun:updateTestrun})[name](pack);
  const fields = pack.mcp_integrations[name].fields;
  delete fields['/args/0'];
  delete fields['/args/1'];
  fields['/args'] = {exact:['mcp','serve']};
  return pack;
}

export async function buildCurrentToolPacks(names = Object.keys(currentToolVersions)) {
  for (const name of names) {
    if (!Object.hasOwn(currentToolVersions,name)) throw new Error(`Unknown current tool pack: ${name}`);
    const directory = currentDirectory(name);
    await mkdir(directory,{recursive:true});
    const pack = await currentToolPack(name);
    await writeFile(new URL('pack.yml',directory),JSON.stringify(pack,null,2)+'\n');
    await writeFile(new URL('cases.json',directory),JSON.stringify(await currentToolCases(name),null,2)+'\n');
    const inventory = {schema_version:1,commands:[{name,rule_ids:pack.rules
      .filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]};
    await writeFile(new URL('commands.json',directory),JSON.stringify(inventory,null,2)+'\n');
    await copyFile(new URL('../LICENSE',import.meta.url),new URL('LICENSE',directory));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildCurrentToolPacks(process.argv.length > 2 ? process.argv.slice(2) : undefined);
