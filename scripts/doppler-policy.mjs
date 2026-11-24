import {mcpMetadata, mcpProtected, mcpReview} from './doppler-mcp.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
const metadata = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const protectedEffect = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const executable = {one_of: ['doppler', 'doppler.exe', '/usr/bin/doppler', '/usr/local/bin/doppler', '/opt/homebrew/bin/doppler']};
const project = {within: {root: 'project'}};
const identifier = {regex: '^\\S+$'};

// The public and hidden Cobra global options in CLI 3.77.1. Keep parsing
// separate from the credential, destination and diagnostic effects below.
// Declare the token option by name so Shield sees the option without a value.
const globals = {
  interleaved: true,
  flags: ['--json', '--silent', '--debug', '--print-config', '--no-read-env', '--no-check-version',
    '--no-timeout', '--no-verify-tls', '--enable-dns-resolver', '--no-dns-resolver', '-h', '--help'],
  values: ['--attempts', '--timeout', '--api-host', '--dashboard-host', '--config-dir', '--configuration',
    '--scope', '--dns-resolver-address', '--dns-resolver-proto', '--dns-resolver-timeout', '-t', {name: '--token'}],
};
const reviewOptions = ['--api-host', '--dashboard-host', '--config-dir', '--configuration', '--scope',
  '-t', '--no-verify-tls', '--enable-dns-resolver', '--no-dns-resolver', '--dns-resolver-address',
  '--dns-resolver-proto', '--dns-resolver-timeout', '--print-config', '--debug', '--token'];

const projectOptions = ['--project', '-p'];
const configOptions = ['--config', '-c'];
const environmentOptions = ['--environment', '-e'];
const pageOptions = ['--number', '-n', '--page'];
const topLevel = ['activity', 'changelog', 'completion', 'configs', 'configure', 'environments', 'feedback',
  'flags', 'help', 'import', 'login', 'logout', 'me', 'mfa', 'oidc', 'open', 'projects', 'run', 'secrets',
  'settings', 'setup', 'tags', 'tui', 'update', 'whoami', 'enclave'];

function argv(id, args, decision, reason, conditions = {}) {
  return {id, decision, reason, conditions: {domain: 'argv', executable, arguments: args, ...conditions}};
}

function inspect(id, prefix, values = [], operands = false, secretNames = false) {
  const flags = secretNames ? ['--raw', '--type', '--visibility', '--only-names'] : [];
  return argv(id, {
    kind: 'options', prefix, leading: globals, flags: [...globals.flags, ...flags],
    values: [...globals.values, ...values], operands, forbid: reviewOptions,
    ...(secretNames ? {require_all: ['--only-names']} : {}),
  }, metadata, secretNames ? 'Inspect secret names without requesting their values.' : 'Read Doppler metadata in the project.', {cwd: project});
}

function sensitive(id, words, reason) {
  return argv(id, {kind: 'prefix', values: words, leading: globals}, protectedEffect, reason);
}

const cliRules = [
  ...[['--help'], ['-h'], ['--version'], ['-v']].map((values, index) =>
    argv(`cli-info-${index}`, {kind: 'exact', values}, 'allow', 'Print CLI help or the installed version.')),
  argv('cli-command-help', {kind: 'sequence', prefix: [{one_of: topLevel}],
    rest: {kind: 'each', match: {one_of: ['--help', '-h']}, min: 1, max: 1}},
  'allow', 'Print help for a Doppler command.'),
  argv('cli-help', {kind: 'sequence', prefix: ['help'], rest: {kind: 'each', match: {regex: '^[a-z][a-z-]*$'}, max: 4}},
    'allow', 'Print help for a Doppler command path.'),
  inspect('cli-identity', [{one_of: ['me', 'whoami']}]),
  inspect('cli-projects', ['projects'], pageOptions),
  inspect('cli-project-get', ['projects', 'get'], projectOptions, {match: identifier, max: 1}),
  inspect('cli-configs', ['configs'], [...projectOptions, ...environmentOptions, ...pageOptions]),
  inspect('cli-config-get', ['configs', 'get'], [...projectOptions, ...configOptions], {match: identifier, max: 1}),
  inspect('cli-environments', ['environments'], [...projectOptions, ...pageOptions]),
  inspect('cli-environment-get', ['environments', 'get'], projectOptions, {match: identifier, min: 1, max: 1}),
  inspect('cli-tags', ['tags']),
  inspect('cli-secret-names', ['secrets'], [...projectOptions, ...configOptions], false, true),
  sensitive('cli-secrets', ['secrets'], 'Review secret values, downloads, templates and secret changes.'),
  sensitive('cli-credentials-and-execution', [{one_of: ['configure', 'flags', 'login', 'logout', 'oidc', 'mfa',
    'run', 'setup', 'tui', 'enclave', 'import', 'update']}],
  'Review credential access, configuration changes, secret injection and execution.'),
  sensitive('cli-project-changes', ['projects', {one_of: ['create', 'update', 'delete']}], 'Review project changes.'),
  sensitive('cli-config-changes', ['configs', {one_of: ['create', 'update', 'delete', 'clone', 'lock', 'unlock', 'tokens']}],
    'Review config changes and service-token operations.'),
  sensitive('cli-config-rollback', ['configs', 'logs', 'rollback'], 'Review rollback of a config change.'),
  sensitive('cli-environment-changes', ['environments', {one_of: ['create', 'delete', 'rename']}], 'Review environment changes.'),
  sensitive('cli-tag-changes', ['tags', {one_of: ['create', 'update', 'delete']}], 'Review tag changes.'),
  sensitive('cli-settings-change', ['settings', 'update'], 'Review workplace settings changes.'),
  ...['DOPPLER_API_HOST', 'DOPPLER_DASHBOARD_HOST', 'DOPPLER_CONFIG_DIR', 'DOPPLER_VERIFY_TLS', 'DOPPLER_ENABLE_DNS_RESOLVER'].map(name =>
    argv(`cli-env-${name.toLowerCase().replaceAll('_', '-')}`, {kind: 'any'}, protectedEffect,
      'Review observed environment overrides of Doppler connection or credential settings.',
      {environment: {fields: {[name]: {not: {exact: ''}}}}})),
  argv('cli-unlisted', {kind: 'any'}, 'ask', 'Review unclassified commands or connection and credential overrides.'),
];

function mcpRule(id, tool, decision, reason, fields) {
  return {id, decision, reason, conditions: {domain: 'mcp', server: 'doppler', tool},
    ...(fields && {requirements: {fields}, on_unmet: {decision: 'ask', message: 'Supply the required Doppler identifiers.'}})};
}

export function dopplerPack() {
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/doppler', version, license: 'MIT', maintainers: ['Canonic'],
    description: 'Doppler CLI and MCP metadata and secret-name inspection, with review for secret values, credential operations, injected commands and mutations.',
    engines: {shield: engine},
    capabilities: ['argument-rules-v1', 'interleaved-leading-v1', 'location-v1', 'mcp-integrations-v1',
      'negated-selectors-v1', 'prefix-leading-v1', 'regex-v1', 'requirements-v1', 'structured-rules-v1'],
    mcp_integrations: {
      doppler: {transport: 'stdio', fields: {
        '/command': {text: {one_of: ['npx', 'npx.cmd', '/usr/bin/npx', '/usr/local/bin/npx', '/opt/homebrew/bin/npx']}},
        '/args/0': {exact: '-y'},
        '/args/1': {exact: '@dopplerhq/mcp-server@1.0.5'},
        '/env/DOPPLER_BASE_URL': {exact: 'https://api.doppler.com'},
      }},
    },
    rules: [...cliRules,
      ...Object.entries(mcpMetadata).map(([tool, required]) => mcpRule(`mcp-${tool}`, tool, metadata,
        'Inspect Doppler metadata or secret names.', required.length ? Object.fromEntries(required.map(name =>
          [`/${name}`, {text: identifier}])) : undefined)),
      mcpRule('mcp-protected', {one_of: mcpProtected}, protectedEffect, 'Review secret values, credentials and Doppler API mutations.'),
      mcpRule('mcp-other-reads', {one_of: mcpReview}, 'ask', 'Review other Doppler API reads and access confirmation.'),
      mcpRule('mcp-unlisted', {not: {one_of: [...Object.keys(mcpMetadata), ...mcpProtected, ...mcpReview]}}, 'ask',
        'Review unlisted Doppler tools.'),
    ],
  };
}

export function dopplerInventory(pack = dopplerPack()) {
  return {schema_version: 1, commands: [{name: 'doppler', rule_ids: pack.rules
    .filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]};
}
