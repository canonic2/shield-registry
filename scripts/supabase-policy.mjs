import {executableForms} from './tool-pack.mjs';

export const version = '0.1.2';
export const engine = '>=0.60.1, <1.0.0';

const inspect = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const change = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const highImpact = {loose: 'ask', recommended: 'deny', strict: 'deny'};

// The display grammar is shared by the account inspection commands. The full
// leading grammar recognizes target-changing flags for effect classification.
const display = {flags: [], values: ['--output', '-o', '--output-format', '--agent'], optional_values: ['--yes']};
const leading = {
  ...display,
  values: [...display.values, '--workdir', '--profile', '--network-id', '--dns-resolver', '--log-level'],
  optional_values: [...display.optional_values, '--debug', '--experimental', '--create-ticket'],
  interleaved: true,
};

const mcpEndpoint = 'https://mcp\\.supabase\\.com/mcp';
const projectRef = 'project_ref=[a-z]{20}';
const readOnly = 'read_only=(?:true|false)';
const features = 'features=[a-z]+(?:(?:,|%2[cC])[a-z]+)*';
// Match whole query strings. A parameter must occur at most once, and
// confirmation-suppression parameters never qualify for this integration.
const queries = [projectRef, readOnly, features, `${readOnly}&${features}`, `${features}&${readOnly}`, ...[readOnly, features].flatMap(option => [
  `${projectRef}&${option}`, `${option}&${projectRef}`,
]), ...[projectRef, readOnly, features].flatMap(first => {
  const [second, third] = [projectRef, readOnly, features].filter(option => option !== first);
  return [`${first}&${second}&${third}`, `${first}&${third}&${second}`];
})];
const readOnlyQueries = queries.filter(query => query.includes(projectRef) && query.includes(readOnly))
  .map(query => query.replace(readOnly, 'read_only=true').replace(features, 'features=database'));
const readOnlySqlUrl = `${mcpEndpoint}\\?(?:${readOnlyQueries.join('|')})`;
const readOnlySqlEnabled = [{var: 'read_only_sql', set: true}];
const readOnlySqlPart = index => ({text: {var: 'read_only_sql', split: {separator: ' ', index}}});
const hostedSql = {domain: 'mcp', server: 'hosted', tool: 'execute_sql'};

const cliChanges = [
  'db query', 'db reset', 'db push', 'db pull', 'db dump', 'db diff',
  'migration up', 'migration down', 'migration repair', 'migration squash',
  'config push', 'functions deploy', 'functions serve', 'functions download',
  'notebooks push', 'projects create', 'branches create', 'branches update', 'branches unpause',
  'storage cp', 'storage mv', 'storage rm', 'seed buckets', 'feedback add', 'feedback delete',
];
const cliHighImpact = [
  'projects delete', 'projects api-keys', 'branches delete', 'branches disable', 'branches pause', 'functions delete', 'secrets',
  'encryption', 'login', 'logout',
];

// Review implicit project files and process ownership for local operations.
// A local database can contain valuable data, so destructive local operations
// retain review even when their target is explicitly local.
const cliLocal = ['init', 'start', 'stop', 'db start', 'functions new',
  'test new', 'stack start', 'stack stop', 'stack restart', 'stack install', 'stack update'];
const cliReads = ['status', 'services', 'whoami', 'gen types', 'migration list', 'functions list',
  'branches list', 'branches get', 'storage ls', 'db lint', 'db advisors', 'inspect',
  'logs', 'config diff', 'config validate', 'stack status', 'stack list', 'stack logs', 'stack outdated'];
const additionalChanges = ['bootstrap', 'pull', 'link', 'unlink', 'migration fetch', 'config pull', 'config convert',
  'db schema', 'db branch', 'db remote', 'test db', 'gen keys', 'gen jwt', 'notebooks pull', 'issue', 'telemetry',
  'orgs create', 'snippets', 'completion', 'compute'];
const additionalHighImpact = ['backups', 'domains', 'network-bans', 'network-restrictions',
  'postgres-config', 'ssl-enforcement', 'sso', 'vanity-subdomains', 'stack destroy', 'stack prune'];

const metadataTools = [
  'list_tables', 'list_extensions', 'list_migrations', 'list_edge_functions',
  'list_branches', 'list_storage_buckets', 'get_storage_config',
  'generate_typescript_types', 'get_publishable_keys', 'list_notebooks',
];

const mcpChanges = [
  'execute_sql', 'apply_migration', 'deploy_edge_function', 'update_storage_config',
  'create_branch', 'merge_branch', 'rebase_branch', 'create_project', 'restore_project',
  'confirm_cost', 'create_notebook', 'run_notebook', 'submit_feedback', 'delete_feedback',
];
const mcpHighImpact = [
  'create_edge_function_secret', 'delete_branch', 'reset_branch', 'pause_project', 'delete_notebook',
];
const mcpReview = [
  'get_logs', 'query_logs', 'get_edge_function', 'get_notebook',
  'list_projects', 'get_project', 'list_organizations', 'get_organization', 'get_cost',
];

export function supabasePack() {
  const executable = {one_of: executableForms('supabase')};
  const argv = (id, args, decision, reason, extra = {}) => ({
    id, conditions: {domain: 'argv', executable, arguments: args, ...extra}, decision, reason,
  });
  const versionRule = (id, flag) => argv(id, {kind: 'exact', values: [flag]}, 'allow', 'Print the installed version.');
  const cliEffect = (command, decision, reason) => argv(command.replaceAll(' ', '-'),
    {kind: 'prefix', values: command.split(' '), leading}, decision, reason);
  const mcp = (tool, decision, reason, fields) => ({
    id: `mcp-${tool}`, conditions: {domain: 'mcp', server: {one_of: ['hosted', 'local']}, tool, ...(fields ? {fields} : {})}, decision, reason,
  });
  const mcpRules = [
    mcp('search_docs', 'allow', 'Search the public Supabase documentation.', {'/graphql_query': {text: {regex: '(?s:.*\\S.*)'}}}),
    mcp('get_project_url', 'allow', 'Read the configured project’s API URL.'),
    mcp('get_advisors', inspect, 'Read diagnostics for the configured project.', {'/type': {text: {one_of: ['security', 'performance', 'health']}}}),
    ...metadataTools.map(tool => mcp(tool, inspect, 'Read metadata for the configured project.')),
    ...mcpReview.map(tool => mcp(tool, 'ask', 'Review access to logs, stored content or account data.')),
    ...mcpChanges.map(tool => mcp(tool, change, 'Review SQL execution, deployment, billing, configuration changes or data sent to Supabase.')),
    ...mcpHighImpact.map(tool => mcp(tool, highImpact, 'Review changes to secrets, service availability or deletion of project resources.')),
    {id: 'mcp-execute-sql-read-only', when: readOnlySqlEnabled, conditions: {...hostedSql,
      fields: {'/query': {text: {regex: '(?s:.*\\S.*)'}}},
      connection: {'/transport/url': {text: {regex: `^${readOnlySqlUrl}$`}}}},
    decision: 'allow', reason: 'Send SQL to the reviewed project-scoped read-only connection.'},
  ];
  // Unconditional tool rules and fallback rules tie on specificity in Shield.
  // Exclude tools with unconditional decisions, retaining fallback for unmet fields.
  const classifiedTools = mcpRules.filter(rule => !rule.conditions.fields).map(rule => rule.conditions.tool);

  return {
    schema_version: 1, kind: 'pack', id: 'canonic/supabase', version,
    description: 'Supabase CLI and hosted/local MCP, with reviewed lifecycle, database, deployment, credentials and storage operations.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    capabilities: ['access-paths-v1', 'argument-rules-v1', 'environment-unset-or-empty-v1', 'fallback-rules-v1', 'interleaved-leading-v1',
      'location-v1', 'mcp-connection-facts-v1', 'mcp-integrations-v1', 'negated-selectors-v1',
      'preconditions-v1', 'prefix-leading-v1', 'regex-v1', 'requirements-v1', 'structured-rules-v1', 'supabase-test-db-v1', 'unknown-options-v1',
      'variable-list-branches-v1', 'variable-parts-v1', 'variables-v1'],
    variables: {
      test_db_container: {type: 'string', layer: 'local',
        description: 'Trust test code in this checkout to run against its verified local Docker database. Enter the full container ID for its reviewed Supabase database.',
        match: {regex: '^[0-9a-f]{64}$'}},
      read_only_sql: {type: 'list', layer: 'local', max_items: 16,
        description: 'Allow SQL on each listed managed connection. Enter the Shield connection ID, one space, and its exact project-scoped Supabase URL with read_only=true and optional features=database.',
        items: {type: 'string', match: {regex: `^[A-Za-z0-9._-]{1,128} ${readOnlySqlUrl}$`}}},
    },
    mcp_integrations: {
      hosted: {transport: 'http', fields: {'/url': {text: {regex: `^${mcpEndpoint}(?:\\?(?:${queries.join('|')}))?$`}}}},
      local: {transport: 'http', fields: {'/url': {text: {regex: 'http://(?:localhost|127\\.0\\.0\\.1):54321/mcp'}}}},
    },
    preconditions: [{id: 'mcp-read-only-sql-connection', when: readOnlySqlEnabled,
      conditions: hostedSql,
      requires_any: [{connection: {'/id': readOnlySqlPart(0), '/transport/url': readOnlySqlPart(1)}}],
      on_unmet: {decision: change, message: 'Review SQL execution on this connection. Automatic allowance requires a matching reviewed connection ID and read-only URL.'}}],
    rules: [
      versionRule('version', '--version'), versionRule('version-short', '-v'),
      ...[['help', '--help'], ['help-short', '-h']].map(([id, flag]) => argv(id, {
        kind: 'options', prefix: [], flags: [flag], values: [], short_clusters: false,
        require_all: [flag], operands: {match: {regex: '^[a-z][a-z0-9-]*$'}},
      }, 'allow', 'Print built-in help for any Supabase command path.')),
      ...['projects list', 'orgs list'].map(command => argv(command.replaceAll(' ', '-'), {
        kind: 'options', prefix: command.split(' '), ...display, leading: {...display, interleaved: true}, operands: false,
      }, inspect, 'List metadata for the current Supabase account.', {cwd: {within: {root: 'read'}}})),
      ...cliChanges.map(command => cliEffect(command, change, 'Review the selected database, files, deployment or remote changes.')),
      ...cliHighImpact.map(command => cliEffect(command, highImpact, 'This can expose credentials, change authentication or delete remote resources.')),
      ...cliLocal.map(command => cliEffect(command, 'ask', 'Review local configuration, filesystem writes and container or process lifecycle.')),
      {
        ...cliEffect('migration new', 'allow', 'Create a local migration in the approved checkout.'),
        requirements: {
          arguments: {kind: 'sequence', prefix: ['migration', 'new', {regex: '^[A-Za-z0-9][A-Za-z0-9_-]*$'}], rest: {kind: 'none'}},
          cwd: {within: {root: 'project'}},
          environment: {unset_or_empty: ['SUPABASE_WORKDIR', 'SUPABASE_PROFILE', 'SUPABASE_HOME', 'BUN_OPTIONS']},
          targets: {action: 'write', all: {within: {root: 'project'}, exclude: [
            {root: 'project', path: '.git'}, {root: 'project', path: '.shield'},
          ]}},
        },
        on_unmet: {decision: 'ask', message: 'Review the migration. Automatic allowance requires one slug, default CLI configuration and a verified destination in the checkout.'},
      },
      ...cliReads.map(command => cliEffect(command, 'ask', 'Review the selected project, connection, logs and any generated output.')),
      ...additionalChanges.map(command => cliEffect(command, change, 'Review implicit file changes, execution and remote project effects.')),
      {
        ...argv('test-db-local', {kind: 'exact', values: ['test', 'db']}, 'allow',
          'Run checkout pgTAP tests on its verified local Docker database.'),
        when: [{var: 'test_db_container', set: true}],
        requirements: {supabase_test_db: {var: 'test_db_container'}},
        on_unmet: {decision: change, message: 'Review the Supabase test run. The default test tree and reviewed running Docker database must both be verified.'},
      },
      ...additionalHighImpact.map(command => cliEffect(command, highImpact, 'Review service security, backups, resource deletion or access settings.')),
      ...['db reset', 'db push', 'migration down', 'migration repair', 'migration squash'].map(command => argv(
        `${command.replaceAll(' ', '-')}-hosted`, {kind: 'options', prefix: command.split(' '), leading,
          flags: ['--linked', '--local'], values: ['--db-url', '--project-ref'], optional_values: ['--remote'],
          operands: true, unknown_options: 'skip', require_any: ['--remote', '--linked', '--db-url', '--project-ref']},
        highImpact, 'Review destructive or schema-changing operations on an explicit hosted database target.')),
      {...argv('cli-review', {kind: 'any'}, 'ask', 'Review the Supabase command and any implicit paths, credentials or target selection.'), fallback: true},

      ...mcpRules,
      {id: 'mcp-review', conditions: {domain: 'mcp', server: {one_of: ['hosted', 'local']}, tool: {not: {one_of: classifiedTools}}}, decision: 'ask',
        reason: 'Review unclassified Supabase MCP requests or requests missing required arguments.', fallback: true},
    ],
  };
}
