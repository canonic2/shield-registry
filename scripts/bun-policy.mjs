import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const commands = ['bun', 'bunx'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const executable = name => ({one_of: [...executableForms(name), `${name}.exe`]});
const project = {within: {root: 'project'}, exclude: ['.git', '.shield', '.ssh', '.aws', '.env', '.codex', '.claude']
  .map(path => ({root: 'project', path}))};

// These switches carry execution, filesystem, credential, destination or global
// effects. Other listing switches do not need individual permission rules.
const effects = ['--eval', '-e', '--print', '-p', '--preload', '-r', '--require', '--import',
  '--cwd', '--config', '-c', '--env-file', '--cache-dir', '--global', '-g', '--registry',
  '--cafile', '--ca', '--fetch-preconnect', '--redis-preconnect', '--sql-preconnect',
  '--redirect-warnings', '--cpu-prof', '--cpu-prof-dir', '--heap-prof', '--heap-prof-dir',
  '--inspect', '--inspect-brk', '--inspect-wait', '--trust'];

function argv(id, name, arguments_, decision, reason, extra = {}) {
  return {id, decision, reason, conditions: {domain: 'argv', executable: executable(name), arguments: arguments_}, ...extra};
}

export function bunPack() {
  const listing = (id, prefix) => {
    const row = argv(id, 'bun', {kind: 'options', prefix, flags: [], values: [], operands: true, unknown_options: 'skip'},
      routine, 'Inspect local package metadata from an approved project directory.');
    row.conditions.cwd = project;
    return row;
  };
  return {schema_version: 1, kind: 'pack', id: 'canonic/bun', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'Bun runtime, package management, bundling and tests with local metadata inspection and reviewed execution, acquisition, global changes and publication.',
    capabilities: ['argument-rules-v1', 'fallback-rules-v1', 'location-v1',
      'negated-selectors-v1', 'structured-rules-v1', 'unknown-options-v1'],
    rules: [
      ...['--version', '-v', '--revision', '--help', '-h'].map((flag, index) =>
        argv(`bun-info-${index}`, 'bun', {kind: 'exact', values: [flag]}, 'allow', 'Print the installed version, revision or built-in help.')),
      argv('bunx-help', 'bunx', {kind: 'exact', values: ['--help']}, 'allow', 'Print package-runner help.'),
      ...['run', 'test', 'check', 'x', 'build', 'install', 'add', 'remove', 'publish', 'pm', 'init', 'create', 'upgrade']
        .map(name => argv(`help-${name}`, 'bun', {kind: 'exact', values: [name, '--help']}, 'allow', 'Print built-in subcommand help.')),
      listing('pm-list', ['pm', {one_of: ['ls', 'list']}]),
      listing('list-alias', ['list']),
      listing('pm-bin', ['pm', 'bin']),
      listing('pm-hashes', ['pm', {one_of: ['hash', 'hash-print', 'hash-string']}]),
      listing('pm-trust-inspection', ['pm', {one_of: ['untrusted', 'default-trusted']}]),
      argv('effect-switches', 'bun', {kind: 'risk_tokens', prefix: [], any_of: effects}, review,
        'Review executable input, configuration, explicit files, registry selection, global scope and profiler or debugger effects.'),
      argv('package-and-project-changes', 'bun', {kind: 'prefix', values: [{one_of: ['install', 'i', 'ci', 'add', 'a',
        'remove', 'rm', 'update', 'dedupe', 'prune', 'link', 'unlink', 'publish', 'patch', 'init', 'create', 'c', 'upgrade']} ]},
      review, 'Review package acquisition, lifecycle scripts, file changes, publication and runtime replacement.'),
      argv('pm-changes', 'bun', {kind: 'prefix', values: ['pm', {one_of: ['pack', 'version', 'migrate', 'trust', 'cache', 'pkg']}]},
        review, 'Review pack hooks, cache changes, trust grants, lockfiles, version tags and package metadata changes.'),
      {id: 'bun-options-environment', decision: review,
        reason: 'Review observed BUN_OPTIONS before relying on a metadata allowance.',
        conditions: {domain: 'argv', executable: executable('bun'), arguments: {kind: 'any'},
          environment: {fields: {BUN_OPTIONS: {not: {exact: ''}}}}}},
      // Wrapper fallback yields to a package-specific pack, while regular effect
      // scans and mutations keep their restrictions across pack composition.
      ...commands.map(name => argv(`${name}-review`, name, {kind: 'any'}, review,
        'Review scripts, tests, inline code, REPL, downloads, bundler macros, outputs and unclassified operations.', {fallback: true})),
    ],
  };
}

export function bunInventory(pack = bunPack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(row => row.conditions.executable.one_of[0] === name).map(row => row.id)}))};
}
