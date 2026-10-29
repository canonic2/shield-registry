// AWS CLI permission categories. Reviewed operation data lives in aws-policy.mjs;
// expected decisions are maintained independently in build-aws-cases.mjs.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as policy from './aws-policy.mjs';
import * as mcp from './aws-mcp.mjs';

export const destination = new URL('../packs/canonic/aws/0.1.0/', import.meta.url);
export const commandNames = ['aws'];

const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
export const decisions = {
  local: profiles('allow'),
  inspect: profiles('allow', 'allow', 'ask'),
  exposure: profiles('allow', 'ask', 'ask'),
  data: profiles('ask', 'ask', 'deny'),
  download: profiles('ask', 'ask', 'deny'),
  secret: profiles('ask', 'deny', 'deny'),
  change: profiles('ask', 'ask', 'deny'),
  execute: profiles('ask', 'ask', 'deny'),
  destroy: profiles('ask', 'deny', 'deny'),
  access: profiles('ask', 'deny', 'deny'),
  session: profiles('ask', 'ask', 'deny'),
  stream: profiles('ask'),
  unlisted: profiles('ask', 'ask', 'deny'),
  emulator: profiles('allow', 'allow', 'ask'),
};

const executable = {one_of: ['aws', '/bin/aws', '/usr/bin/aws', '/usr/local/bin/aws', '/opt/homebrew/bin/aws']};
const service = {regex: '[a-z0-9][a-z0-9-]*'};
const operationName = {regex: '[a-z0-9][a-z0-9-]*'};
const choice = (...values) => values.length === 1 ? values[0] : {one_of: values};
const verbs = list => ({regex: `(?:${list.join('|')})-[a-z0-9-]+`});

// The CLI's complete global option set. argparse resolves abbreviations against
// it, so every grammar that accepts abbreviations declares all of it.
// Rules that classify by endpoint check the last --endpoint-url, the one the CLI
// uses; every-occurrence checks would let a mixed pair match neither rule.
// Profile and region checks keep every occurrence, so a mixed pair fails them.
const lastWins = new Set(['--endpoint-url']);
const globals = (matches = {}) => ({
  flags: policy.globalFlags,
  values: policy.globalValues.map(name => matches[name]
    ? {name, match: matches[name], ...(lastWins.has(name) ? {repeat: 'last'} : {})} : name),
  long_abbreviations: true,
});
const leading = globals();

// `aws [globals] SERVICE OPERATION ...`: the CLI reads global options anywhere,
// so the suffix stays open and cross-cutting options are checked separately.
const operation = (...values) => ({kind: 'prefix', leading, values});
// Find declared options anywhere among service options no rule lists.
const scan = (matches, require_all, extra = {}) => ({kind: 'options', prefix: [], ...globals(matches),
  operands: true, unknown_options: 'skip', require_all, ...extra});
// One operation, with its own options found anywhere after it.
const operationWith = (prefix, flags, values, require) => ({kind: 'options', leading, prefix,
  flags: [...policy.globalFlags, ...flags], values: [...policy.globalValues, ...values], operands: true,
  unknown_options: 'skip', long_abbreviations: true, ...(require ? {require_any: require} : {})});

// Per-operation options that supply every parameter from JSON or YAML.
const inputOptions = ['--cli-input-json', '--cli-input-yaml'];

const rule = (id, args, decision, reason, extra = {}) => ({id, conditions: {domain: 'argv', executable, arguments: args}, decision, reason, ...extra});

// Local-only forms every gate lets through: they reach no account.
const localForms = [
  {kind: 'exact', values: ['--version']},
  {kind: 'exact', values: ['help']},
  {kind: 'sequence', prefix: [service, 'help'], rest: {kind: 'none'}},
  {kind: 'sequence', prefix: [service, operationName, 'help'], rest: {kind: 'none'}},
  {kind: 'exact', values: ['configure', 'list-profiles']},
];

function gates() {
  const conditions = {domain: 'argv', executable, arguments: {kind: 'any'}};
  const emulator = scan({'--endpoint-url': {var: 'local_endpoint'}}, ['--endpoint-url']);
  // A gate referencing local_endpoint is inactive while it is unset, so each
  // gate has a form for each state of that variable.
  const gate = (id, variable, check, on_unmet) => [
    {id, when: [{var: variable, set: true}, {var: 'local_endpoint', set: false}], conditions,
      requires_any: [{arguments: check}, ...localForms.map(args => ({arguments: args}))], on_unmet},
    {id: `${id}-with-emulator`, when: [{var: variable, set: true}], conditions,
      requires_any: [{arguments: check}, {arguments: emulator}, ...localForms.map(args => ({arguments: args}))], on_unmet},
  ];
  return [
    ...gate('required-profile', 'profile', scan({'--profile': {var: 'profile'}}, ['--profile']), {decision: 'deny',
      message: 'This project requires the {{profile}} AWS profile for agent commands.',
      alternatives: ['Add --profile {{profile}} to the command.']}),
    ...gate('blocked-profiles', 'blocked_profiles', scan({'--profile': {not: {var: 'blocked_profiles'}}}, ['--profile']), {decision: 'deny',
      message: 'Agent aws commands must name a profile with --profile, and these profiles are blocked: {{blocked_profiles}}.',
      alternatives: ['Add --profile with a profile that is not blocked.']}),
    ...gate('allowed-regions', 'regions', scan({'--region': {var: 'regions'}}, ['--region']), {decision: 'deny',
      message: 'This project allows agent aws commands only in these regions: {{regions}}.',
      alternatives: ['Add --region with one of: {{regions}}.']}),
  ];
}

function verbRules() {
  return Object.entries(policy.verbClasses).map(([category, list]) =>
    rule(`verb-${category}`, operation(service, verbs(list)), decisions[category], policy.verbReasons[category]));
}

// Operations whose verb reads as inspection but which return secrets, credentials,
// customer data or configuration that commonly embeds secrets, or write local files.
function operationRules() {
  return Object.entries(policy.operations).flatMap(([category, services]) =>
    Object.entries(services).map(([name, ops]) =>
      rule(`${category}-${name}`, operation(name, choice(...ops)), decisions[category], policy.operationReasons[category])));
}

// Services whose every change grants or removes access.
function accessServiceRules() {
  return [rule('access-services', operation(choice(...policy.accessServices), verbs([...policy.verbClasses.change, ...policy.verbClasses.destroy])),
    decisions.access, 'Identity, organization and sharing changes grant or remove access.'),
  rule('access-operations', operation(service, {regex: policy.accessOperation}), decisions.access,
    'Policy, permission, grant, sharing and credential changes alter who can reach resources.')];
}

function customizations() {
  const s3 = (ops, category, reason) => rule(`s3-${ops.join('-')}`, operation('s3', choice(...ops)), decisions[category], reason);
  return [
    rule('version', {kind: 'exact', values: ['--version']}, decisions.local, 'Print the CLI version.'),
    rule('help', {kind: 'exact', values: ['help']}, decisions.local, 'Read built-in help.'),
    rule('service-help', {kind: 'sequence', prefix: [service, 'help'], rest: {kind: 'none'}}, decisions.local, 'Read built-in help.'),
    rule('operation-help', {kind: 'sequence', prefix: [service, operationName, 'help'], rest: {kind: 'none'}}, decisions.local, 'Read built-in help.'),
    // An options grammar ranks above the get- verb rule, so Strict allows it too.
    rule('caller-identity', operationWith(['sts', 'get-caller-identity'], [], []), decisions.local, 'Show which account and identity the selected credentials belong to.'),
    rule('configure-list', operationWith(['configure', choice('list', 'list-profiles')], [], []), decisions.local, 'List local profiles and where configuration values come from; secrets stay masked.'),
    rule('configure-get', {kind: 'options', leading, prefix: ['configure', 'get'], ...globals(), operands: {match: {not: {regex: policy.secretSetting}}, min: 1, max: 1}},
      decisions.local, 'Read one non-secret local configuration value.'),
    rule('configure-get-secret', {kind: 'options', leading, prefix: ['configure', 'get'], ...globals(), operands: {match: {regex: policy.secretSetting}, min: 1, max: 1}},
      decisions.secret, 'Print a stored credential.'),
    rule('configure-export-credentials', operation('configure', 'export-credentials'), decisions.secret, 'Print the resolved credentials.'),
    rule('configure-interactive', {kind: 'exact', values: ['configure']}, decisions.session, 'Prompt for and store credentials and settings.'),
    rule('configure-change', operation('configure', choice('set', 'import', 'sso', 'sso-session', 'add-model')), decisions.session,
      'Change local AWS configuration or stored credentials.'),
    rule('sso-session', operation('sso', choice('login', 'logout')), decisions.session, 'Start or end an SSO session; login opens a browser and caches tokens.'),
    rule('login-session', operation(choice('login', 'logout')), decisions.session, 'Start or end a console-credential session.'),
    rule('history', operation('history'), decisions.data, 'Recorded CLI history includes request and response bodies.'),
    s3(['ls'], 'inspect', 'List buckets or objects.'),
    s3(['cp', 'sync'], 'data', 'Transfer objects: downloads write local files, uploads read them and change remote objects.'),
    s3(['mv'], 'destroy', 'Move objects, deleting each source after copying it.'),
    s3(['rm', 'rb'], 'destroy', 'Delete objects or buckets.'),
    s3(['mb', 'website'], 'change', 'Create a bucket or change its website configuration.'),
    s3(['presign'], 'access', 'Create a link that lets anyone holding it read the object.'),
    rule('s3-sync-delete', operationWith(['s3', 'sync'], ['--delete'], [], ['--delete']), decisions.destroy, 'sync --delete removes destination files or objects missing from the source.'),
    rule('logs-follow', operationWith(['logs', choice('tail', 'start-live-tail')], ['--follow'], [], ['--follow']), decisions.stream,
      'A followed log stream does not end on its own.'),
    rule('logs-live-tail', operation('logs', 'start-live-tail'), decisions.stream, 'A live tail session does not end on its own.'),
    rule('logs-tail', operation('logs', 'tail'), decisions.inspect, 'Read recent log events.'),
    // JSON or YAML input can set the same parameters without the flag, and its
    // contents are not inspected, so it counts as the sensitive form.
    rule('ssm-decryption', operationWith(['ssm', choice('get-parameter', 'get-parameters', 'get-parameters-by-path', 'get-parameter-history')],
      ['--with-decryption'], inputOptions, ['--with-decryption', ...inputOptions]),
      decisions.secret, 'Decrypt SecureString parameter values, or take parameters from JSON or YAML input that can request decryption.'),
    rule('apigateway-key-values', operationWith(['apigateway', choice('get-api-key', 'get-api-keys')],
      ['--include-value', '--include-values'], inputOptions, ['--include-value', '--include-values', ...inputOptions]),
      decisions.secret, 'Return API key values, or take parameters from JSON or YAML input that can request them.'),
    ...policy.customizations.map(([id, args, category, reason]) => rule(id, operation(...args), decisions[category], reason)),
  ];
}

// Cross-cutting options, ranked above operation rules. Inline environment such
// as AWS_CONFIG_FILE=... needs no rule: Shield reviews every inline assignment.
function crossCutting() {
  const option = (id, matches, require, category, reason, extra = {}) =>
    rule(id, scan(matches, [], {require_any: require}), decisions[category], reason, extra);
  return [
    option('insecure-transport', {}, ['--no-verify-ssl', '--ca-bundle'], 'unlisted', 'Disabling or replacing certificate verification lets another host answer for AWS.'),
    {...option('custom-endpoint', {}, ['--endpoint-url'], 'unlisted', 'A custom endpoint sends signed requests and their data to another host.'),
      when: [{var: 'local_endpoint', set: false}]},
    option('other-endpoint', {'--endpoint-url': {not: {var: 'local_endpoint'}}}, ['--endpoint-url'], 'unlisted',
      'A custom endpoint other than the configured local emulator sends signed requests and their data to another host.'),
    rule('local-emulator', {kind: 'options', leading: globals({'--endpoint-url': {var: 'local_endpoint'}}),
      prefix: [{not: {one_of: policy.localServices}}, {not: {one_of: policy.localFileOperations}}], ...globals({'--endpoint-url': {var: 'local_endpoint'}}),
      operands: true, unknown_options: 'skip', require_all: ['--endpoint-url']}, decisions.emulator,
      'Requests to the configured local emulator change only its disposable data. Operations that write local files keep their own decisions.'),
  ];
}

// Transport rules outrank operation prefixes, which would let a transport option
// soften a stricter operation decision. Each operation rule stricter than the
// transport review in some profile gets a variant of transport rank deciding the
// stricter of both, so equal-rank resolution keeps it in every profile.
const severity = ['allow', 'ask', 'deny'];
const strictest = (a, b) => Object.fromEntries(Object.keys(a).map(profile =>
  [profile, severity[Math.max(severity.indexOf(a[profile]), severity.indexOf(b[profile]))]]));
function transportVariants(rules) {
  const transport = decisions.unlisted;
  const variant = (source, id, matches, extra = {}) => ({...rule(id, {kind: 'options', leading: globals(matches),
    prefix: source.conditions.arguments.values, ...globals(matches), operands: true, unknown_options: 'skip',
    require_any: ['--no-verify-ssl', '--ca-bundle', '--endpoint-url']}, strictest(source.decision, transport), source.reason), ...extra});
  return rules.filter(source => source.conditions.arguments.kind === 'prefix'
    && Object.keys(transport).some(profile => severity.indexOf(source.decision[profile]) > severity.indexOf(transport[profile])))
    .flatMap(source => [
      variant(source, `${source.id}-transport`, {}, {when: [{var: 'local_endpoint', set: false}]}),
      variant(source, `${source.id}-other-transport`, {'--endpoint-url': {not: {var: 'local_endpoint'}}}),
    ]);
}

export function awsPack() {
  const operations = [...customizations(), ...verbRules(), ...accessServiceRules(), ...operationRules()];
  const rules = [
    ...operations, ...crossCutting(), ...transportVariants(operations),
    rule('unlisted', {kind: 'any'}, decisions.unlisted, 'Unlisted AWS CLI syntax and operations whose effects are not classified require review.'),
    ...mcp.rules(decisions),
  ];
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/aws', version: '0.1.0',
    description: 'AWS CLI inspection, data, change, deletion and access classes, with optional required or blocked profiles, allowed regions and a local emulator endpoint.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: '>=0.10.0, <1.0.0'},
    capabilities: ['argument-rules-v1', 'negated-selectors-v1', 'option-abbreviations-v1', 'preconditions-v1', 'prefix-leading-v1',
      'regex-v1', 'structured-rules-v1', 'templates-v1', 'unknown-options-v1', 'variables-v1', 'mcp-integrations-v1', 'mcp-connection-facts-v1', 'mcp-effective-fields-v1', 'fallback-rules-v1'],
    variables: policy.variables,
    preconditions: [...gates(), ...mcp.gates()],
    mcp_integrations: mcp.integrations,
    rules,
  };
}

export async function buildAwsPack() {
  const pack = awsPack();
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1,
    commands: commandNames.map(name => ({name, rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}))}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildAwsPack();
