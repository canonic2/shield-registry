const profiles = ['loose', 'recommended', 'strict'];
const allow = ['allow', 'allow', 'allow'];
const metadata = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const protectedEffect = ['ask', 'ask', 'deny'];

// Expectations follow the CLI and published MCP schemas independently of the policy.
const cli = [
  ['version', ['--version'], allow],
  ['help', ['help', 'secrets', 'download'], allow],
  ['run-help', ['run', '--help'], allow],
  ['identity', ['whoami', '--json'], metadata],
  ['projects', ['--json', 'projects', '-n10', '--page=2', '--timeout=5s'], metadata],
  ['project', ['projects', '--silent', 'get', 'acme-app'], metadata],
  ['configs', ['configs', '--project=acme-app', '-edev'], metadata],
  ['config', ['configs', '--json', 'get', '-p', 'acme-app', '-cdev'], metadata],
  ['environments', ['environments', '-p', 'acme-app'], metadata],
  ['environment', ['environments', 'get', 'dev', '-p', 'acme-app'], metadata],
  ['environment-missing', ['environments', 'get', '-p', 'acme-app'], review],
  ['tags', ['tags', '--json'], metadata],
  ['secret-names', ['--silent', 'secrets', '--only-names', '-pacme-app', '--config=dev', '--json'], metadata],
  ['secret-names-remaining-operands', ['secrets', '--only-names', '--', 'get', 'EXAMPLE_KEY'], protectedEffect],
  ['secret-names-positional', ['secrets', '--', '--only-names'], protectedEffect],
  ['secret-names-as-value', ['secrets', '--project', '--only-names'], protectedEffect],
  ['secret-names-false', ['secrets', '--only-names=false', '--json'], protectedEffect],
  ['secret-names-repeated-false', ['secrets', '--only-names', '--only-names=false'], protectedEffect],
  ['secret-names-before-get', ['secrets', '--only-names', 'get', 'EXAMPLE_KEY'], protectedEffect],
  ['secret-names-missing-scope-value', ['secrets', '--only-names', '-p'], protectedEffect],
  ['secret-values', ['secrets', '--json'], protectedEffect],
  ['secret-get', ['secrets', 'get', 'EXAMPLE_KEY', '--plain'], protectedEffect],
  ['secret-clipboard', ['secrets', 'get', 'EXAMPLE_KEY', '--copy'], protectedEffect],
  ['secret-download-stdout', ['secrets', 'download', '--no-file', '--format=json'], protectedEffect],
  ['secret-download-path', ['secrets', 'download', '/outside/example.env'], protectedEffect],
  ['secret-substitute', ['secrets', 'substitute', './template.txt'], protectedEffect],
  ['secret-upload', ['secrets', 'upload', './example.env'], protectedEffect],
  ['secret-write', ['secrets', 'set', 'EXAMPLE_KEY=placeholder'], protectedEffect],
  ['secret-notes', ['secrets', 'notes', 'set', 'EXAMPLE_KEY', 'example'], protectedEffect],
  ['secret-delete', ['secrets', 'delete', 'EXAMPLE_KEY', '--yes'], protectedEffect],
  ['run-child', ['run', '--', 'npm', 'start'], protectedEffect],
  ['run-command', ['--silent', 'run', '--command=echo example'], protectedEffect],
  ['run-mount', ['run', '--mount', './example.env', '--', 'app'], protectedEffect],
  ['legacy-secrets', ['enclave', 'secrets', 'get', 'EXAMPLE_KEY'], protectedEffect],
  ['login', ['login', '--scope=./'], protectedEffect],
  ['oidc', ['oidc', 'login', '--identity', 'example'], protectedEffect],
  ['local-config', ['configure', 'get', 'token', '--plain'], protectedEffect],
  ['token-mint', ['configs', '--json', 'tokens', 'create', 'example', '--plain'], protectedEffect],
  ['config-rollback', ['configs', 'logs', '--silent', 'rollback', 'example'], protectedEffect],
  ['project-delete', ['--json', 'projects', '--silent', 'delete', 'acme-app', '--yes'], protectedEffect],
  ['tls', ['--no-verify-tls', 'projects'], review],
  ['host', ['projects', '--api-host=https://example.org'], review],
  ['host-between-path', ['projects', '--api-host', 'https://example.org', 'get', 'acme-app'], review],
  ['config-dir', ['projects', '--config-dir', '/outside/store'], review],
  ['scope', ['--scope=../another-project', 'configs'], review],
  ['hidden-configuration', ['projects', '--configuration=/outside/doppler.yml'], review],
  ['token-arg', ['projects', '-tplaceholder'], review],
  ['long-token-arg', ['projects', '--token=placeholder'], review],
  ['leading-token-arg', ['-t', 'placeholder', 'projects'], review],
  ['debug', ['configs', '--debug'], review],
  ['dump-config', ['--print-config', 'projects'], review],
  ['dns', ['--enable-dns-resolver', 'projects', '--dns-resolver-address=192.0.2.5:53'], review],
  ['unknown-option', ['projects', '--future-flag'], review],
  ['missing-option-value', ['projects', '--page'], review],
  ['future-command', ['future', 'list'], review],
];

const scope = {project: 'acme-app', config: 'dev'};
const mcp = [
  ['projects', 'projects_list', {page: 2}, metadata],
  ['project', 'projects_get', {project: 'acme-app'}, metadata],
  ['environments', 'environments_list', {project: 'acme-app'}, metadata],
  ['environment', 'environments_get', {project: 'acme-app', environment: 'dev'}, metadata],
  ['configs', 'configs_list', {project: 'acme-app', environment: 'dev'}, metadata],
  ['config', 'configs_get', scope, metadata],
  ['names', 'secrets_names', {...scope, include_dynamic_secrets: true}, metadata],
  ['project-missing', 'projects_get', {}, review],
  ['environment-missing', 'environments_get', {project: 'acme-app'}, review],
  ['config-wrong-type', 'configs_get', {project: 'acme-app', config: ['dev']}, review],
  ['names-config-missing', 'secrets_names', {project: 'acme-app'}, review],
  ['names-project-missing', 'secrets_names', {config: 'dev'}, review],
  ['names-blank-config', 'secrets_names', {project: 'acme-app', config: '  '}, review],
  ['names-null', 'secrets_names', {project: null, config: 'dev'}, review],
  ['secret-list', 'secrets_list', scope, protectedEffect],
  ['secret', 'secrets_get', {...scope, name: 'EXAMPLE_KEY'}, protectedEffect],
  ['download', 'secrets_download', {...scope, format: 'json'}, protectedEffect],
  ['token-list', 'service_tokens_list', scope, protectedEffect],
  ['token-create', 'service_tokens_create', {...scope, name: 'example'}, protectedEffect],
  ['lease', 'dynamic_secrets_issue_lease', {...scope, name: 'EXAMPLE_KEY'}, protectedEffect],
  ['secret-write', 'secrets_update', {...scope, secrets: {EXAMPLE_KEY: 'placeholder'}}, protectedEffect],
  ['project-delete', 'projects_delete', {project: 'acme-app'}, protectedEffect],
  ['integration-delete', 'workplace_integration_members_delete', {}, protectedEffect],
  ['logs', 'config_logs_get', {...scope, log: 'example'}, review],
  ['confirm-access', 'confirm_access', {}, review],
  ['unknown', 'future_metadata_list', {}, review],
];

export const transport = {type: 'stdio', command: 'npx', args: ['-y', '@dopplerhq/mcp-server@1.0.5'],
  env: {DOPPLER_BASE_URL: 'https://api.doppler.com'}};

export function mcpCase(name, profile, tool, args, expected, launch = transport, server = 'doppler') {
  return {name, profile, mcp: {[server]: {transport: launch, agents: {codex: server}}},
    input: {kind: 'mcp', server, tool, arguments: args, original_input: {}}, expected};
}

export function dopplerCases() {
  const cases = profiles.flatMap((profile, index) => [
    ...cli.map(([name, args, decisions]) => ({name: `cli-${name}-${profile}`, profile,
      argv: ['doppler', ...args], expected: decisions[index]})),
    {name: `cli-installed-path-${profile}`, profile, argv: ['/opt/homebrew/bin/doppler', 'projects'], expected: metadata[index]},
    {name: `cli-shell-host-override-${profile}`, profile,
      input: {kind: 'shell', source: 'DOPPLER_API_HOST=https://example.org doppler projects', dialect: 'posix',
        dialect_version: null, original_input: {}}, expected: review[index]},
    {name: `cli-shell-secret-with-host-override-${profile}`, profile,
      input: {kind: 'shell', source: 'DOPPLER_API_HOST=https://example.org doppler secrets get EXAMPLE_KEY', dialect: 'posix',
        dialect_version: null, original_input: {}}, expected: protectedEffect[index]},
    {name: `cli-shell-outside-project-${profile}`, profile,
      input: {kind: 'shell', source: 'cd / && doppler projects', dialect: 'posix', dialect_version: null,
        original_input: {}}, expected: review[index]},
    ...mcp.map(([name, tool, args, decisions]) => mcpCase(`mcp-${name}-${profile}`, profile, tool, args, decisions[index])),
    mcpCase(`mcp-scoped-alias-${profile}`, profile, 'secrets_names', scope, metadata[index],
      {...transport, command: '/opt/homebrew/bin/npx', args: [...transport.args, '--read-only', '--project', 'acme-app', '--config', 'dev']},
      'doppler-dev'),
    mcpCase(`mcp-same-name-other-launch-${profile}`, profile, 'projects_list', {}, review[index],
      {...transport, args: ['-y', '@dopplerhq/mcp-server']}),
  ]);
  return {schema_version: 1, cases};
}
