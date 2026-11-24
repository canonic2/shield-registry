import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const destroy = {loose: 'ask', recommended: 'deny', strict: 'deny'};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const protectedPaths = ['.git', '.shield', '.ssh', '.aws', '.codex', '.claude', '.env', '.mcp.json'];
const paths = root => ({path: {within: {root}, exclude: protectedPaths.map(path => ({root: 'project', path}))}});
const simLeading = {flags: [], values: ['--set', '--profiles'], interleaved: true};
const deviceLeading = {flags: ['-v', '--verbose', '-q', '--quiet'],
  values: ['-t', '--timeout', '-j', '--json-output', '-l', '--log-output'], interleaved: true};

// Operation names are an inventory, not an assertion that an invocation is safe.
// Expected decisions live independently in apple-cases.mjs.
export const tools = {
  xcodebuild: {operations: ['build', 'build-for-testing', 'test', 'test-without-building', 'analyze', 'archive',
    'install', 'installsrc', 'clean', '-list', '-showBuildSettings', '-showBuildSettingsForIndex', '-showdestinations',
    '-showTestPlans', '-resolvePackageDependencies', '-exportArchive', '-exportNotarizedApp', '-exportLocalizations',
    '-importLocalizations', '-create-xcframework', '-downloadPlatform', '-downloadAllPlatforms', '-importPlatform',
    '-downloadComponent', '-importComponent', '-deleteComponent', '-showComponent', '-prepareDeviceSupport',
    '-runFirstLaunch', '-license'],
    reason: 'Review project schemes, package resolution, build scripts/macros, tests, signing/provisioning, export/upload destinations, runtime downloads and host setup.'},
  'xcode-select': {operations: ['--print-path', '--switch', '--reset', '--install'],
    reason: 'Review active developer-directory changes and command-line tool installation.'},
  simctl: {leading: simLeading, operations: ['addmedia', 'appinfo', 'boot', 'clone', 'create', 'delete', 'diagnose',
    'erase', 'get_app_container', 'getenv', 'icloud_sync', 'install', 'install_app_data', 'io', 'keychain', 'launch',
    'list', 'listapps', 'location', 'logverbose', 'openurl', 'pair', 'pair_activate', 'pbcopy', 'pbpaste', 'pbsync',
    'personalization', 'privacy', 'push', 'rename', 'runtime add', 'runtime delete', 'runtime verify', 'runtime list',
    'runtime scan-and-mount', 'runtime match list', 'runtime match set', 'runtime dyld_shared_cache update',
    'runtime dyld_shared_cache remove', 'shutdown', 'spawn', 'status_bar', 'terminate', 'ui', 'uninstall', 'unpair', 'upgrade'],
    destructive: ['delete', 'erase', 'uninstall', 'install_app_data', 'runtime delete', 'runtime dyld_shared_cache remove'],
    reason: 'Review simulator identity, lifecycle, installed apps/data, subprocesses, privacy/keychain state, pasteboards, URLs, media and runtime changes.'},
  devicectl: {leading: deviceLeading, operations: ['list devices', 'list preferredDDI', 'diagnose',
    'device copy to', 'device copy from', 'device info appIcon', 'device info apps', 'device info authListing',
    'device info ddiServices', 'device info details', 'device info displays', 'device info files',
    'device info lockState', 'device info processes', 'device install app', 'device uninstall app',
    'device process launch', 'device process resume', 'device process sendMemoryWarning', 'device process signal',
    'device process suspend', 'device process terminate', 'device notification post', 'device notification observe',
    'device orientation get', 'device orientation rotate', 'device orientation set', 'device reboot', 'device sysdiagnose',
    'manage ddis clean', 'manage ddis update', 'manage loggingProfile register',
    'manage pair', 'manage unpair'], destructive: ['device uninstall app', 'manage ddis clean', 'manage unpair'],
    reason: 'Review physical-device identity, private data/diagnostics, file transfer, app execution/installation, pairing, profiles and process control.'},
  xctrace: {operations: ['record', 'import', 'export', 'remodel', 'symbolicate', 'list', 'version'],
    reason: 'Review attached processes/devices, recording templates, trace contents, file output and injected instrumentation.'},
  swift: {operations: ['build', 'test', 'run', 'repl', 'package add-dependency', 'package add-product', 'package add-target',
    'package add-target-dependency', 'package add-setting', 'package experimental-audit-binary-artifact',
    'package clean', 'package purge-cache', 'package reset', 'package update', 'package describe', 'package init',
    'package migrate', 'package experimental-install', 'package experimental-uninstall',
    'package diagnose-api-breaking-changes', 'package dump-symbol-graph', 'package dump-package', 'package edit',
    'package unedit', 'package config', 'package resolve', 'package show-dependencies', 'package show-executables',
    'package tools-version', 'package compute-checksum', 'package archive-source', 'package completion-tool',
    'package plugin', 'package-registry', 'sdk', 'format'],
    reason: 'Swift manifests are executable. Review scripts, REPL, compiler macros/plugins, dependencies, package edits, credentials, caches, generated output and registry operations.'},
  swiftc: {operations: [], reason: 'Review compilation, compiler/linker plugins and macros, response files, SDK/toolchain selection and output paths.'},
  'swift-format': {operations: ['format', 'lint', 'dump-configuration'],
    reason: 'Review source/configuration paths, explicit symlink following and formatting inputs whose locations cannot be established.'},
  swiftlint: {operations: ['lint', 'analyze', 'baseline', 'docs', 'generate-docs', 'reporters', 'rules', 'version', 'autocorrect'],
    reason: 'Review inherited/remote configuration, dynamic SourceKit, compiler logs, environment-provided file lists, fixes, baselines, reports and generated documentation.'},
  pod: {operations: ['init', 'install', 'update', 'outdated', 'deintegrate', 'env', 'list', 'search', 'setup', 'try',
    'cache list', 'cache clean', 'ipc list', 'ipc podfile', 'ipc podfile-json', 'ipc spec', 'ipc repl', 'lib create', 'lib lint',
    'repo add', 'repo add-cdn', 'repo lint', 'repo list', 'repo push', 'repo remove', 'repo update',
    'spec cat', 'spec create', 'spec edit', 'spec lint', 'spec which', 'spec yank',
    'trunk add-owner', 'trunk delete', 'trunk deprecate', 'trunk info', 'trunk me', 'trunk push', 'trunk register',
    'trunk remove-owner', 'plugins create', 'plugins installed', 'plugins list', 'plugins search'],
    reason: 'CocoaPods/CLAide can load installed plugins during startup. Review Ruby Podfiles/podspecs, hooks, dependency/build execution, credentials and publication.'},
  codesign: {operations: [], reason: 'Review signing identities/key access, entitlements, signing and signature removal, external requirements, bundle paths and verification inputs.'},
  security: {leading: {flags: ['-v', '-q', '-i', '-l'], values: ['-p'], interleaved: true},
    operations: ['list-keychains', 'default-keychain', 'login-keychain', 'create-keychain', 'delete-keychain',
      'lock-keychain', 'unlock-keychain', 'set-keychain-settings', 'set-keychain-password', 'show-keychain-info',
      'find-identity', 'find-certificate', 'find-generic-password', 'find-internet-password', 'add-generic-password',
      'add-internet-password', 'delete-generic-password', 'delete-internet-password', 'delete-certificate',
      'import', 'export', 'set-key-partition-list', 'add-trusted-cert', 'remove-trusted-cert', 'verify-cert',
      'cms', 'authorizationdb', 'authorize', 'execute-with-privileges'],
    destructive: ['delete-keychain', 'delete-generic-password', 'delete-internet-password', 'delete-certificate', 'remove-trusted-cert'],
    reason: 'Review keychain identity, secret/certificate reads and exports, key access, trust settings, authorization and privileged execution.'},
  notarytool: {operations: ['store-credentials', 'submit', 'info', 'wait', 'history', 'log'],
    reason: 'Review Apple account/keychain credentials, archive uploads, team/submission identity and downloaded logs.'},
  altool: {operations: ['--validate-app', '--upload-app', '--upload-package', '--list-providers', '--list-apps',
    '--generate-api-key', '--store-password-in-keychain-item', '--notarize-app', '--notarization-info', '--notarization-history'],
    reason: 'Review App Store Connect credentials, validation, uploads and retained legacy notarization syntax. Legacy notarization availability is not promised.'},
  stapler: {operations: ['staple', 'validate'], reason: 'Both stapling and validation contact Apple ticket services; review target bundles and writes.'},
  pkgbuild: {operations: [], reason: 'Review package roots, installer scripts, ownership, signing and output archives.'},
  productbuild: {operations: [], reason: 'Review distribution scripts/resources, component packages, signing, destinations and installer output.'},
  productsign: {operations: [], reason: 'Review signing identity, keychain access and installer package input/output.'},
  pkgutil: {operations: [], reason: 'Review package payload/receipt paths, extraction, receipt mutation and signature checks.'},
  xcresulttool: {operations: ['get', 'export', 'graph', 'metadata', 'formatDescription', 'merge', 'compare'],
    reason: 'Review potentially private result contents, attachments and paths, exports, metadata mutations and bundle merging.'},
  xccov: {operations: ['view', 'diff', 'merge'], reason: 'Review coverage inputs, source-path disclosure, archive merging and output files.'},
  dsymutil: {operations: [], reason: 'Review debug-map inputs, symbol/object paths, updates and generated dSYM bundles.'},
  dwarfdump: {operations: [], reason: 'Review debug information inputs, source-path disclosure and explicit output files.'},
  atos: {operations: [], reason: 'Review executable images, architecture, symbol information and process attachment.'},
  symbols: {operations: [], reason: 'Review process inspection, symbol paths, cache changes and report output.'},
  agvtool: {operations: ['what-version', 'what-marketing-version', 'next-version', 'new-version', 'new-marketing-version'],
    reason: 'Review project/version inspection, source-control integration and project/plist version edits.'},
  ibtool: {operations: [], reason: 'Review interface files, plugins, compilation, conversion and generated output.'},
  actool: {operations: [], reason: 'Review asset-catalog inputs, compiler plugins and generated output.'},
};
export const commands = ['xcrun', ...Object.keys(tools)];
export const discoveryCommands = ['xcrun', 'xcodebuild', 'simctl', 'devicectl', 'swift', 'swiftc', 'swift-format',
  'swiftlint', 'pod', 'xctrace', 'codesign', 'security', 'notarytool', 'stapler', 'xcresulttool', 'dsymutil'];
const info = {
  xcodebuild: [['-version'], ['-help'], ['-usage'], ['-showsdks'], ['-checkFirstLaunchStatus']],
  'xcode-select': [['--version'], ['--help'], ['-h'], ['--print-path'], ['-p']],
  simctl: [['help']], devicectl: [['--version'], ['--help'], ['-h'], ['help']],
  xctrace: [['help'], ['version']], swift: [['--version'], ['-version'], ['--help'], ['-help'],
    ['package', '--help'], ['package', '--version'], ['build', '--help'], ['test', '--help'], ['run', '--help']],
  swiftc: [['--version'], ['-version'], ['--help'], ['-help']],
  'swift-format': [['--version'], ['-v'], ['--help'], ['-h'], ['dump-configuration']],
  swiftlint: [['version'], ['--version'], ['--help'], ['-h']],
  notarytool: [['--version'], ['--help'], ['-h'], ['help']],
  xcresulttool: [['--version'], ['--help'], ['-h'], ['help']],
  dsymutil: [['--version'], ['--help']], dwarfdump: [['--version'], ['--help']],
};

function executable(name) {
  return {one_of: [...executableForms(name),
    `/Applications/Xcode.app/Contents/Developer/usr/bin/${name}`,
    `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/${name}`]};
}

// Reuse the child's exact policy including every path requirement. This is not
// general xcrun delegation. Alternate SDK/toolchain selectors remain reviewed.
function routedArguments(args, prefix, launcher = false) {
  if (args.kind === 'any') return {kind: 'prefix', values: prefix};
  if (args.kind === 'exact') return {...args, values: [...prefix, ...args.values]};
  const result = structuredClone(args);
  if (args.kind === 'prefix') result.values = [...prefix, ...args.values];
  else result.prefix = [...prefix, ...(args.prefix ?? [])];
  if (launcher && args.kind !== 'risk_tokens') result.leading = {
    flags: ['-r', '--run', ...(args.leading?.flags ?? [])], values: args.leading?.values ?? [], interleaved: true,
  };
  return result;
}

export function applePack() {
  const rules = [];
  const add = (id, name, arguments_, decision, reason, extra = {}) => {
    const row = {id: `${name}-${id}`, conditions: {domain: 'argv', executable: executable(name), arguments: arguments_}, decision, reason, ...extra};
    rules.push(row);
    return row;
  };
  for (const [name, tool] of Object.entries(tools)) {
    add('review', name, {kind: 'any'}, review, tool.reason);
    for (const operation of tool.destructive ?? []) add(`op-${operation.replaceAll(' ', '-')}`, name,
      {kind: 'prefix', values: operation.split(' '), ...(tool.leading ? {leading: tool.leading} : {})},
      destroy, tool.reason);
    for (const [index, values] of (info[name] ?? []).entries()) add(`info-${index}`, name,
      {kind: 'exact', values}, 'allow', 'Print trusted installed-tool information without project build, device mutation or credential access.');
    if (['simctl', 'devicectl', 'xctrace', 'notarytool', 'xcresulttool'].includes(name))
      add('help-topic', name, {kind: 'prefix', values: ['help']}, 'allow', 'Print built-in command help without performing the described operation.');
  }

  const bounded = (id, name, grammar, decision, optionPaths, operandRoot) => {
    const row = add(id, name, grammar, decision, 'Inspect metadata or format source with explicit paths checked against approved roots.',
      {requirements: {argument_paths: {grammar,
        ...(operandRoot ? {operands: {...paths(operandRoot), recursive: true}} : {}),
        options: Object.fromEntries(Object.entries(optionPaths).map(([option, root]) => [option, paths(root)])),
      }}, on_unmet: {decision: 'ask', message: 'Review paths outside approved roots, protected state or unresolved path evidence.'}});
    row.conditions.cwd = {within: {root: operandRoot ?? 'read'}, exclude: protectedPaths.map(path => ({root: 'project', path}))};
  };
  for (const prefix of [['list'], ['runtime', 'list'], ['runtime', 'match', 'list']]) {
    const grammar = {kind: 'options', prefix, leading: simLeading, flags: ['-j', '-e', '-v'],
      values: ['--json-output', '--json-fd'], operands: true, unknown_options: 'skip', forbid: ['--json-fd']};
    bounded(`inspect-${prefix.join('-')}`, 'simctl', grammar, 'allow', {'--set': 'read', '--profiles': 'read', '--json-output': 'write'});
  }
  for (const operation of ['devices', 'preferredDDI']) {
    const grammar = {kind: 'options', prefix: ['list', operation], leading: deviceLeading,
      flags: ['-v', '-q'], values: [...deviceLeading.values, '--filter', '--sort-by', '--columns'],
      forbid: ['--filter'], operands: true, unknown_options: 'skip'};
    bounded(`inspect-list-${operation}`, 'devicectl', grammar, 'allow',
      {'-j': 'write', '--json-output': 'write', '-l': 'write', '--log-output': 'write'});
  }
  for (const prefix of [[], ['format'], ['lint']]) {
    const grammar = {kind: 'options', prefix, flags: ['-i', '-r', '-p', '-s', '-h', '--follow-symlinks'],
      values: ['--configuration', '--offsets', '--assume-filename', '--enable-experimental-feature'],
      forbid: ['--follow-symlinks'], operands: true, unknown_options: 'skip'};
    bounded(`paths-${prefix[0] ?? 'default'}`, 'swift-format', grammar, routine,
      {'--configuration': 'read', '--assume-filename': 'write'}, 'write');
  }

  // Swift's formatter alias owns the same policy, separate from executable
  // Swift manifests, compiler modes and scripts.
  for (const row of rules.filter(row => row.id.startsWith('swift-format-'))) {
    const alias = structuredClone(row);
    alias.id = `swift-alias-${row.id}`;
    alias.conditions.executable = executable('swift');
    alias.conditions.arguments = routedArguments(row.conditions.arguments, ['format']);
    if (alias.requirements) alias.requirements.argument_paths.grammar = routedArguments(row.requirements.argument_paths.grammar, ['format']);
    rules.push(alias);
  }
  for (const row of [...rules]) {
    // The launcher's whole-invocation review already supplies these defaults.
    // Repeating it as a child prefix would tie narrower help-topic rules.
    if (row.id.endsWith('-review')) continue;
    const name = row.id.startsWith('swift-alias-') ? 'swift' : Object.keys(tools).find(name =>
      row.conditions.executable.one_of.includes(name));
    const wrapped = structuredClone(row);
    wrapped.id = `xcrun-${row.id}`;
    wrapped.conditions.executable = executable('xcrun');
    wrapped.conditions.arguments = routedArguments(row.conditions.arguments, [name], true);
    if (wrapped.conditions.arguments.kind === 'prefix' && row.decision !== 'allow') {
      const values = ['--sdk', '--toolchain', ...(row.conditions.arguments.leading?.values ?? [])];
      wrapped.conditions.arguments.leading = {
        flags: [...new Set(['-r', '--run', '-v', '--verbose', '-l', '--log', '-n', '--no-cache', '-k', '--kill-cache',
          ...(row.conditions.arguments.leading?.flags ?? [])])].filter(flag => !values.includes(flag)),
        values: [...new Set(values)], interleaved: true,
      };
    }
    if (wrapped.requirements) wrapped.requirements.argument_paths.grammar = routedArguments(row.requirements.argument_paths.grammar, [name], true);
    rules.push(wrapped);
    if (row.conditions.arguments.kind === 'exact') for (const flag of ['-r', '--run']) {
      const explicitRun = structuredClone(wrapped);
      explicitRun.id += flag === '-r' ? '-run-short' : '-run-long';
      explicitRun.conditions.arguments.values.unshift(flag);
      rules.push(explicitRun);
    }
  }
  add('review', 'xcrun', {kind: 'any'}, review, 'Review arbitrary tool execution, explicit SDK/toolchain selection, alternate executable paths and cache changes.');
  for (const [index, values] of [['--help'], ['-h'], ['--version'], ['--show-sdk-path'], ['--show-sdk-version'],
    ['--show-sdk-build-version'], ['--show-sdk-platform-path'], ['--show-sdk-platform-version'], ['--show-toolchain-path']].entries())
    add(`info-${index}`, 'xcrun', {kind: 'exact', values}, 'allow', 'Print selected toolchain metadata from the trusted developer installation.');
  for (const name of Object.keys(tools)) for (const flag of ['-f', '--find'])
    add(`find-${flag.replaceAll('-', '')}-${name}`, 'xcrun', {kind: 'exact', values: [flag, name]}, 'allow', 'Locate an installed tool without running it.');

  return {schema_version: 1, kind: 'pack', id: 'canonic/apple', version, license: 'MIT', maintainers: ['Canonic'],
    description: 'Apple development: Xcode, Swift/SwiftPM, formatting/linting, CocoaPods, simulators/devices, signing, notarization and symbols, with checked paths and reviewed execution/publication.',
    engines: {shield: '>=0.53.0, <1.0.0'}, capabilities: ['structured-rules-v1', 'argument-rules-v1', 'argument-paths-v1',
      'location-v1', 'access-paths-v1', 'requirements-v1', 'prefix-leading-v1', 'interleaved-leading-v1', 'unknown-options-v1'], rules};
}

export function appleInventory(pack = applePack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(row => row.conditions.executable.one_of.includes(name)).map(row => row.id)}))};
}
