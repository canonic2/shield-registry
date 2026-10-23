// Public Rust operation policy. Expected outcomes live in independent fixtures.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const destination = new URL('../packs/canonic/rust/0.1.0/', import.meta.url);
export const commandNames = ['cargo', 'rustc', 'rustdoc', 'rustfmt', 'rustup', 'cargo-nextest', 'cargo-deny', 'cargo-audit', 'cargo-llvm-cov', 'cargo-insta'];
const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const inspect = profiles('allow');
const routine = profiles('allow', 'allow', 'ask');
const dependency = profiles('allow', 'allow', 'deny');
const review = profiles('ask', 'ask', 'deny');
const sensitive = profiles('ask', 'deny', 'deny');
const choice = (...names) => ({one_of: names});
const forms = name => [name, ...['/bin', '/usr/bin', '/usr/local/bin', '/opt/homebrew/bin'].map(dir => `${dir}/${name}`)];
const options = (prefix, flags = [], values = [], operands = false) => ({kind: 'options', prefix, flags, values, operands});
const value = (name, regex, repeat = 'all') => ({name, ...(regex ? {match: {regex}} : {}), repeat});
const ordinary = {regex: '[^\\x00\\r\\n]+'};
const read = {within: {root: 'read'}, exclude: ['.shield', '.git', '.aws', '.ssh', '.env', '.mcp.json', '.codex', '.claude'].map(path => ({root: 'project', path}))};
const write = {within: {root: 'write'}, exclude: ['.shield', '.git', '.aws', '.ssh', '.env', '.mcp.json', '.codex', '.claude'].map(path => ({root: 'project', path}))};
const path = (predicate, recursive = false) => ({path: predicate, ...(recursive ? {recursive: true} : {})});
const readOptions = ['--manifest-path', '--config-path', '--path', '--workspace-root'];
const directoryOptions = ['--target-dir', '--build-dir', '--out-dir', '--output-dir', '--root'];
const outputOptions = ['-o', '--output', '--output-path', '--archive-file'];
const flags = ['--locked', '--offline', '--frozen', '--workspace', '--all', '--all-targets', '--all-features', '--no-default-features', '--lib', '--bins', '--examples', '--tests', '--benches', '--release', '-r', '-q', '--quiet', '-v', '--verbose', '--frozen', '--keep-going'];
const values = ['-p', '--package', '--exclude', '--bin', '--example', '--test', '--bench', '--features', '-F', '--target', '--profile', '--color', '--message-format', '--manifest-path', '--target-dir', '--build-dir', value('-j', '[1-9][0-9]*'), value('--jobs', '[1-9][0-9]*')];
const globals = {flags: ['-v', '--verbose', '-q', '--quiet', '--locked', '--offline', '--frozen'], values: ['--color', '--manifest-path']};

function rule(id, tool, grammar, decision, {project = true, operands, operandDirectory = false} = {}) {
  const conditions = {domain: 'argv', executable: {one_of: forms(tool)}, arguments: grammar};
  if (project) conditions.cwd = {within: {root: 'write'}};
  const row = {id, conditions, decision};
  // This predicate bounds only the named argument resources. It is deliberately
  // not a `targets` proof for arbitrary build scripts, macros or test code.
  if (grammar.kind === 'options') {
    const names = [grammar, grammar.leading].filter(Boolean).flatMap(phase => phase.values.map(v => typeof v === 'string' ? v : v.name));
    const selected = Object.fromEntries(names.flatMap(name => readOptions.includes(name) ? [[name, path(read)]]
      : directoryOptions.includes(name) ? [[name, path(write, true)]]
        : outputOptions.includes(name) ? [[name, path(write)]] : []));
    if (Object.keys(selected).length || operands) {
      row.requirements = {argument_paths: {grammar: structuredClone(grammar), ...(Object.keys(selected).length ? {options: selected} : {}),
        ...(operands ? {operands: path(operands === 'read' ? read : write, operandDirectory)} : {})}};
      row.on_unmet = {decision: 'deny', message: 'Use approved paths and preserve protected files; unknown path syntax cannot be verified.'};
    }
  }
  return row;
}

function cargoRules() {
  const rows = [];
  const add = (id, grammar, decision = routine, settings = {}) => rows.push(rule(id, 'cargo', {...grammar, ...(grammar.kind === 'options' ? {leading: globals} : {})}, decision, settings));
  add('cargo-version-help', {kind: 'exact', values: ['--version']}, inspect, {project: false});
  for (const flag of ['-V', '--help', '-h', '--list']) add(`cargo-inspect-${flag.replace(/-/g, '')}`, {kind: 'exact', values: [flag]}, inspect, {project: false});
  add('cargo-help', options(['help']), inspect, {project: false});
  // Cargo resolves help topics through configured aliases before built-ins;
  // even a built-in-looking topic can dispatch an external executable.
  add('cargo-help-topic', options(['help'], [], [], {match: {regex: '[a-z][a-z0-9-]*'}, min: 1, max: 1}), review, {project: false});
  add('cargo-build-check', options([choice('build', 'b', 'check', 'c', 'clippy', 'doc', 'd')], [...new Set(flags), '--no-deps', '--document-private-items'], values));
  add('cargo-clippy-pass', options(['clippy'], [...new Set(flags)], values, {match: {regex: '-[DWA]|warnings|[a-z_][a-z0-9_:]*'}, min: 0, max: 16}));
  add('cargo-test', options([choice('test', 't', 'bench')], [...new Set(flags), '--doc', '--no-run', '--no-fail-fast'], values, {match: ordinary, min: 0, max: 128}));
  // Run arguments are opaque trusted program input. Cargo's own options still
  // need the separator when an argument starts with '-'.
  add('cargo-run', options([choice('run', 'r')], [...new Set(flags)], values, {match: ordinary, min: 0, max: 128}));
  add('cargo-metadata', options(['metadata'], ['--locked', '--offline', '--frozen', '--no-deps', '--all-features', '--no-default-features', '-q'], ['--format-version', '--features', '--filter-platform', '--manifest-path']), inspect);
  add('cargo-tree', options(['tree'], ['--locked', '--offline', '--frozen', '--workspace', '--all-features', '--no-default-features', '--duplicates', '-d', '--no-dedupe'], ['--manifest-path', '-p', '--package', '--target', '--features', '-e', '--edges', '-i', '--invert', '--depth', '--prefix', '--format']), inspect);
  add('cargo-locate', options([choice('locate-project', 'pkgid', 'read-manifest')], ['--workspace', '--locked', '--offline', '--frozen'], ['--manifest-path', '--message-format', '-p', '--package']), inspect);
  add('cargo-format', options(['fmt'], ['--all', '--check', '-v', '--verbose', '-q', '--quiet'], ['--manifest-path', '-p', '--package'], {match: {regex: '--check|--edition|2015|2018|2021|2024'}, min: 0, max: 4}));
  add('cargo-fix', options(['fix'], [...new Set(flags), '--allow-dirty', '--allow-staged', '--broken-code', '--edition', '--edition-idioms'], values));
  add('cargo-new-init', options([choice('new', 'init')], ['--bin', '--lib', '--quiet'], ['--name', '--edition', '--vcs'], {match: ordinary, min: 0, max: 1}), routine, {operands: 'write', operandDirectory: true});
  for (const [id, verbs] of [['dependencies', ['add', 'remove', 'rm']], ['resolution', ['update', 'generate-lockfile', 'fetch']]]) {
    add(`cargo-${id}`, options([choice(...verbs)], ['--locked', '--offline', '--frozen', '--workspace', '--dev', '--build', '--optional', '--no-default-features', '--no-optional', '--dry-run', '-q', '--quiet'], ['--manifest-path', '-p', '--package', '--features', '-F', '--precise', '--rename', '--target'], {match: {regex: '[A-Za-z0-9_][A-Za-z0-9_.@+:/^~*<>=-]*'}, min: 0, max: 64}), dependency);
  }
  add('cargo-vendor', options(['vendor'], ['--locked', '--offline', '--frozen', '--versioned-dirs', '--no-delete', '--respect-source-config'], ['--manifest-path'], {match: ordinary, min: 0, max: 1}), dependency, {operands: 'write', operandDirectory: true});
  add('cargo-package', options(['package'], [...new Set(flags), '--list', '--no-verify', '--allow-dirty'], values));
  add('cargo-publish-dry', {...options(['publish'], [...new Set(flags), '--dry-run', '--no-verify', '--allow-dirty'], values), require_all: ['--dry-run']});
  add('cargo-clean', options(['clean'], ['--release', '--doc', '--dry-run', '-q', '--quiet'], ['--manifest-path', '--target-dir', '--profile', '--target', '-p', '--package']), review);
  add('cargo-install', options(['install'], ['--locked', '--offline', '--frozen', '--force', '--debug', '--no-default-features', '--all-features'], ['--path', '--root', '--target-dir', '--version', '--features', '--bin', '--example', '--target', '--profile'], {match: ordinary, min: 0, max: 16}), review);
  for (const [id, prefix, extraFlags, extraValues, decision, settings] of [
    ['nextest-run', ['nextest', 'run'], ['--no-fail-fast', '--fail-fast', '--all-features', '--no-default-features', '--workspace', '--lib', '--all-targets', '--locked', '--offline', '--frozen', '--no-run', '--run-ignored'], ['--manifest-path', '--target-dir', '--profile', '--cargo-profile', '--target', '--features', '-p', '--package', '--test-threads', '--stress-count', '-E', '--filter-expr', '--test', '--bin', '--example'], routine, {}],
    ['nextest-list', ['nextest', 'list'], ['--locked', '--offline', '--frozen', '--all-features', '--no-default-features', '--workspace'], ['--manifest-path', '--target-dir', '--profile', '--cargo-profile', '--target', '--features', '-E', '--filter-expr', '--message-format'], routine, {}],
    ['nextest-archive', ['nextest', 'archive'], ['--locked', '--offline', '--frozen', '--all-features'], ['--manifest-path', '--target-dir', '--archive-file', '--features', '--target'], routine, {}],
    ['deny', ['deny', 'check'], ['--all-features', '--no-default-features', '--locked', '--offline', '--frozen', '--disable-fetch'], ['--manifest-path', '--features'], routine, {}],
    ['audit', ['audit'], ['--json', '--no-fetch', '--locked', '--offline'], [], routine, {}],
    ['coverage', ['llvm-cov'], ['--locked', '--offline', '--frozen', '--all-features', '--no-default-features', '--html', '--lcov', '--json', '--text', '--no-report', '--summary-only', '--workspace', '--lib', '--doctests'], ['--manifest-path', '--target-dir', '--output-path', '--output-dir', '--features', '--target', '--profile', '--fail-under-lines'], routine, {}],
    ['coverage-nextest', ['llvm-cov', 'nextest'], ['--locked', '--offline', '--frozen', '--all-features', '--no-default-features', '--html', '--lcov', '--json', '--workspace', '--lib', '--run-ignored', '--no-report'], ['--manifest-path', '--target-dir', '--output-path', '--output-dir', '--features', '--target', '--profile', '--test-threads', '--fail-under-lines', '-E'], routine, {}],
    ['coverage-report', ['llvm-cov', 'report'], ['--html', '--lcov', '--json', '--text', '--summary-only'], ['--output-path', '--output-dir', '--manifest-path'], routine, {}],
    ['snapshots-test', ['insta', 'test'], ['--review', '--accept', '--check', '--unreferenced', '--all-features'], ['--manifest-path', '--features', '--test'], routine, {}],
    ['snapshots-review', ['insta', choice('review', 'accept', 'reject', 'pending')], ['--quiet'], ['--manifest-path', '--workspace-root'], routine, {}],
  ]) {
    if (extraFlags.includes('--run-ignored')) {
      extraFlags.splice(extraFlags.indexOf('--run-ignored'), 1);
      extraValues.push(value('--run-ignored', 'default|only|all'));
    }
    // A positional word in a CLI with default subcommands can be another
    // operation (e.g. audit fix or llvm-cov clean), not a test-name filter.
    const operands = id === 'deny' ? {match: {regex: 'advisories|bans|licenses|sources'}, min: 0, max: 4}
      : ['nextest-run', 'nextest-list', 'snapshots-test'].includes(id) ? {match: {regex: '[A-Za-z0-9_][A-Za-z0-9_:.-]*'}, min: 0, max: 16} : false;
    add(`cargo-${id}`, options(prefix, extraFlags, extraValues, operands), decision, settings);
  }
  return rows;
}

// Prefix an options grammar without losing its declared leading-option phase.
function delegated(grammar) {
  if (!grammar.leading) return;
  grammar.flags = [...new Set([...grammar.flags, ...grammar.leading.flags])];
  const names = new Set(grammar.values.map(v => typeof v === 'string' ? v : v.name));
  grammar.values.push(...grammar.leading.values.filter(v => !names.has(typeof v === 'string' ? v : v.name)));
  delete grammar.leading;
}
function route(source, prefix, executable, id) {
  const row = structuredClone(source);
  row.id = id;
  row.conditions.executable = {one_of: forms(executable)};
  for (const grammar of [row.conditions.arguments, row.requirements?.argument_paths?.grammar].filter(Boolean)) {
    if (grammar.kind === 'options') {
      grammar.prefix.unshift(...prefix);
      // Wrapper options belong before TOOLCHAIN, not to delegated Cargo globals.
      delegated(grammar);
    } else if (grammar.kind === 'exact') {
      grammar.prefix = [...prefix, ...grammar.values];
      delete grammar.values;
      grammar.kind = 'sequence';
      grammar.rest = {kind: 'none'};
    } else if (grammar.kind === 'prefix') {
      grammar.values.unshift(...prefix);
      // Nested leading-option phases are not declared wrapper syntax.
      delete grammar.leading;
    } else if (grammar.kind === 'risk_tokens') grammar.prefix.unshift(...prefix);
    else if (grammar.kind === 'any') {
      grammar.kind = 'prefix';
      grammar.values = structuredClone(prefix);
    } else grammar.values?.unshift(...prefix);
  }
  return row;
}

function targetPaths(rules) {
  for (const source of [...rules]) {
    const grammar = source.conditions.arguments;
    // Dependency table selectors are stored in Cargo.toml rather than opened
    // as compiler target specifications (and may contain cfg expressions).
    if (source.id === 'cargo-dependencies' || grammar.kind !== 'options' || !grammar.values.includes('--target')) continue;
    const file = structuredClone(source);
    file.id += '-target-file';
    const namedTarget = value('--target', '[A-Za-z0-9_][A-Za-z0-9_-]*');
    const fileTarget = value('--target', '[^\\x00\\r\\n]*[/\\\\][^\\x00\\r\\n]*|[^\\x00\\r\\n]+\\.json');
    for (const declared of [grammar, source.requirements?.argument_paths?.grammar].filter(Boolean)) {
      declared.values = declared.values.map(option => option === '--target' ? structuredClone(namedTarget) : option);
    }
    file.conditions.arguments.values = file.conditions.arguments.values.map(option => option === '--target' ? fileTarget : option);
    file.conditions.arguments.require_all = [...new Set([...(file.conditions.arguments.require_all ?? []), '--target'])];
    file.requirements ??= {};
    file.requirements.argument_paths ??= {options: {}};
    file.requirements.argument_paths.grammar = structuredClone(file.conditions.arguments);
    file.requirements.argument_paths.options ??= {};
    file.requirements.argument_paths.options['--target'] = path(read);
    file.on_unmet = {decision: 'deny', message: 'Custom target files must use approved read paths and preserve protected files.'};
    rules.push(file);
  }
}

export function rustPack() {
  const cargo = cargoRules();
  const rules = [...cargo];
  for (const tool of ['rustc', 'rustdoc', 'rustfmt', 'rustup']) {
    for (const flag of ['--version', '-V', '--help', '-h']) rules.push(rule(`${tool}-${flag.replace(/-/g, '')}`, tool, {kind: 'exact', values: [flag]}, inspect, {project: false}));
  }
  rules.push(rule('rustc-print', 'rustc', options([], [], [value('--print', 'sysroot|target-list|host-tuple|cfg')], false), inspect, {project: false}));
  rules.at(-1).conditions.arguments.require_all = ['--print'];
  for (const tool of ['rustc', 'rustdoc']) {
    rules.push(rule(`${tool}-source`, tool, options([], ['--test', '--document-private-items', '--no-deps', '-g', '-O'], ['--edition', '--crate-name', '--crate-type', '--target', '-o', '--out-dir'], {match: {regex: '[^\\x00\\r\\n]+\\.rs'}, min: 1, max: 1}), routine, {operands: 'read'}));
  }
  rules.push(rule('rustfmt-files', 'rustfmt', options([], ['--check', '-v', '--verbose', '-q', '--quiet'], [value('--edition', '2015|2018|2021|2024')], {match: {regex: '[^\\x00\\r\\n]+\\.rs'}, min: 1, max: 128}), routine, {operands: 'write'}));
  rules.push(rule('rustfmt-print-config', 'rustfmt', options(['--print-config', choice('default', 'minimal', 'current')], [], [], {match: ordinary, min: 1, max: 1}), review, {operands: 'write'}));
  for (const prefix of [['toolchain', 'list'], ['override', 'list'], ['target', 'list'], ['component', 'list'], ['show', 'active-toolchain'], ['show'], ['which', choice('cargo', 'rustc', 'rustdoc', 'rustfmt')]]) {
    rules.push(rule(`rustup-query-${rules.length}`, 'rustup', options(prefix, ['--installed'], ['--toolchain']), inspect, {project: false}));
  }
  targetPaths(rules);
  const restrict = (id, tool, any_of, decision) => ({id, conditions: {domain: 'argv', executable: {one_of: forms(tool)}, arguments: {kind: 'risk_tokens', prefix: [], any_of}}, decision});
  for (const tool of ['cargo', 'rustc', 'rustdoc', 'rustfmt', 'rustup']) {
    rules.push(restrict(`${tool}-execution-overrides`, tool, ['--config', '--config-path', '-Z', '@', {regex: '@.*|--(?:config|config-path)=.*'}], review));
    rules.push(restrict(`${tool}-credentials`, tool, [{regex: '--token'}, '--credential-provider', '--registry', '--index', {regex: '--(?:token|credential-provider|registry|index)=.*'}], sensitive));
    rules.push({id: `${tool}-unlisted`, conditions: {domain: 'argv', executable: {one_of: forms(tool)}, arguments: {kind: 'any'}}, decision: review,
      reason: 'Unlisted Rust syntax requires review, including when a broader Baseline allowance matches.'});
  }
  rules.push(rule('cargo-authentication', 'cargo', {kind: 'prefix', values: [choice('login', 'logout', 'config', 'credential')], leading: globals}, sensitive, {project: false}));
  // Other administration verbs have no positive allowance. The unlisted rule
  // reviews them without scanning dependency names or delegated arguments.
  // Route the complete policy, including restrictions and unlisted syntax.
  // Each delegated restriction stays scoped to the exact wrapper prefix.
  for (const source of [...rules].filter(row => row.conditions.executable.one_of[0] === 'cargo')) {
    rules.push(route(source, [{regex: '\\+[A-Za-z0-9][A-Za-z0-9._-]*'}], 'cargo', `toolchain-${source.id}`));
  }
  for (const source of [...rules].filter(row => ['cargo', 'rustc', 'rustdoc', 'rustfmt'].includes(row.conditions.executable.one_of[0]) && !row.id.startsWith('toolchain-'))) {
    rules.push(route(source, ['run', {regex: '[A-Za-z0-9][A-Za-z0-9._-]*'}, source.conditions.executable.one_of[0]], 'rustup', `rustup-run-${source.id}`));
  }
  // Direct plugins do not inherit Cargo argv conventions. Explicit review is
  // coverage, not an assertion that their bare invocation has the same grammar.
  for (const tool of commandNames.filter(name => name.startsWith('cargo-'))) rules.push({id: `${tool}-direct`, conditions: {domain: 'argv', executable: {one_of: forms(tool)}, arguments: {kind: 'any'}}, decision: review});

  const variables = {};
  for (const tool of ['cargo', 'rustc', 'rustdoc', 'rustfmt', 'rustup']) {
    const name = `${tool}_executable`;
    variables[name] = {type: 'string', description: `Additional absolute ${tool} executable path; unset keeps the standard command spellings.`,
      layer: 'local', match: {regex: `/[^\\x00\\r\\n]+/${tool}`}, max_length: 1024,
      setup: {question: `Use an additional ${tool} executable path?`, unset: 'Standard command spellings'}};
    for (const source of [...rules].filter(row => row.conditions.executable.one_of?.[0] === tool)) {
      const row = structuredClone(source);
      row.id = `local-${source.id}`;
      row.conditions.executable = {var: name};
      rules.push(row);
    }
  }
  return {schema_version: 1, kind: 'pack', id: 'canonic/rust', version: '0.1.0',
    description: 'Rust development with reviewed explicit argument paths, trusted builds and tests, and separate installation, toolchain, credential and release permissions.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: '>=0.3.0, <0.4.0'},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'argument-paths-v1', 'prefix-leading-v1', 'location-v1', 'access-paths-v1', 'requirements-v1', 'regex-v1', 'variables-v1'],
    variables, rules};
}

export async function buildRustPack() {
  const pack = rustPack();
  await mkdir(destination, {recursive: true});
  // Registry acquisition bounds every artifact to 1 MiB. Keep the reviewed
  // policy structure in this source; whitespace need not expand the artifact.
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1,
    commands: commandNames.map(name => ({name, rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of?.includes(name)).map(rule => rule.id)}))}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildRustPack();
