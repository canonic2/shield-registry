// Expected decisions are independent of the policy constructors.
const profiles = ['loose', 'recommended', 'strict'];
const allow = ['allow', 'allow', 'allow'];
const inspect = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const change = ['ask', 'ask', 'deny'];
const sensitive = ['ask', 'deny', 'deny'];
const sampleId = '00000000-0000-4000-8000-000000000001';

const cli = [
  [['--version'], allow],
  [['-v'], allow],
  [['-h'], allow],
  [['--help'], allow],
  [['projects', 'list'], inspect],
  [['orgs', 'list', '--output', 'json'], inspect],
  [['--agent', 'no', 'projects', 'list', '-o', 'table'], inspect],
  [['orgs', '--output-format=json', 'list'], inspect],
  [['projects', 'list', '--workdir=/outside'], review],
  [['--workdir', '/outside', 'projects', 'list'], review],
  [['orgs', '--profile', 'other', 'list'], review],
  [['projects', 'list', '--debug'], review],
  [['projects', 'list', '--experimental'], review],
  [['projects', 'list', '--remote'], review],
  [['projects', 'list', '--output'], review],
  [['projects', 'list', '--', 'other'], review],
  [['project', 'list'], review],
  [['projects', 'list-extra'], review],
  [['init', '--force'], review],
  [['start'], review],
  [['stop', '--all', '--no-backup'], review],
  [['status', '-o', 'env'], review],
  [['migration', 'new', 'add_widgets'], review],
  [['gen', 'types', '--local', '--schema', 'public'], review],
  [['gen', 'types', '--remote=abcdefghijklmnopqrst'], review],
  [['db', 'query', 'select 1'], change],
  [['db', 'query', '--file', '/outside/query.sql', '--remote=staging'], change],
  [['db', 'push', '--dry-run'], change],
  [['db', '--profile', 'other', 'push', '--remote', '--yes'], sensitive],
  [['--yes=true', 'db', 'reset', '--remote'], sensitive],
  [['db', 'dump', '-f', '/outside/export.sql'], change],
  [['db', 'pull'], change],
  [['db', 'diff', '--file', 'changes'], change],
  [['migration', 'repair', '20261123000000'], change],
  [['migration', 'up'], change],
  [['migration', 'down'], change],
  [['migration', 'squash'], change],
  [['config', 'push'], change],
  [['functions', 'serve', '--env-file=/outside/runtime.env'], change],
  [['functions', 'download', 'example'], change],
  [['functions', 'deploy', 'example', '--no-verify-jwt'], change],
  [['notebooks', 'push'], change],
  [['projects', 'create', 'example'], change],
  [['branches', 'create', 'staging'], change],
  [['branches', 'update', 'staging'], change],
  [['branches', 'unpause', 'staging'], change],
  [['storage', 'cp', '/outside/input', 'ss:///example/'], change],
  [['storage', 'mv', 'ss:///example/key', 'ss:///example/new-key'], change],
  [['storage', 'rm', 'ss:///example/key'], change],
  [['seed', 'buckets'], change],
  [['feedback', 'add'], change],
  [['feedback', 'delete', 'example'], change],
  [['--workdir=/outside', 'projects', '--output=json', 'delete', 'abcdefghijklmnopqrst'], sensitive],
  [['projects', 'api-keys'], sensitive],
  [['branches', 'delete', 'staging'], sensitive],
  [['branches', 'disable'], sensitive],
  [['branches', 'pause', 'staging'], sensitive],
  [['functions', 'delete', 'example'], sensitive],
  [['secrets', 'set', '--env-file', '/outside/runtime.env'], sensitive],
  [['encryption', 'get-root-key'], sensitive],
  [['login', '--token', 'example'], sensitive],
  [['logout'], sensitive],
  [['future-command'], review],
];

const shell = [
  ['supabase --output=json projects list', inspect],
  ['supabase projects list --workdir /outside', review],
  ['supabase db --yes=true reset --remote', sensitive],
  ['supabase --debug=false projects delete abcdefghijklmnopqrst', sensitive],
  ['supabase db push --help', allow],
];

const expandedCli = [
  [['db', 'start'], review], [['functions', 'new', 'widget'], review],
  [['test', 'new', 'widget'], review], [['test', 'db'], change],
  [['stack', 'start'], review], [['stack', 'stop'], review], [['stack', 'restart'], review],
  [['stack', 'install'], review], [['stack', 'update'], review], [['stack', 'status'], review],
  [['stack', 'list'], review], [['stack', 'logs'], review], [['stack', 'outdated'], review],
  [['stack', 'destroy'], sensitive], [['stack', 'prune'], sensitive],
  [['services'], review], [['whoami'], review], [['migration', 'list'], review],
  [['functions', 'list'], review], [['branches', 'list'], review], [['branches', 'get', 'staging'], review],
  [['storage', 'ls'], review], [['db', 'lint'], review], [['db', 'advisors'], review],
  [['inspect', 'db', 'table-sizes'], review], [['logs'], review],
  [['config', 'diff'], review], [['config', 'validate'], review],
  [['bootstrap'], change], [['pull'], change], [['link'], change], [['unlink'], change],
  [['migration', 'fetch'], change], [['config', 'pull'], change], [['config', 'convert'], change],
  [['db', 'schema', 'diff'], change], [['db', 'branch'], change], [['db', 'remote'], change],
  [['gen', 'keys'], change], [['notebooks', 'pull'], change], [['issue', 'bug'], change],
  [['telemetry', 'disable'], change], [['orgs', 'create'], change], [['snippets', 'list'], change],
  [['completion', 'bash'], change], [['compute'], change],
  [['backups', 'restore'], sensitive], [['domains', 'create'], sensitive],
  [['network-bans', 'remove'], sensitive], [['network-restrictions', 'update'], sensitive],
  [['postgres-config', 'update'], sensitive], [['ssl-enforcement', 'update'], sensitive],
  [['sso', 'add'], sensitive], [['vanity-subdomains', 'activate'], sensitive],
  [['db', 'reset', '--local'], change], [['db', 'push', '--local'], change],
  [['db', 'reset', '--db-url=postgresql://example.com/postgres'], sensitive],
  [['db', 'reset', '--linked'], sensitive], [['db', 'push', '--remote=staging'], sensitive],
  [['migration', 'down', '--project-ref', 'abcdefghijklmnopqrst'], sensitive],
  [['migration', 'repair', '--linked'], sensitive], [['migration', 'squash', '--remote'], sensitive],
  [['db', 'reset', '--local', '--remote=staging'], sensitive],
  [['db', '--help'], allow], [['db', 'push', '--help'], allow], [['db', 'push', '-h'], allow],
  [['projects', 'list', '--help'], allow], [['projects', 'delete', '--help'], allow],
  [['inspect', 'db', 'table-sizes', '--help'], allow], [['secrets', 'set', '-h'], allow],
  [['future-command', '--help'], allow], [['future-command', 'nested', 'topic2', 'child', '-h'], allow],
  [['db', 'push', '--help=false'], change], [['db', 'push', '--', '--help'], change],
  [['db', 'push', '--remote', '--help'], sensitive], [['db', 'push', '--db-url', '--help'], sensitive],
  [['db', 'push', '--workdir', '/outside', '--help'], change], [['db', 'push', '/outside', '--help'], change],
];

const graphql_query = '{ searchDocs(query: "local development") { totalCount } }';
const mcp = [
  ['search_docs', {graphql_query}, allow],
  ['get_project_url', {}, allow],
  ['get_advisors', {type: 'security'}, inspect],
  ['list_tables', {schemas: ['public'], verbose: true}, inspect],
  ['list_extensions', {}, inspect],
  ['list_migrations', {}, inspect],
  ['list_edge_functions', {}, inspect],
  ['list_branches', {}, inspect],
  ['list_storage_buckets', {}, inspect],
  ['get_storage_config', {}, inspect],
  ['generate_typescript_types', {}, inspect],
  ['get_publishable_keys', {}, inspect],
  ['list_notebooks', {}, inspect],
  ['get_logs', {service: 'postgres'}, review],
  ['query_logs', {sql: 'select timestamp from postgres_logs limit 1'}, review],
  ['get_edge_function', {function_slug: 'widget'}, review],
  ['get_notebook', {notebook_id: sampleId}, review],
  ['list_projects', {}, review],
  ['get_project', {id: 'abcdefghijklmnopqrst'}, review],
  ['list_organizations', {}, review],
  ['get_organization', {id: 'abcdefghijklmnopqrst'}, review],
  ['get_cost', {type: 'project', organization_id: 'abcdefghijklmnopqrst'}, review],
  ['execute_sql', {query: 'select 1'}, change],
  ['apply_migration', {name: 'add_widgets', query: 'create table widgets(id int)'}, change],
  ['deploy_edge_function', {name: 'widget', entrypoint_path: 'index.ts', files: [{name: 'index.ts', content: 'export {};'}]}, change],
  ['update_storage_config', {config: {fileSizeLimit: 1024, features: {imageTransformation: {enabled: false}, s3Protocol: {enabled: false}}}}, change],
  ['create_branch', {name: 'staging', confirm_cost_id: 'example'}, change],
  ['merge_branch', {branch_id: 'abcdefghijklmnopqrst'}, change],
  ['rebase_branch', {branch_id: 'abcdefghijklmnopqrst'}, change],
  ['create_project', {name: 'example', region: 'us-east-1', organization_id: sampleId, confirm_cost_id: 'example'}, change],
  ['restore_project', {project_id: 'abcdefghijklmnopqrst'}, change],
  ['confirm_cost', {type: 'project', recurrence: 'monthly', amount: 10}, change],
  ['create_notebook', {name: 'Example', content: {cells: []}}, change],
  ['run_notebook', {notebook_id: sampleId, expected_updated_at: '2026-11-23T00:00:00Z'}, change],
  ['submit_feedback', {feedback: 'Example documentation feedback'}, change],
  ['delete_feedback', {delete_token: sampleId}, change],
  ['create_edge_function_secret', {name: 'EXAMPLE_KEY'}, sensitive],
  ['delete_branch', {branch_id: 'abcdefghijklmnopqrst'}, sensitive],
  ['reset_branch', {branch_id: 'abcdefghijklmnopqrst'}, sensitive],
  ['pause_project', {project_id: 'abcdefghijklmnopqrst'}, sensitive],
  ['delete_notebook', {notebook_id: sampleId}, sensitive],
];

export const reviewedMcpTools = mcp.map(([tool]) => tool);

export const hosted = 'https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst';

export function mcpCase(name, profile, tool, args, expected, {
  server = 'supabase', transport = {type: 'http', url: hosted}, explicit = false,
  variables,
} = {}) {
  return {name, profile, expected, input: {kind: 'mcp', server, tool, arguments: args, original_input: {}},
    mcp: {[server]: {transport, agents: {codex: server}, ...(explicit ? {packs: {'canonic/supabase': 'hosted'}} : {})}},
    ...(variables ? {variables} : {})};
}

function readOnlySqlCases(profile, reviewedDecision) {
  const first = `${hosted}&read_only=true&features=database`;
  const second = 'https://mcp.supabase.com/mcp?read_only=true&project_ref=zyxwvutsrqponmlkjihg';
  const variables = {read_only_sql: [`project-data ${first}`, `other-data ${second}`]};
  const sql = {query: 'select 1'};
  return [
    ['first-connection', 'project-data', first, 'execute_sql', sql, 'allow'],
    ['second-connection', 'other-data', second, 'execute_sql', sql, 'allow'],
    ['different-connection-same-url', 'unlisted', first, 'execute_sql', sql, reviewedDecision],
    ['submitted-connection-id', 'unlisted', first, 'execute_sql', {...sql, id: 'project-data'}, reviewedDecision],
    ['other-reviewed-url', 'project-data', second, 'execute_sql', sql, reviewedDecision],
    ['changed-project', 'project-data', first.replace('abcdefghijklmnopqrst', 'bcdefghijklmnopqrstu'), 'execute_sql', sql, reviewedDecision],
    ['missing-read-only', 'project-data', hosted, 'execute_sql', sql, reviewedDecision],
    ['writable', 'project-data', `${hosted}&read_only=false`, 'execute_sql', sql, reviewedDecision],
    ['duplicate', 'project-data', `${first}&read_only=true`, 'execute_sql', sql, 'ask'],
    ['conflicting', 'project-data', `${first}&read_only=false`, 'execute_sql', sql, 'ask'],
    ['local', 'project-data', 'http://localhost:54321/mcp', 'execute_sql', sql, reviewedDecision],
    ['missing-query', 'project-data', first, 'execute_sql', {}, reviewedDecision],
    ['malformed-query', 'project-data', first, 'execute_sql', {query: false}, reviewedDecision],
    ['migration', 'project-data', first, 'apply_migration', {name: 'widgets', query: 'create table widgets(id int)'}, reviewedDecision],
  ].map(([name, server, url, tool, args, expected]) => mcpCase(
    `opt-in-${name}-${profile}`, profile, tool, args, expected, {server, transport: {type: 'http', url}, variables},
  ));
}

export function supabaseCases() {
  return {schema_version: 1, cases: profiles.flatMap((profile, index) => [
    ...[...cli, ...expandedCli].map(([args, expected], n) => ({name: `cli-${n}-${args[0]}-${profile}`, profile, argv: ['supabase', ...args], expected: expected[index]})),
    {name: `cli-homebrew-${profile}`, profile, argv: ['/opt/homebrew/bin/supabase', 'orgs', 'list'], expected: inspect[index]},
    {name: `cli-foreign-${profile}`, profile, argv: ['/tmp/supabase', '--version'], expected: 'ask'},
    ...shell.map(([source, expected], n) => ({name: `shell-${n}-${profile}`, profile, expected: expected[index],
      input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
    })),
    ...mcp.map(([tool, args, expected]) => mcpCase(`${tool}-${profile}`, profile, tool, args, expected[index])),
    ...['https://mcp.supabase.com/mcp', 'https://mcp.supabase.com/mcp?read_only=true',
      'https://mcp.supabase.com/mcp?features=database%2Cdocs', 'http://localhost:54321/mcp',
      'http://127.0.0.1:54321/mcp'].flatMap((url, n) => [
      mcpCase(`endpoint-${n}-metadata-${profile}`, profile, 'list_tables', {project_id: 'abcdefghijklmnopqrst'}, inspect[index], {transport: {type: 'http', url}}),
      mcpCase(`endpoint-${n}-sql-${profile}`, profile, 'execute_sql', {query: 'select 1', project_id: 'abcdefghijklmnopqrst'}, change[index], {transport: {type: 'http', url}}),
      mcpCase(`endpoint-${n}-unknown-${profile}`, profile, 'future_tool', {}, 'ask', {transport: {type: 'http', url}}),
    ]),
    mcpCase(`unknown-mcp-${profile}`, profile, 'future_tool', {}, 'ask'),
    mcpCase(`missing-docs-query-${profile}`, profile, 'search_docs', {}, 'ask'),
    mcpCase(`malformed-docs-query-${profile}`, profile, 'search_docs', {graphql_query: []}, 'ask'),
    mcpCase(`blank-docs-query-${profile}`, profile, 'search_docs', {graphql_query: ' \n '}, 'ask'),
    mcpCase(`missing-advisor-type-${profile}`, profile, 'get_advisors', {}, 'ask'),
    mcpCase(`invalid-advisor-type-${profile}`, profile, 'get_advisors', {type: 'other'}, 'ask'),
    mcpCase(`sql-missing-query-${profile}`, profile, 'execute_sql', {}, change[index]),
    mcpCase(`readonly-alias-${profile}`, profile, 'list_tables', {}, inspect[index], {
      server: 'project_data', transport: {type: 'http', url: `${hosted}&read_only=true`}, explicit: true,
    }),
    mcpCase(`readonly-sql-${profile}`, profile, 'execute_sql', {query: 'select 1'}, change[index], {
      transport: {type: 'http', url: `${hosted}&read_only=true`},
    }),
    ...readOnlySqlCases(profile, change[index]),
    mcpCase(`reordered-query-${profile}`, profile, 'search_docs', {graphql_query}, 'allow', {
      transport: {type: 'http', url: 'https://mcp.supabase.com/mcp?features=database%2Cdocs&read_only=false&project_ref=abcdefghijklmnopqrst'},
    }),
  ])};
}
