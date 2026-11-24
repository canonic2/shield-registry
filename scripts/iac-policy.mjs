import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const tools = {
  terraform: {title: 'Terraform', executable: 'terraform', reference: 'https://developer.hashicorp.com/terraform/cli/commands'},
  opentofu: {title: 'OpenTofu', executable: 'tofu', reference: 'https://opentofu.org/docs/cli/commands/'},
};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const change = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const protectedPaths = ['.git', '.shield', '.aws', '.ssh', '.env', '.mcp.json', '.codex', '.claude', '.terraform.d'];
const path = {within: {root: 'write'}, exclude: protectedPaths.map(path => ({root: 'project', path}))};

// These inventories classify effects; unknown syntax remains reviewable.
// Plan/validate execute provider plugins, console evaluates file-reading
// expressions, and init/get acquire executable code or contact a backend.
const reviewCommands = ['init', 'get', 'validate', 'plan', 'console', 'graph', 'output', 'show',
  'providers', 'providers schema', 'providers lock', 'providers mirror',
  'metadata functions', 'state list', 'state show', 'state pull',
  'workspace list', 'workspace show', 'workspace select', 'workspace new'];
const changeCommands = ['apply', 'destroy', 'test', 'import', 'refresh', 'taint', 'untaint', 'force-unlock',
  'state', 'state mv', 'state rm', 'state push', 'state replace-provider',
  'workspace delete', 'login', 'logout'];
export const commandInventory = id => [
  'version', 'fmt', ...reviewCommands, ...changeCommands,
  ...(id === 'terraform' ? ['modules', 'stacks'] : ['env', 'env list', 'env show', 'env select', 'env new', 'env delete']),
];

export function iacPack(id) {
  const tool = tools[id];
  if (!tool) throw Error(`Unknown infrastructure tool: ${id}`);
  const executable = {one_of: executableForms(tool.executable)};
  const argv = (id, args, decision, reason, extra = {}) => ({id,
    conditions: {domain: 'argv', executable, arguments: args, ...extra}, decision, reason});
  const effect = (command, decision) => argv(command.replaceAll(' ', '-'),
    {kind: 'prefix', values: command.split(' ')}, decision,
    'Review provider execution, backend access, sensitive state, credentials or infrastructure changes.');
  const help = values => argv(`help-${values.join('-') || 'empty'}`,
    {kind: 'exact', values}, 'allow', 'Print built-in help without running the operation.');
  // All documented fmt switches are booleans, with values attached by '='.
  // None consumes a following token. Treat every non-option as a target.
  const fmtGrammar = {kind: 'options', prefix: ['fmt'], flags: [], values: [],
    operands: true, unknown_options: 'skip'};
  return {
    schema_version: 1, kind: 'pack', id: `canonic/${id}`, version,
    description: `${tool.title} CLI formatting with checked paths, and reviewed provider, state and infrastructure operations.`,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    capabilities: ['access-paths-v1', 'argument-paths-v1', 'argument-rules-v1', 'location-v1',
      'directory-options-v1', 'fallback-rules-v1', 'negated-selectors-v1', 'regex-v1', 'requirements-v1', 'structured-rules-v1', 'unknown-options-v1'],
    directory_options: [{executable, option: '-chdir', forms: ['equals'], paths: 'follow'}],
    rules: [
      ...[[], ['-help'], ['--help'], ['-h'], ['-version'], ['--version'], ['-v']].map(help),
      argv('version', {kind: 'sequence', prefix: ['version'], rest: {kind: 'each', match: {regex: '^-[^\\s]+$'}}},
        'allow', 'Print the installed CLI version.'),
      argv('fmt', fmtGrammar, routine, 'Format configuration files inside approved writable folders.', {cwd: path}),
      ...reviewCommands.map(command => effect(command, 'ask')),
      ...changeCommands.filter(command => command !== 'state').map(command => effect(command, change)),
      argv('state-unclassified', {kind: 'prefix', values: ['state', {not: {one_of: ['list', 'show', 'pull']}}]},
        change, 'Review unclassified state operations as state mutations.'),
      // Implicit recursive roots cannot be selected by argument_paths. Review
      // recursive formatting rather than allow an unchecked default tree.
      argv('fmt-recursive-review', {kind: 'risk_tokens', prefix: ['fmt'], any_of: [{regex: '^-recursive(?:=(?:1|t|T|true|TRUE|True))?$'}]},
        'ask', 'Review recursive formatting, including its implicit root and traversal.'),
      ...(id === 'terraform' ? [effect('modules', 'ask'), effect('stacks', change)] : [
        effect('env', 'ask'), ...['list', 'show', 'select', 'new'].map(name => effect(`env ${name}`, 'ask')),
        effect('env delete', change),
      ]),
      ...commandInventory(id).flatMap(command => ['-help', '--help', '-h'].map(flag => help([...command.split(' '), flag]))),
      ...['-install-autocomplete', '-uninstall-autocomplete'].map(option => argv(option.slice(1),
        {kind: 'exact', values: [option]}, change, 'Review changes to shell startup files.')),
      {...argv('review', {kind: 'any'}, 'ask', 'Review unclassified commands, directory selection and requests outside approved folders.'), fallback: true},
    ].map(rule => rule.id !== 'fmt' ? rule : {...rule,
      requirements: {argument_paths: {grammar: fmtGrammar, operands: {path, recursive: true}}},
      on_unmet: {decision: 'ask', message: 'Review formatting paths outside approved folders, protected paths, stdin or unparseable arguments.'},
    }),
  };
}
