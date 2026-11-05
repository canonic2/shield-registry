// Reviewed Box CLI and MCP command data, from `box --help` for every
// subcommand and the published MCP tool schemas of box 0.x.
// Complete option sets, so a path check parses every spelling of the command.
const exportOptions = {flags: ['--overwrite', '--project-wide'], values: ['--output', '--workspace', '--section', '--cursor', '--limit', '--format']};
const mutationOptions = {flags: ['--dry-run'], values: ['--workspace', '--if-revision', '--request-id', '--preview-digest']};
const changeOptions = {flags: mutationOptions.flags, values: [...mutationOptions.values, '--file']};
const fileOptions = ['--goal-file', '--description-file'];
// Content edits, `handoff set` and `workspace update`, with an optional record ID.
const editOptions = {flags: [...mutationOptions.flags, '--clear-goal'], values: [...mutationOptions.values, ...fileOptions,
  '--goal', '--description', '--title', '--text', '--work-status', '--status', '--state', '--priority', '--reason', '--result',
  '--resolution', '--kind', '--type', '--url', '--path', '--parent-id', '--depends-on', '--labels', '--evidence', '--references',
  '--before', '--after', '--position', '--fields-json', '--item'], operands: true};
const initialValues = ['--goal', '--description', '--priority', '--labels', '--criterion', ...fileOptions];
const createOptions = {flags: ['--no-wait', '--no-copy', '--shell'], operands: true,
  values: [...initialValues, '--path', '--branch', '--existing-branch', '--from', '--repo-from', '--request-id', '--provider']};
const attachOptions = {flags: ['--no-wait'], values: [...initialValues, '--request-id', '--provider'], operands: true};
// --goal-file and --description-file read a local file into workspace content,
// so like `content apply --file` they read only approved project files.
// --goal and --description are declared because they begin those names.
const textFiles = grammar => ({id: 'files', any: fileOptions, values: [...fileOptions, '--goal', '--description'], category: 'routine',
  reason: 'Read goal or description text from a named file.', paths: Object.fromEntries(fileOptions.map(name => [name, 'read'])), grammar});
const edits = (words, reason) => [words, 'routine', reason, [textFiles(editOptions)]];
const content = ['criterion', 'evidence', 'reference', 'note'].flatMap(noun => ['add', 'update', 'remove'].map(verb => verb === 'remove'
  ? [[noun, verb], 'routine', `Edit workspace ${noun} records; content history keeps prior revisions.`]
  : edits([noun, verb], `Edit workspace ${noun} records; content history keeps prior revisions.`)));
const blockers = ['add', 'update', 'remove', 'resolve', 'reopen'].map(verb => verb === 'remove'
  ? [['blocker', verb], 'routine', 'Edit workspace blocker records; content history keeps prior revisions.']
  : edits(['blocker', verb], 'Edit workspace blocker records; content history keeps prior revisions.'));
const dryRun = (words, reason, applied) => [words, 'inspect', `Review ${reason} without writing.`, [
  {id: 'apply', forbid: ['--dry-run'], category: 'integration', reason: applied}]];

export const box = {
  name: 'box', title: 'Box', version: '0.1.0', engine: '>=0.18.0, <1.0.0',
  description: 'Box workspace inspection, content, checkouts and recipe runs, with separate decisions for arbitrary commands, agent conversations, resource deletion and agent configuration.',
  leading: {flags: ['--json'], values: ['--project']},
  shortOptions: {flags: [], values: []},
  // `make install-local` and per-user installs put box in ~/.local/bin, and
  // user-scope `box mcp setup` registers that absolute path.
  homeInstall: '.local/bin',
  commands: [
    [['workspace', 'list'], 'inspect', 'List registered projects and workspaces.'],
    [['status'], 'inspect', 'Inspect one workspace.'],
    [['context', 'show'], 'inspect', 'Show the workspace hosting this process.'],
    [['content', 'show'], 'inspect', 'Show workspace content.'],
    [['content', 'history'], 'inspect', 'Read content revision history.'],
    [['content', 'export'], 'inspect', 'Export one content revision.', [
      {id: 'output', any: ['--output'], values: ['--output'], category: 'routine', reason: 'Write the export to a named file, replacing it with --overwrite.',
        paths: {'--output': 'write'}, grammar: exportOptions}]],
    [['roadmap', 'next'], 'inspect', 'Show actionable roadmap work without starting it.'],
    [['roadmap', 'list'], 'inspect', 'List the roadmap.'],
    [['agent', 'list'], 'inspect', 'List agent adapters.'],
    [['agent', 'show'], 'inspect', 'Show an adapter\'s capabilities.'],
    [['agent', 'preference', 'get'], 'inspect', 'Show agent preferences.'],
    [['conversation', 'list'], 'inspect', 'List conversation associations.'],
    [['conversation', 'show'], 'inspect', 'Show a conversation association.'],
    [['conversation', 'suggestion', 'list'], 'inspect', 'Show advisory host plans.'],
    [['conversation', 'operation', 'show'], 'inspect', 'Show a bridge operation\'s receipts.'],
    [['operation', 'show'], 'inspect', 'Show a durable operation.'],
    [['manager', 'status'], 'inspect', 'Inspect the manager without starting it.'],
    [['gateway', 'status'], 'inspect', 'Inspect the loopback gateway.'],
    [['url', 'list'], 'inspect', 'List a workspace\'s endpoints.'],
    [['doctor'], 'inspect', 'Inspect platform support; changes nothing.'],
    [['recipe', 'check'], 'inspect', 'Validate the recipe without running project code.'],
    [['recipe', 'plan'], 'inspect', 'Show the redacted effective recipe.'],
    [['recipe', 'migrate'], 'inspect', 'Print a converted recipe; writes nothing.'],
    [['schema', 'show'], 'inspect', 'Print the recipe JSON Schema.'],
    [['host', 'list'], 'inspect', 'List agent host surfaces.'],
    [['config', 'show'], 'inspect', 'Show effective agent configuration.'],
    [['mcp', 'auth', 'list'], 'inspect', 'List Box-held logins without their tokens.'],
    [['mcp', 'auth', 'show'], 'inspect', 'Show one Box-held login without its tokens.'],
    [['mcp', 'auth', 'manager', 'status'], 'inspect', 'Show the credential manager\'s state.'],
    [['logs'], 'inspect', 'Read a bounded log tail.', [
      {id: 'follow', any: ['--follow'], category: 'stream', reason: 'A followed log does not end on its own.'}]],
    [['repair'], 'inspect', 'Preview repair of recorded paths.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'change', reason: 'Rewrite recorded project and checkout paths.'}]],
    [['workspace', 'cleanup'], 'inspect', 'Assess retained workspace resources.', [
      {id: 'delete', forbid: ['--dry-run'], category: 'destroy', reason: 'Delete selected checkouts, branches, data or history.'}]],
    [['workspace', 'data', 'reset'], 'inspect', 'Print a workspace\'s owned data inventory.', [
      {id: 'confirm', any: ['--confirm'], values: ['--confirm'], category: 'destroy', reason: 'Delete a workspace\'s retained data and volumes.'}]],
    [['content', 'apply'], 'routine', 'Apply content edits as one revision-checked transaction.', [
      {id: 'file', any: ['--file'], values: ['--file'], category: 'routine', reason: 'Read the edits from a named file.',
        paths: {'--file': 'read'}, grammar: changeOptions}]],
    [['content', 'import'], 'routine', 'Merge or replace content from a JSON exchange.', [
      {id: 'file', any: ['--file'], values: ['--file'], category: 'routine', reason: 'Read the exchange from a named file.',
        paths: {'--file': 'read'}, grammar: {...changeOptions, values: [...changeOptions.values, '--mode']}}]],
    edits(['workspace', 'update'], 'Update a workspace\'s goal, description, priority or status.'),
    edits(['roadmap', 'add'], 'Add a roadmap item without starting work.'),
    edits(['roadmap', 'update'], 'Update a roadmap item.'),
    [['roadmap', 'remove'], 'routine', 'Remove a roadmap item; content history keeps it.'],
    ...content, ...blockers,
    edits(['handoff', 'set'], 'Save handoff context.'),
    [['handoff', 'clear'], 'routine', 'Clear the saved handoff.'],
    [['review', 'acknowledge'], 'routine', 'Acknowledge changed assumptions.'],
    [['conversation', 'attach'], 'routine', 'Attach an existing thread reference.'],
    [['conversation', 'update'], 'routine', 'Update an association\'s display metadata.'],
    [['conversation', 'detach'], 'routine', 'Remove an association; the host thread remains.'],
    [['conversation', 'focus'], 'routine', 'Request UI focus for a conversation.'],
    [['conversation', 'observe'], 'routine', 'Enable or disable plan suggestions.'],
    [['conversation', 'sync'], 'routine', 'Review or apply goal synchronization with version checks.'],
    [['conversation', 'operation', 'reconcile'], 'routine', 'Verify saved receipts without resending.'],
    [['conversation', 'operation', 'cancel'], 'routine', 'Cancel unsent bridge phases.'],
    [['operation', 'cancel'], 'routine', 'Request cancellation of a durable operation.'],
    // Without --path the checkout uses the recipe's layout; a named folder and
    // an attached directory must be inside the project, or the request asks,
    // because `run` later executes the recipe found there.
    [['workspace', 'create'], 'routine', 'Create a workspace with its checkout and data; starts no services.', [
      {id: 'shell', any: ['--shell'], category: 'execute', reason: 'Open a terminal in the new workspace.'},
      {id: 'path', any: ['--path'], values: ['--path'], category: 'routine', reason: 'Create the checkout in a named folder inside the project.',
        paths: {'--path': 'write'}, unmet: 'folder', grammar: createOptions},
      textFiles(createOptions)]],
    [['workspace', 'attach'], 'routine', 'Register an existing directory without running its recipe.', [
      {id: 'folder', category: 'routine', reason: 'Register a directory inside the project.',
        operandPaths: 'write', unmet: 'folder', grammar: attachOptions},
      textFiles(attachOptions)]],
    [['init'], 'routine', 'Create a starter recipe.'],
    [['run'], 'routine', 'Run the recipe\'s declared services or commands; this trusts project code as builds and tests do.', [
      {id: 'environment', any: ['--set-env'], values: ['--set-env'], category: 'execute',
        reason: 'Override recipe environment values, which can change what the recipe runs.'}]],
    [['stop'], 'routine', 'Stop owned processes, keeping checkout and data.', [
      {id: 'self', any: ['--allow-self-stop'], category: 'execute', reason: 'End the execution hosting this agent.'}]],
    [['project', 'rename'], 'routine', 'Rename a project in workspace addresses.'],
    [['agent', 'preference', 'set'], 'routine', 'Set or clear an agent preference.'],
    [['gateway', 'enable'], 'routine', 'Listen on loopback for workspace routes.'],
    [['gateway', 'disable'], 'routine', 'Close the loopback gateway.'],
    [['conversation', 'archive'], 'change', 'Ask the host to archive a conversation.'],
    [['conversation', 'operation', 'abandon'], 'change', 'Accept an unknown host effect before admitting new work.'],
    [['conversation', 'open'], 'change', 'Create or resume a conversation association.', [
      {id: 'start', any: ['--start', '--prompt', '--prompt-file'], values: ['--prompt', '--prompt-file'], category: 'agent', reason: 'Start agent work with a prompt.'}]],
    [['conversation', 'message'], 'agent', 'Send a prompt that starts or steers agent work.'],
    [['workspace', 'remove'], 'change', 'Remove a workspace registration, keeping its resources.', [
      {id: 'resources', any: ['--cleanup', '--worktree', '--branches', '--data', '--history', '--all', '--delete-checkout', '--forget'],
        category: 'destroy', reason: 'Delete the workspace\'s checkout, branches, data or history.'},
      {id: 'self', any: ['--allow-self-stop'], category: 'execute', reason: 'End the execution hosting this agent.'}]],
    [['recover'], 'change', 'Complete or clean up an interrupted operation.', [
      {id: 'settle', any: ['--settle-compose-creation'], category: 'destroy', reason: 'Remove every labeled Compose object of the generation.'}]],
    [['manager', 'stop'], 'change', 'Stop an idle manager.'],
    [['manager', 'drain'], 'change', 'Stop the manager\'s executions and exit.'],
    [['mcp', 'auth', 'manager', 'stop'], 'change', 'Stop the credential manager.'],
    [['mcp', 'auth', 'manager', 'drain'], 'change', 'Drain and stop the credential manager.'],
    [['exec'], 'execute', 'Run an arbitrary command in the workspace\'s environment.'],
    [['shell'], 'execute', 'Open a terminal or run a command in the workspace\'s environment.'],
    [['--'], 'execute', 'Run a command on a terminal in the current workspace.'],
    [['watch'], 'stream', 'Stream workspace state changes until interrupted.'],
    [['mcp', 'serve'], 'stream', 'Serve MCP over standard input until it closes.'],
    dryRun(['setup'], 'agent setup', 'Publish the project\'s agent configuration to agent files.'),
    dryRun(['config', 'init'], 'configuration initialization', 'Create Box agent configuration.'),
    dryRun(['config', 'convert'], 'configuration conversion', 'Convert agent configuration to the .box layout.'),
    dryRun(['config', 'sync'], 'configuration publication', 'Publish agent configuration to agent files.'),
    dryRun(['config', 'abandon'], 'abandoning a publication', 'Stop retrying an unfinished publication.'),
    [['config', 'repair'], 'integration', 'Finish an interrupted agent configuration publication.'],
    dryRun(['mcp', 'setup'], 'MCP registration', 'Change agent MCP registrations.'),
    dryRun(['mcp', 'sync'], 'MCP server publication', 'Publish an MCP server to agents.'),
    dryRun(['mcp', 'auth', 'setup'], 'MCP passthrough setup', 'Route agents\' remote MCP servers through Box.'),
    dryRun(['mcp', 'tool', 'list'], 'MCP tool discovery', 'Connect to a configured MCP server to list its tools.'),
    [['mcp', 'app', 'create'], 'remote', 'Create a provider OAuth app and write MCP configuration.'],
    [['mcp', 'auth', 'logout'], 'credential', 'Delete a login and revoke its tokens.'],
    [['mcp', 'auth', 'headers'], 'credential', 'Start the credential manager and print request headers.'],
  ],
  risks: [['create-command', ['workspace', 'create'], ['--'], 'execute', 'Run a command in the new workspace.']],
  workspaceSelector: {option: '--project', field: '/project'},
  extraCapabilities: ['argument-paths-v1', 'requirements-v1'],
  exacts: [[['mcp', 'serve', '--check'], 'inspect', 'Print the MCP server identity and tool names without serving.']],
  mcpTools: Object.fromEntries([
    ...['agent_list', 'agent_preference_get', 'agent_show', 'box_docs_list', 'box_docs_read', 'box_docs_search', 'content_export',
      'content_history', 'content_show', 'context_show', 'conversation_list', 'conversation_operation_show', 'conversation_show',
      'conversation_suggestion_list', 'doctor', 'gateway_status', 'logs', 'manager_status', 'operation_show', 'recipe_check',
      'recipe_migrate', 'recipe_plan', 'roadmap_list', 'roadmap_next', 'schema_show', 'status', 'url_list', 'workspace_list']
      .map(name => [name, ['inspect', 'Read workspace state, content or documentation.']]),
    ...['agent_preference_set', 'blocker_add', 'blocker_remove', 'blocker_reopen', 'blocker_resolve', 'blocker_update',
      'content_apply', 'content_import', 'conversation_attach', 'conversation_detach', 'conversation_focus', 'conversation_observe',
      'conversation_operation_cancel', 'conversation_operation_reconcile', 'conversation_sync', 'conversation_update',
      'criterion_add', 'criterion_remove', 'criterion_update', 'evidence_add', 'evidence_remove', 'evidence_update', 'gateway_disable',
      'gateway_enable', 'handoff_clear', 'handoff_set', 'init', 'note_add', 'note_remove', 'note_update', 'operation_cancel',
      'project_rename', 'reference_add', 'reference_remove', 'reference_update', 'review_acknowledge', 'roadmap_add', 'roadmap_remove',
      'roadmap_update', 'workspace_update']
      .map(name => [name, ['routine', 'Change workspace content, checkouts or recipe executions.']]),
    // MCP rules cannot check where a path resolves: an explicit checkout folder
    // asks, and attaching always names one.
    ['workspace_create', ['routine', 'Create a workspace in the recipe\'s checkout layout.', [
      {id: 'path', fields: {'/path': {text: {not: {exact: ''}}}}, category: 'folder', reason: 'Create the checkout in a named folder; review where it is.'}]]],
    ['workspace_attach', ['folder', 'Register an existing directory, whose recipe run later executes; review where it is.']],
    ['run', ['routine', 'Run the recipe\'s declared services or commands.', [
      {id: 'environment', fields: {'/set_env/0': {text: {not: {exact: ''}}}}, category: 'execute',
        reason: 'Override recipe environment values, which can change what the recipe runs.'}]]],
    ['stop', ['routine', 'Stop owned executions, keeping checkout and data.', [
      {id: 'self', fields: {'/allow_self_stop': {exact: true}}, category: 'execute', reason: 'End the execution hosting this agent.'}]]],
    ['repair', ['inspect', 'Preview repair of recorded paths.', [
      {id: 'apply', fields: {'/dry_run': {exact: false}}, category: 'change', reason: 'Rewrite recorded project and checkout paths.'}]]],
    ['workspace_cleanup', ['destroy', 'Delete selected workspace resources.', [
      {id: 'dry-run', fields: {'/dry_run': {exact: true}}, category: 'inspect', reason: 'Assess retained resources without deleting them.'}]]],
    ['workspace_data_reset', ['destroy', 'Delete a workspace\'s retained data and volumes.']],
    ['workspace_remove', ['change', 'Remove a workspace registration.', [
      {id: 'delete-checkout', fields: {'/delete_checkout': {exact: true}}, category: 'destroy', reason: 'Delete the managed checkout.'},
      {id: 'forget', fields: {'/forget': {exact: true}}, category: 'destroy', reason: 'Delete the workspace\'s saved history.'},
      {id: 'self', fields: {'/allow_self_stop': {exact: true}}, category: 'execute', reason: 'End the execution hosting this agent.'}]]],
    ['recover', ['change', 'Clean up an interrupted operation.', [
      {id: 'settle', fields: {'/settle_compose_creation': {exact: true}}, category: 'destroy', reason: 'Remove every labeled Compose object of the generation.'}]]],
    ['conversation_open', ['change', 'Create or resume a conversation association.', [
      {id: 'start', fields: {'/start': {exact: true}}, category: 'agent', reason: 'Start agent work with a prompt.'}]]],
    ['conversation_archive', ['change', 'Ask the host to archive a conversation.']],
    ['conversation_operation_abandon', ['change', 'Accept an unknown host effect.']],
    ['manager_drain', ['change', 'Stop the manager\'s executions.']],
    ['manager_stop', ['change', 'Stop an idle manager.']],
    ['conversation_message', ['agent', 'Send a prompt that starts or steers agent work.']],
    ['exec', ['execute', 'Run an arbitrary command in the workspace\'s environment.']],
    ['watch', ['stream', 'Stream workspace state changes.']],
  ]),
};
