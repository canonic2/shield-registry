export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
const metadata = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const sensitive = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const executable = {one_of: ['op', 'op.exe', '/usr/bin/op', '/usr/local/bin/op', '/opt/homebrew/bin/op']};
const list = {one_of: ['list', 'ls']};
const object = {match: {regex: '^.+$'}, min: 1, max: 1};

// Parsing declarations for CLI 2.42.0, independent of effect decisions.
const globals = {
  flags: ['--help', '-h'],
  optional_values: ['--cache', '--debug', '--iso-timestamps', '--no-color'],
  values: ['--account', '--config', '--encoding', '--format', {name: '--session'}],
  interleaved: true,
};
const reviewOptions = ['--config', '--debug', '--out-file', '-o', '--session'];

function rule(id, arguments_, decision, reason) {
  return {id, decision, reason, conditions: {domain: 'argv', executable, arguments: arguments_}};
}

function inspect(id, prefix, values = [], flags = [], operands = true) {
  return rule(id, {
    kind: 'options', prefix, leading: globals,
    flags: [...globals.flags, ...flags],
    optional_values: globals.optional_values,
    values: [...globals.values, ...values, '--out-file', '-o'],
    operands, ...(operands === true ? {unknown_options: 'skip'} : {}), forbid: reviewOptions,
  }, metadata, 'Inspect 1Password metadata using the selected account.');
}

const commandNames = ['account', 'connect', 'document', 'environment', 'events-api', 'group', 'item', 'plugin',
  'provisioning', 'service-account', 'user', 'vault', 'completion', 'inject', 'read', 'run', 'signin', 'signout', 'update', 'whoami'];

export function onepasswordPack() {
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/1password', version, license: 'MIT', maintainers: ['Canonic'],
    description: '1Password CLI metadata inspection with review for secret retrieval, injection, subprocesses, sharing, credentials and administrative changes.',
    engines: {shield: engine},
    capabilities: ['argument-rules-v1', 'interleaved-leading-v1', 'prefix-leading-v1',
      'regex-v1', 'structured-rules-v1', 'unknown-options-v1'],
    rules: [
      ...[['--version'], ['-v'], ['--help'], ['-h']].map((values, index) =>
        rule(`info-${index}`, {kind: 'exact', values}, 'allow', 'Print the installed version or built-in help.')),
      rule('help', {kind: 'sequence', prefix: ['help'], rest: {kind: 'each', match: {regex: '^[a-z][a-z-]*$'}, max: 5}},
        'allow', 'Print built-in command help.'),
      rule('command-help', {kind: 'sequence', prefix: [{one_of: commandNames}], rest: {kind: 'each',
        match: {one_of: ['--help', '-h']}, min: 1, max: 1}}, 'allow', 'Print help for a command family.'),
      inspect('whoami', ['whoami']),
      inspect('account-list', ['account', list]),
      inspect('account-get', ['account', 'get']),
      inspect('vault-list', ['vault', list], ['--group', '--user', '--permission']),
      inspect('vault-get', ['vault', 'get'], [], [], object),
      inspect('item-list', ['item', list], ['--categories', '--tags', '--vault'], ['--favorite', '--include-archive', '--long']),
      inspect('document-list', ['document', list], ['--vault'], ['--include-archive']),
      inspect('template-list', ['item', 'template', list]),
      inspect('template-get', ['item', 'template', 'get'], ['--file-mode'], ['--force', '-f'], object),
      inspect('user-list', ['user', list], ['--group', '--vault']),
      inspect('user-get', ['user', 'get'], [], ['--me', '--fingerprint', '--public-key'], {match: {regex: '^.+$'}, max: 1}),
      inspect('group-list', ['group', list], ['--user', '--vault']),
      inspect('group-get', ['group', 'get'], [], [], object),
      inspect('group-user-list', ['group', 'user', list], [], [], object),
      inspect('vault-user-list', ['vault', 'user', list], [], [], object),
      inspect('vault-group-list', ['vault', 'group', list], [], [], object),
      inspect('service-account-ratelimit', ['service-account', {one_of: ['ratelimit', 'ratelimits']}], [], [],
        {match: {regex: '^.+$'}, max: 1}),
      inspect('plugin-list', ['plugin', list]),
      ...[
        ['secrets-and-execution', [{one_of: ['read', 'inject', 'run', 'signin', 'signout', 'update']}],
          'Review secret retrieval, injection, command execution, authentication and CLI updates.'],
        ['item', ['item'], 'Review item values, changes and sharing.'],
        ['document', ['document'], 'Review document contents, downloads and changes.'],
        ['environment', ['environment'], 'Review environment secrets, including unconcealed values in listings.'],
        ['account', ['account'], 'Review local account configuration and credentials.'],
        ['vault', ['vault'], 'Review vault lifecycle and access changes.'],
        ['user', ['user'], 'Review user lifecycle, recovery and account changes.'],
        ['group', ['group'], 'Review groups and membership changes.'],
        ['service-account', ['service-account'], 'Review service-account creation and token issuance.'],
        ['connect', ['connect'], 'Review Connect server configuration, credential files and access tokens.'],
        ['events-api', ['events-api'], 'Review Events API integration and token creation.'],
        ['plugin', ['plugin'], 'Review shell plugin setup, credential imports and injected subprocesses.'],
        ['provisioning', ['provisioning'], 'Review external provisioning and group synchronization.'],
      ].map(([id, values, reason]) => rule(`sensitive-${id}`, {kind: 'prefix', values, leading: globals}, sensitive, reason)),
      // A risk scan outranks metadata options rules, including switches before
      // or between subcommands, attached values, and repeated overrides.
      rule('connection-and-output-overrides', {kind: 'risk_tokens', prefix: [], any_of: reviewOptions}, sensitive,
        'Review configuration files, session credentials, diagnostics and explicit output paths.'),
      rule('unlisted', {kind: 'any'}, 'ask', 'Review unclassified 1Password commands.'),
    ],
  };
}

export function onepasswordInventory(pack = onepasswordPack()) {
  return {schema_version: 1, commands: [{name: 'op', rule_ids: pack.rules.map(row => row.id)}]};
}
