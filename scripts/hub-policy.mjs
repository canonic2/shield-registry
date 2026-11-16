// Reviewed Hub CLI and MCP surface of hub 0.39.0: src/interface/cli.rs, the
// task, agent, plugin and MCP-integration argument types, and the 91 tools of
// src/interface/mcp/catalog.rs (`hub mcp serve --check`). Hub succeeds Box;
// canonic/box keeps covering the box executable.
// Expected decisions live independently in hub-cases.mjs.
//
// Ordinary Hub use is allowed: Hub validates its own arguments and asks its
// user before confirmed effects. The pack reviews only the forms an agent could
// use to escape other policy or cause loss: arbitrary commands, starting or
// prompting other agents, self-confirmed or irreversible deletion, and named
// files in credential or agent-settings locations. Strict reviews changes.
import {toolPack} from './tool-pack.mjs';
import {addPreviewTools} from './dry-run-tools.mjs';

export const version = '0.1.1';
export const engine = '>=0.20.0, <1.0.0';

const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
export const decisions = {
  inspect: profiles('allow'),
  routine: profiles('allow', 'allow', 'ask'),
  execute: profiles('allow', 'ask', 'ask'),
  // Raw `--` command forms match through risk tokens, which Shield never lets allow.
  shortcut: profiles('ask'),
  destroy: profiles('ask', 'ask', 'deny'),
  folder: profiles('ask'),
  // Unknown tool names may be newer operations, and unparsed command lines
  // include `hub -w WORKSPACE -- COMMAND`.
  unlisted: profiles('allow', 'ask', 'ask'),
};

const workspace = ['--workspace', '-w'];
const globals = ['--config', '--agent-config'];
const mutation = {flags: ['--dry-run'], values: [...workspace, '--if-revision', '--request-id', '--preview-digest', ...globals]};
const initial = ['--goal', '--description', '--priority', '--labels', '--check', '--goal-file', '--description-file'];
// Complete option sets, so a file check parses every spelling of the command.
const grammars = {
  taskUpdate: {flags: [...mutation.flags, '--clear-goal'], values: [...mutation.values, '--goal', '--goal-file',
    '--description', '--description-file', '--priority', '--labels', '--work-status', '--reason', '--result']},
  taskImport: {flags: mutation.flags, values: [...mutation.values, '--file', '--mode']},
  step: {flags: [...mutation.flags, '--top-level'], operands: true, values: [...mutation.values, '--title', '--description',
    '--description-file', '--status', '--parent', '--depends-on', '--result', '--reason', '--before', '--after', '--position', '--fields-json']},
  create: {flags: ['--no-wait', '--no-copy', '--no-fetch', '--shell'], operands: true, values: [...initial, '--path', '--branch',
    '--existing-branch', '--from', '--source', '--copy-source', '--repo-from', '--request-id', '--provider', ...globals]},
  attach: {flags: ['--no-wait'], operands: true, values: [...initial, '--request-id', '--provider', ...globals]},
  agentStart: {flags: [], operands: true, values: [...workspace, '--prompt', '--prompt-file', '--model', '--host', '--request-id', ...globals]},
  agentMessage: {flags: [], operands: true, values: [...workspace, '--prompt', '--prompt-file', '--if-operation-sequence', '--request-id', ...globals]},
};
// A named input file is read into Hub state. Files in version control, Shield
// state, credentials or agent settings, or outside the approved roots, ask.
// `prefixes` are the options whose names begin a checked option's name.
const files = (options, prefixes, grammar, category = 'routine') => ({
  id: 'files', any: options, values: [...options, ...prefixes], category, unmet: 'folder', grammar,
  reason: 'Read text from a named file.', paths: Object.fromEntries(options.map(name => [name, 'read']))});
const words = (rows, category, reason) => rows.map(row => [row.split(' '), category, reason]);

export const hub = {
  name: 'hub', title: 'Hub', version, engine,
  description: 'Hub workspaces, tasks, processes, agents and configuration, reviewing arbitrary commands, agent prompts, self-confirmed deletion and credential files.',
  leading: {flags: ['--json'], values: ['--project']},
  shortOptions: {flags: [], values: ['-w']},
  homeInstall: '.local/bin',
  profileDecisions: decisions,
  activeProjectAdjustments: true,
  commands: [
    ...words(['status', 'doctor', 'workspace list', 'workspace show', 'operation show', 'operation list',
      'manager status', 'manager blocker list', 'process list', 'process url',
      'process logs', 'process gateway status', 'task show', 'task history', 'task step list', 'task step next', 'task export',
      'agent list', 'agent show', 'config check', 'config plan', 'config schema', 'docs list', 'docs search', 'docs read',
      'plugin list', 'plugin show', 'plugin binding list', 'plugin context show', 'plugin prepare', 'plugin workflow list', 'plugin workflow show',
      'mcp auth list', 'mcp auth show', 'mcp auth manager status', 'mcp serve'],
    'inspect', 'Inspect Hub state, configuration or documentation.'),
    ...words(['init', 'setup', 'mcp setup', 'mcp auth setup', 'mcp auth logout', 'mcp auth headers', 'mcp app create',
      'mcp auth manager stop', 'mcp auth manager drain', 'manager stop', 'manager drain', 'operation cancel',
      'workspace prepare', 'process run', 'process stop', 'process gateway enable', 'process gateway disable', 'agent stop',
      'task step remove', 'task check add', 'task check update', 'task check remove', 'task note add', 'task note update',
      'task note remove', 'plugin enable', 'plugin disable', 'plugin reset', 'plugin binding add', 'plugin binding remove',
      'plugin workflow reconcile', 'plugin workflow abandon', 'plugin check'],
    'routine', 'Change Hub configuration, tasks, processes or plugins; Hub confirms reviewed effects itself.'),
    [['task', 'update'], 'routine', 'Change the task.', [files(['--goal-file', '--description-file'], ['--goal', '--description'], grammars.taskUpdate)]],
    [['task', 'import'], 'routine', 'Apply task changes from a file.', [files(['--file'], [], grammars.taskImport)]],
    ...['add', 'update'].map(verb => [['task', 'step', verb], 'routine', 'Edit task steps.',
      [files(['--description-file'], ['--description'], grammars.step)]]),
    [['workspace', 'create'], 'routine', 'Create a workspace with its checkout, task and data.', [
      {id: 'shell', any: ['--shell'], category: 'execute', reason: 'Open a terminal in the new workspace.'},
      files(['--goal-file', '--description-file'], ['--goal', '--description'], grammars.create)]],
    [['workspace', 'attach'], 'routine', 'Register an existing directory as a workspace.', [
      files(['--goal-file', '--description-file'], ['--goal', '--description'], grammars.attach)]],
    // Hub's terminal confirmation is the deletion boundary; a --confirm digest
    // supplied by the caller skips it, and discarding changes or forgetting the
    // record cannot be undone.
    [['workspace', 'remove'], 'routine', 'Remove a workspace after Hub\'s own confirmation.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'destroy', reason: 'Delete workspace resources without Hub\'s confirmation.'},
      {id: 'discard', any: ['--discard-changes'], category: 'destroy', reason: 'Permanently discard uncommitted checkout files.'},
      {id: 'forget', any: ['--forget'], category: 'destroy', reason: 'Delete the removed-workspace record and its task.'}]],
    [['workspace', 'data-reset'], 'inspect', 'Print the workspace\'s owned data inventory.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'destroy', reason: 'Delete the workspace\'s data and volumes.'}]],
    // Arbitrary programs and other agents are not judged by this pack's rules.
    ...words(['process exec', 'shell', 'process shell', 'plugin launch', 'plugin workflow run', 'plugin workflow resume'],
      'execute', 'Run an arbitrary program or external workflow, which other command policy does not see.'),
    [['--'], 'shortcut', 'Run a command on a terminal in the current workspace.'],
    [['agent', 'start'], 'execute', 'Start an agent in the workspace checkout.', [
      files(['--prompt-file'], ['--prompt'], grammars.agentStart, 'execute')]],
    [['agent', 'message'], 'execute', 'Send an agent a prompt that starts or steers its work.', [
      files(['--prompt-file'], ['--prompt'], grammars.agentMessage, 'execute')]],
  ],
  risks: [['create-command', ['workspace', 'create'], ['--'], 'shortcut', 'Run a command in the new workspace.']],
  extraCapabilities: ['argument-paths-v1', 'requirements-v1'],
  mcpTools: Object.fromEntries([
    ...['workspace_list', 'workspace_show', 'status', 'operation_show', 'operation_list', 'process_list', 'process_logs', 'process_url', 'process_gateway_status',
      'manager_status', 'manager_blocker_list', 'config_check', 'config_plan', 'config_schema', 'doctor', 'task_show', 'task_history', 'task_export',
      'task_step_list', 'task_step_next', 'agent_list', 'agent_show', 'plugin_list', 'plugin_show', 'plugin_context_show',
      'plugin_prepare', 'plugin_binding_list', 'plugin_workflow_list', 'plugin_workflow_show', 'docs_list', 'docs_search', 'docs_read']
      .map(name => [name, ['inspect', 'Inspect Hub state, configuration or documentation.']]),
    ...['init', 'setup', 'workspace_create', 'workspace_attach', 'workspace_prepare', 'workspace_data_reset',
      'task_update', 'task_import', 'task_step_add', 'task_step_update', 'task_step_remove', 'task_check_add',
      'task_check_update', 'task_check_remove', 'task_note_add', 'task_note_update', 'task_note_remove', 'process_run',
      'process_stop', 'process_gateway_enable', 'process_gateway_disable', 'agent_stop', 'plugin_enable', 'plugin_disable',
      'plugin_reset', 'plugin_binding_add', 'plugin_binding_remove', 'plugin_workflow_reconcile', 'plugin_workflow_abandon',
      'plugin_check', 'manager_stop', 'manager_drain', 'operation_cancel']
      .map(name => [name, ['routine', 'Change Hub configuration, tasks, processes or plugins; Hub asks the host user before confirmed effects.']]),
    // MCP removal always asks the host user; only its irreversible options are reviewed.
    ['workspace_remove', ['routine', 'Remove a workspace after the host user confirms.', [
      {id: 'discard', fields: {'/discard_changes': {exact: true}}, category: 'destroy', reason: 'Permanently discard uncommitted checkout files.'},
      {id: 'forget', fields: {'/forget': {exact: true}}, category: 'destroy', reason: 'Delete the removed-workspace record and its task.'}]]],
    ...['process_exec', 'plugin_workflow_run', 'plugin_workflow_resume', 'agent_start', 'agent_message']
      .map(name => [name, ['execute', 'Run an arbitrary program, external workflow or agent prompt, which other command policy does not see.']]),
  ]),
};

export function hubPack() {
  const pack = toolPack(hub);
  addPreviewTools(pack, 'hub');
  // CLI `hub mcp setup` owns the rule IDs mcp-setup*; give the MCP setup tool
  // its own prefix.
  for (const row of pack.rules) if (row.conditions.domain === 'mcp' && row.conditions.tool === 'setup')
    row.id = row.id.replace(/^mcp-setup/, 'mcp-tool-setup');
  // Accept the other global options wherever command rules accept --project.
  // Risk-token forms enumerate their spellings and stay at --json/--project,
  // so `hub --config FILE -- COMMAND` reaches the unlisted review.
  for (const row of pack.rules) {
    const leading = row.conditions.arguments?.leading;
    if (leading) leading.values = [...new Set([...leading.values, ...globals])];
    const grammar = row.requirements?.argument_paths?.grammar;
    if (grammar?.leading) grammar.leading.values = [...new Set([...grammar.leading.values, ...globals])];
  }
  const fields = pack.mcp_integrations.hub.fields;
  delete fields['/args/0'];
  delete fields['/args/1'];
  fields['/args'] = {exact: ['mcp', 'serve']};
  return pack;
}
