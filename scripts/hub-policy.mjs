// Reviewed Hub CLI and MCP surface of Hub 0.53.0: src/interface/cli.rs, the
// task, agent, plugin and integration argument types, and the tools of
// src/interface/mcp/catalog.rs (`hub mcp serve --check`). Hub succeeds Box;
// canonic/box keeps covering the box executable.
// Expected decisions live independently in hub-cases.mjs.
//
// Ordinary Hub use is allowed: Hub validates its own arguments and asks its
// user before confirmed effects. The pack reviews only the forms an agent could
// use to escape other policy or cause loss: arbitrary commands, starting or
// prompting other agents, self-confirmed or irreversible deletion, named input
// files in credential or agent-settings locations, and a task export written
// outside the writable roots. Strict reviews changes.
import {toolPack} from './tool-pack.mjs';
import {addPreviewTools} from './dry-run-tools.mjs';

export const version = '0.1.10';
export const engine = '>=0.20.0, <1.0.0';

const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
export const decisions = {
  inspect: profiles('allow'),
  routine: profiles('allow', 'allow', 'ask'),
  execute: profiles('allow', 'ask', 'ask'),
  // Raw `--` command forms match through risk tokens, which Shield never lets allow.
  shortcut: profiles('ask'),
  destroy: profiles('ask', 'ask', 'deny'),
  confirmedDisposal: profiles('allow', 'allow', 'deny'),
  folder: profiles('ask'),
  confirmation: profiles('ask'),
  // Unknown tool names may be newer operations, and unparsed command lines
  // include `hub -w WORKSPACE -- COMMAND`.
  unlisted: profiles('allow', 'ask', 'ask'),
};

const workspace = ['--workspace', '-w'];
const globals = ['--config', '--agent-config'];
const defaultController = {one_of: ['https://app.canonic.sh', 'https://app.canonic.sh/']};
const proxyReads = {
  projects: [],
  status: ['--remote-project'],
  deliveries: ['--remote-project', '--query'],
};
const inspectProxy = 'Read hosted proxy state from the default Canonic controller.';
const reviewController = 'Review an authenticated request to a caller-selected controller.';
const composeAssessment = 'Probe Docker using the selected workspace recipe and check the incoming Compose model and volumes.';
const selectedExecution = {text: {not: {exact: ''}}};
const mutation = {flags: ['--dry-run'], values: [...workspace, '--if-revision', '--request-id', '--preview-digest',
  '--inspect', '--offset', ...globals]};
const initial = ['--goal', '--description', '--priority', '--labels', '--check', '--goal-file', '--description-file'];
const appValues = [...globals, '--claude-bin', '--server-key', '--agent', '--app-id', '--client-id', '--name', '--preset'];
const appFlags = ['--app-only', '--no-browser', '--details'];
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
  taskExport: {flags: ['--overwrite'], values: [...workspace, '--format', '--output', '--cursor', '--limit', ...globals]},
};
// A named input file is read into Hub state. Files in version control, Shield
// state, credentials or agent settings, or outside the approved roots, ask.
// `prefixes` are the options whose names begin a checked option's name.
const files = (options, prefixes, grammar, category = 'routine') => ({
  id: 'files', any: options, values: [...options, ...prefixes], category, unmet: 'folder', grammar,
  reason: 'Read text from a named file.', paths: Object.fromEntries(options.map(name => [name, 'read']))});
// `task export --output` writes, and with --overwrite replaces, the named file.
// Inside the writable roots it stays inspection; elsewhere it asks like a
// named input file.
const output = {
  id: 'output', any: ['--output'], values: ['--output'], category: 'inspect', unmet: 'folder',
  grammar: grammars.taskExport, reason: 'Write the task export to a named file.', paths: {'--output': 'write'}};
const words = (rows, category, reason) => rows.map(row => [row.split(' '), category, reason]);

export const hub = {
  name: 'hub', title: 'Hub', version, engine,
  description: 'Hub workspaces, tasks, processes, agents, configuration and hosted proxies, with review for arbitrary commands, agent prompts, self-confirmed deletion, credential files and public route changes.',
  leading: {flags: ['--json'], values: ['--project']},
  shortOptions: {flags: [], values: ['-w']},
  homeInstall: '.local/bin',
  profileDecisions: decisions,
  activeProjectAdjustments: true,
  commands: [
    ...words(['status', 'workspace list', 'workspace show', 'operation show', 'operation list',
      'manager status', 'manager blocker list', 'process list', 'process url',
      'process logs', 'process stats', 'process gateway status', 'task show', 'task history', 'task step list', 'task step next',
      'agent list', 'agent show', 'config check', 'config plan', 'config schema', 'docs list', 'docs search', 'docs read',
      'plugin list', 'plugin show', 'plugin binding list', 'plugin context show', 'plugin prepare', 'plugin workflow list', 'plugin workflow show',
      'mcp auth list', 'mcp auth show', 'mcp auth manager status', 'mcp serve'],
    'inspect', 'Inspect Hub state, configuration or documentation.'),
    [['doctor'], 'inspect', 'Inspect Hub prerequisites, project and manager state.', [
      {id: 'execution', any: ['--execution'], values: ['--execution'], category: 'routine', reason: composeAssessment}]],
    ...words(['init', 'setup', 'mcp setup', 'mcp auth logout', 'mcp auth headers',
      'mcp auth manager stop', 'mcp auth manager drain', 'manager stop', 'manager drain', 'operation cancel',
      'workspace prepare', 'process run', 'process restart', 'process pause', 'process resume', 'process stop', 'process gateway enable', 'process gateway disable', 'agent stop',
      'task step remove', 'task check add', 'task check update', 'task check remove', 'task note add', 'task note update',
      'task note remove', 'plugin enable', 'plugin disable', 'plugin reset', 'plugin binding add', 'plugin binding remove',
      'plugin workflow reconcile', 'plugin workflow abandon', 'plugin check'],
    'routine', 'Change Hub configuration, tasks, processes or plugins; Hub confirms reviewed effects itself.'),
    ...Object.keys(proxyReads).map(verb => [['proxy', verb], 'inspect', inspectProxy]),
    ...words(['proxy login', 'proxy logout'], 'confirmation', 'Acquire or revoke a controller login.'),
    ...words(['proxy endpoint', 'proxy endpoint create', 'proxy endpoint rename', 'proxy endpoint pause',
      'proxy endpoint resume', 'proxy endpoint delete'], 'confirmation', 'Change a hosted endpoint and its public routes.'),
    ...words(['proxy route', 'proxy route create', 'proxy route update', 'proxy route delete'],
      'confirmation', 'Change the assignment or availability of a public route.'),
    [['proxy', 'connect'], 'confirmation', 'Enroll an outbound connector for a local workspace.'],
    [['proxy', 'revoke'], 'confirmation', 'Revoke a hosted connector grant.'],
    [['proxy'], 'confirmation', 'Review controller login, custom trust, connector enrollment and hosted proxy changes.'],
    [['mcp', 'workspace-headers'], 'routine', 'Verify the current checkout and start the same-user MCP passthrough when needed.'],
    [['mcp', 'workspace-launch'], 'execute', 'Launch a stdio MCP server with workspace ports and a supplied executable.'],
    [['mcp', 'auth', 'setup'], 'routine', 'Configure Hub-managed MCP credentials after a terminal review.', [
      {id: 'confirm', any: ['--yes'], forbid: ['--dry-run'], values: [...globals, '--name', '--agent', '--scope'],
        flags: ['--remove'], category: 'confirmation', reason: 'Change MCP credential routing without Hub’s terminal confirmation.'}]],
    [['mcp', 'app', 'create'], 'routine', 'Provision an MCP app after a terminal review.', [
      {id: 'preview', any: ['--dry-run'], values: appValues, flags: appFlags,
        category: 'inspect', reason: 'Prepare a Slack app review without contacting Slack, starting a native client or writing files.'},
      {id: 'client-executable', any: ['--claude-bin'], forbid: ['--dry-run'], values: appValues,
        flags: appFlags, category: 'execute', reason: 'Run the supplied native client executable before app confirmation.'}]],
    [['task', 'export'], 'inspect', 'Export one task revision.', [output]],
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
    ...words(['process exec', 'process shell', 'plugin launch', 'plugin workflow run', 'plugin workflow resume'],
      'execute', 'Run an arbitrary program or external workflow, which other command policy does not see.'),
    [['shell'], 'execute', 'Open a workspace shell.', [
      {id: 'secret-profile', any: ['--secrets'], values: ['--secrets'], category: 'confirmation', reason: 'Supply a configured set of credentials to a shell and its descendants.'}]],
    [['config', 'secrets-sync'], 'confirmation', 'Write or refresh a declared secret file in a checkout.'],
    [['hook-child'], 'confirmation', 'Directly invoke the private command-hook worker with a launch plan on stdin.'],
    [['--'], 'shortcut', 'Run a command on a terminal in the current workspace.'],
    [['agent', 'start'], 'execute', 'Start an agent in the workspace checkout.', [
      files(['--prompt-file'], ['--prompt'], grammars.agentStart, 'execute')]],
    [['agent', 'attach'], 'confirmation', 'Take interactive control of an agent terminal or resume MCP output after a private attachment.'],
    [['agent', 'message'], 'execute', 'Send an agent a prompt that starts or steers its work.', [
      files(['--prompt-file'], ['--prompt'], grammars.agentMessage, 'execute')]],
  ],
  risks: [['create-command', ['workspace', 'create'], ['--'], 'shortcut', 'Run a command in the new workspace.']],
  extraCapabilities: ['argument-paths-v1', 'field-paths-v1', 'preconditions-v1', 'requirements-v1'],
  mcpTools: Object.fromEntries([
    ...['workspace_list', 'workspace_show', 'status', 'operation_show', 'operation_list', 'process_list', 'process_logs', 'process_stats', 'process_url', 'process_gateway_status',
      'manager_status', 'manager_blocker_list', 'config_check', 'config_plan', 'config_schema', 'task_show', 'task_history', 'task_export',
      'task_step_list', 'task_step_next', 'agent_list', 'agent_show', 'plugin_list', 'plugin_show', 'plugin_context_show',
      'plugin_prepare', 'plugin_binding_list', 'plugin_workflow_list', 'plugin_workflow_show', 'docs_list', 'docs_search', 'docs_read']
      .map(name => [name, ['inspect', 'Inspect Hub state, configuration or documentation.']]),
    ['doctor', ['inspect', 'Inspect Hub prerequisites, project and manager state.', [
      {id: 'execution', fields: {'/execution': selectedExecution}, category: 'routine', reason: composeAssessment}]]],
    ['agent_terminal_read', ['inspect', 'Read bounded terminal output owned by this Hub connection.']],
    ['mcp_app_create_preview', ['inspect', 'Prepare a Slack app review and return the command for terminal approval and hidden input.']],
    ...Object.keys(proxyReads).map(verb => [`proxy_${verb}`, ['inspect', inspectProxy, [
      {id: 'controller', fields: {'/controller': {text: {not: defaultController}}},
        category: 'confirmation', reason: reviewController},
      {id: 'controller-ca', fields: {'/controller_ca': {text: {regex:'.*'}}}, category: 'confirmation', reason: reviewController},
    ]]]),
    ...['init', 'setup', 'workspace_create', 'workspace_attach', 'workspace_prepare', 'workspace_data_reset',
      'task_update', 'task_import', 'task_step_add', 'task_step_update', 'task_step_remove', 'task_check_add',
      'task_check_update', 'task_check_remove', 'task_note_add', 'task_note_update', 'task_note_remove', 'process_run',
      'process_restart', 'process_pause', 'process_resume', 'process_stop', 'process_gateway_enable', 'process_gateway_disable', 'agent_stop', 'plugin_enable', 'plugin_disable',
      'plugin_reset', 'plugin_binding_add', 'plugin_binding_remove', 'plugin_workflow_reconcile', 'plugin_workflow_abandon',
      'plugin_check', 'manager_stop', 'manager_drain', 'operation_cancel']
      .map(name => [name, ['routine', 'Change Hub configuration, tasks, processes or plugins; Hub asks the host user before confirmed effects.']]),
    ['proxy_route_update', ['confirmation', 'Change the connector assignment or availability of a public route.']],
    ...['proxy_logout', 'proxy_endpoint_create', 'proxy_endpoint_rename', 'proxy_endpoint_pause',
      'proxy_endpoint_resume', 'proxy_endpoint_delete', 'proxy_route_create', 'proxy_route_delete',
      'proxy_connector_revoke', 'proxy_login', 'proxy_connect', 'proxy_disconnect']
      .map(name => [name, ['confirmation', 'Review hosted proxy configuration, credential or connector lifecycle changes.']]),
    ['workspace_remove', ['routine', 'Remove a workspace. Hub confirms disposal of resources or history.', [
      {id: 'discard', fields: {'/discard_changes': {exact: true}}, category: 'confirmedDisposal', reason: 'Discard uncommitted checkout files after Hub confirms the inventory.'},
      {id: 'forget', fields: {'/forget': {exact: true}}, category: 'confirmedDisposal', reason: 'Delete the removed-workspace record and its task after Hub confirms disposal.'}]]],
    ...['plugin_workflow_run', 'plugin_workflow_resume'].map(name => [name,
      ['routine', 'Run an external workflow after Hub shows its program and arguments and asks the user to confirm.', [
        {id:'legacy-preview', fields:{'/dry_run':{exact:true}}, category:'execute', reason:'Retain the reviewed decision for older workflow preview arguments.'},
      ]]]),
    ...['process_exec', 'agent_start', 'agent_message']
      .map(name => [name, ['execute', 'Run an arbitrary program, external workflow or agent prompt, which other command policy does not see.']]),
  ]),
};

export function hubPack() {
  const pack = toolPack(hub);
  addPreviewTools(pack, 'hub');
  const app = pack.rules.find(rule => rule.id === 'mcp-app-create');
  const {require_any: _required, ...appGrammar} = pack.rules
    .find(rule => rule.id === 'mcp-app-create-preview').conditions.arguments;
  // Preview and provisioning must be disjoint: at the same specificity a
  // Strict provisioning Ask would otherwise also apply to read-only preview.
  app.conditions.arguments = {...appGrammar, forbid: ['--dry-run'],
    values: appGrammar.values.filter(name => name !== '--claude-bin'),
    optional_values: ['--claude-bin']};
  // CLI `hub mcp setup` owns the rule IDs mcp-setup*; give the MCP setup tool
  // its own prefix.
  for (const row of pack.rules) if (row.conditions.domain === 'mcp' && row.conditions.tool === 'setup')
    row.id = row.id.replace(/^mcp-setup/, 'mcp-tool-setup');
  // Accept the other global options wherever command rules accept --project.
  // Risk-token forms enumerate their spellings and stay at --json/--project,
  // so `hub --config FILE -- COMMAND` reaches the unlisted review.
  for (const row of pack.rules) {
    // User-scope auth setup can write from any directory. The confirmation
    // rule only asks, so the current directory cannot weaken it.
    // An explicit project can select a checkout from another directory.
    // The hook worker accepts a host launch request independently of cwd.
    if (['mcp-auth-setup-confirm', 'shell-secret-profile', 'config-secrets-sync', 'hook-child', 'agent-attach'].includes(row.id))
      delete row.conditions.cwd;
    if (row.conditions.domain === 'argv' && (row.id === 'proxy' || row.id.startsWith('proxy-'))) {
      // Controller operations also work outside Hub projects. Keep the review
      // rule in force there, and allow only parsed reads using default trust.
      delete row.conditions.cwd;
      const verb = row.id.slice('proxy-'.length);
      if (Object.hasOwn(proxyReads, verb)) {
        const {leading, values: prefix} = row.conditions.arguments;
        row.conditions.arguments = {kind: 'options', leading, prefix, flags: ['--json'],
          values: ['--project', ...globals, ...proxyReads[verb],
            {name: '--controller', match: defaultController, repeat: 'forbid'}, '--controller-ca'],
          forbid: ['--controller-ca'], operands: false};
      }
    }
    const leading = row.conditions.arguments?.leading;
    if (leading) leading.values = [...new Set([...leading.values, ...globals])];
    const grammar = row.requirements?.argument_paths?.grammar;
    if (grammar?.leading) grammar.leading.values = [...new Set([...grammar.leading.values, ...globals])];
  }
  const fields = pack.mcp_integrations.hub.fields;
  delete fields['/args/0'];
  delete fields['/args/1'];
  fields['/args'] = {exact: ['mcp', 'serve']};
  pack.preconditions = composeConfigChecks(pack);
  return pack;
}

// An explicit incoming recipe is read from the host. CLI paths resolve from
// the caller's cwd, while relative MCP paths resolve from the selected checkout.
function composeConfigChecks(pack) {
  const path = {within: {root: 'read'}, exclude: ['.shield', '.git', '.aws', '.ssh', '.env', '.mcp.json', '.codex', '.claude']
    .map(path => ({root: 'project', path}))};
  const on_unmet = {decision: 'ask', message: 'Select an incoming recipe inside approved read roots, away from protected files.'};
  const reason = 'An explicit replacement recipe selects a host file and can control the Docker provider lookup.';
  return [
    {command: 'doctor', tool: 'doctor', option: '--execution', fields: {'/execution': selectedExecution}},
    {command: 'process-stop', tool: 'process_stop', option: '--check-replacement', fields: {'/check_replacement': {exact: true}}},
  ].flatMap(({command, tool, option, fields}) => {
    const {executable, arguments: {leading, values: prefix}} = pack.rules.find(rule => rule.id === command).conditions;
    const grammar = {kind: 'options', leading, prefix, operands: true, unknown_options: 'skip',
      flags: ['--json', '--check-replacement', '--allow-self-stop'],
      values: ['--execution', '--workspace', '-w', '--request-id', '--project', ...globals]};
    return [
      {id: `cli-${command}-replacement-config`,
        conditions: {domain: 'argv', executable, arguments: {...grammar, require_all: [option, '--config']}},
        requires_any: [{argument_paths: {grammar, options: {'--config': {path}}}}], on_unmet, reason},
      {id: `mcp-${tool}-replacement-config`,
        conditions: {domain: 'mcp', server: 'hub', tool, fields: {...fields, '/config': selectedExecution}},
        requires_any: [{field_paths: {'/config': {absolute: true, path}}}], on_unmet, reason},
    ];
  });
}
