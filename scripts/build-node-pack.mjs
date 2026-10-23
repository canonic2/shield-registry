// Node's reviewed permission categories. Fixtures are maintained independently.
import {mkdir, writeFile, copyFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const destination = new URL('../packs/canonic/node/0.1.0/', import.meta.url);
const profiles = (loose, recommended = loose, strict = recommended) => ({loose, recommended, strict});
const routine = profiles('allow', 'allow', 'ask');
const installs = profiles('allow', 'allow', 'deny');
const review = profiles('ask', 'ask', 'deny');
const privileged = profiles('ask', 'deny', 'deny');
const scriptReview = {
  message: 'Project scripts require project policy review; a script name does not establish harmlessness.',
  alternatives: ['Inspect script definitions, hooks and arguments. If appropriate, propose a narrow project rule with shield_policy_propose and explain its effects in agent_reason. Submit its exact apply_arguments to shield_policy_apply for user review.'],
};
const forms = names => names.flatMap(name => [name, `/bin/${name}`, `/usr/bin/${name}`, `/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`]);
const choice = (...names) => ({one_of: names});
const options = (prefix, flags = [], values = [], operands = false) => ({kind: 'options', prefix, flags, values, operands});
const rule = (id, names, arguments_, decision, reason, extra = {}) => ({id, conditions: {
  domain: 'argv', executable: {one_of: forms(names)}, arguments: arguments_}, decision, reason, ...extra});
const project = {cwd: {within: {root: 'project'}}};
const inProject = value => ({...value, conditions: {...value.conditions, ...project}});
const risk = (prefix, ...any_of) => ({kind: 'risk_tokens', prefix, any_of});
const packageName = {regex: '(?:@[a-zA-Z0-9._~-]+/)?[a-zA-Z0-9][a-zA-Z0-9._~-]*(?:@[^\\s]+)?'};
const families = {npm: ['npm', 'npx'], pnpm: ['pnpm', 'pn', 'pnpx', 'pnx'], yarn: ['yarn', 'yarnpkg']};
export const commandNames = ['node', ...Object.values(families).flat(), 'corepack'];
const selected = manager => [{var: 'package_manager', equals: manager}];

function managerGates() {
  return Object.entries(families).flatMap(([manager, aliases]) => [
    {id: `manager-${manager}`, when: selected(manager),
      conditions: {domain: 'argv', executable: {one_of: forms(Object.values(families).flat())}},
      requires_any: [{executable: {one_of: forms(aliases)}}],
      on_unmet: {decision: 'deny', message: 'This project uses {{package_manager}}. Use {{package_manager}} instead.',
        alternatives: ['Use {{package_manager}} for this operation.']}},
    {id: `corepack-manager-${manager}`, when: selected(manager),
      conditions: {domain: 'argv', executable: {one_of: forms(['corepack'])}},
      requires_any: [
        {arguments: {kind: 'prefix', values: [{var: 'package_manager'}]}},
        ...aliases.filter(name => name !== manager && !['pn', 'pnx'].includes(name)).map(name => ({arguments: {kind: 'prefix', values: [name]}})),
        ...['--version', '-v', '--help', '-h'].map(name => ({arguments: {kind: 'exact', values: [name]}})),
      ],
      on_unmet: {decision: 'deny', message: 'This project uses {{package_manager}}. Use {{package_manager}} directly or corepack {{package_manager}}; unqualified Corepack setup cannot verify the selected manager.',
        alternatives: ['Use {{package_manager}} for this operation.']}},
  ]);
}

// Reuse the manager's actual argv grammar for explicit Corepack routes. This
// is pack data, not a second shell analyzer or runtime wrapper exception.
function corepackRules(rules) {
  const routes = ['npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'yarnpkg'];
  return routes.flatMap(manager => rules.filter(rule => rule.conditions.executable.one_of.includes(manager)).map(source => {
    const rule = structuredClone(source);
    rule.id = `corepack-${manager}-${source.id}`;
    rule.conditions.executable = {one_of: forms(['corepack'])};
    const args = rule.conditions.arguments;
    if (args.kind === 'any') rule.conditions.arguments = {kind: 'prefix', values: [manager]};
    else if (['exact', 'prefix'].includes(args.kind)) args.values.unshift(manager);
    else args.prefix.unshift(manager);
    return rule;
  }));
}

// Route only the declared operation grammar. Selectors never grant permission
// to the script or install that follows them. Paths are spelling restrictions,
// not execution containment (project hooks and symlinks remain trusted).
function projectRoutes(rules) {
  const path = {regex: '[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*/?'};
  const name = {regex: '[^-].*'};
  const routes = [
    ['npm-prefix', ['npm'], [choice('--prefix'), path]],
    ['npm-prefix-attached', ['npm'], [{regex: `--prefix=${path.regex}`}]],
    ['npm-workspace', ['npm'], [choice('--workspace', '-w'), name]],
    ['npm-workspace-attached', ['npm'], [{regex: '--workspace=[^-].*|-w[^-].*'}]],
    ['npm-workspaces', ['npm'], ['--workspaces']],
    ['pnpm-dir', ['pnpm', 'pn'], [choice('--dir', '-C'), path]],
    ['pnpm-dir-attached', ['pnpm', 'pn'], [{regex: `--dir=${path.regex}|-C${path.regex}`}]],
    ['pnpm-filter', ['pnpm', 'pn'], [choice('--filter', '-F'), name]],
    ['pnpm-filter-attached', ['pnpm', 'pn'], [{regex: '--filter=[^-].*|-F[^-].*'}]],
    ['pnpm-recursive', ['pnpm', 'pn'], [choice('-r', '--recursive')]],
    ['yarn-cwd', ['yarn', 'yarnpkg'], ['--cwd', path]],
    ['yarn-workspace', ['yarn', 'yarnpkg'], ['workspace', name]],
  ];
  return routes.flatMap(([id, names, prefix]) => rules.filter(rule =>
    /^(npm|pnpm|yarn)-(install|inspect-project|audit|scripts|tag-mutation|npm-tag-mutation)$|^manager-(scripts|inspection)$/.test(rule.id)
      && names.some(name => rule.conditions.executable.one_of.includes(name)))
    .map(source => {
      const value = structuredClone(source);
      value.id = `${id}-${source.id}`;
      value.conditions.executable = {one_of: forms(names)};
      const args = value.conditions.arguments;
      if (args.kind === 'prefix') args.values.unshift(...prefix);
      else args.prefix.unshift(...prefix);
      return value;
    }));
}

export function nodePack() {
  const rules = [
      rule('version-help', commandNames, {kind: 'sequence', prefix: [choice('--version', '-v', '--help', '-h')], rest: {kind: 'none'}}, profiles('allow'), 'Inspect version or help using the configured executable.'),
      rule('npm-help', ['npm'], options(['help'], [], [], {match: {regex: '[a-z][a-z-]*'}, min: 0, max: 1}), profiles('allow'), 'Read npm help; the configured help viewer is trusted.'),
      rule('npm-metadata', ['npm'], options([choice('view', 'info', 'show', 'v')], ['--json'], [], {match: {regex: '[a-zA-Z0-9@][a-zA-Z0-9@/._~^*+<>=|-]*'}, min: 1, max: 8}), profiles('allow'), 'Query package metadata from the configured registry; this may access the network and use configured credentials.'),
      inProject(rule('npm-init', ['npm'], options(['init'], ['-y', '--yes']), routine, 'Create a default project manifest; npm initializers naming packages require separate review.')),
      rule('npm-scripts', ['npm'], {kind: 'prefix', values: [choice('run', 'run-script', 'test', 't', 'start', 'stop', 'restart')]}, profiles('ask'), 'Project scripts need an explicit project rule.', {guidance: scriptReview}),
      inProject(rule('npm-inspect-project', ['npm'], options([choice('ls', 'list', 'outdated', 'explain', 'why')], ['--json', '--all'], [{name: '--depth', match: '0'}], {match: packageName, min: 0, max: 8}), profiles('allow'), 'Inspect project dependency metadata.')),
      inProject(rule('npm-audit', ['npm'], options(['audit'], ['--json'], [{name: '--omit', match: choice('dev', 'optional', 'peer')}]), profiles('allow'), 'Request a dependency vulnerability report from the configured registry; no fixes or registry overrides.')),
      inProject(rule('npm-install', ['npm'], options([choice('install', 'i', 'add', 'ci', 'update', 'uninstall', 'remove', 'rebuild')], ['--save-dev', '-D', '--save-exact', '-E', '--ignore-scripts', '--no-audit', '--no-fund'], [], {match: packageName, min: 0, max: 32}), installs, 'Trust local dependency changes, including downloads, lockfile changes and lifecycle scripts. --ignore-scripts does not establish full execution containment.')),
      rule('npm-exec', ['npm'], risk([], 'exec', 'x', 'create'), review, 'npm exec and initializers can download and execute arbitrary package code.'),
      rule('npm-init-package', ['npm'], risk(['init'], {regex: '[^-].*'}), review, 'A named npm initializer can execute a package, including after -y/--yes.'),
      rule('npx-execution', ['npx'], {kind: 'any'}, review, 'npx can fetch and run arbitrary packages; --no-install does not make package code an inspection operation.', {fallback: true}),
      rule('npm-global', ['npm'], risk([], '-g', '--global', 'global', '--location=global', {regex: '--global=.*'}), privileged, 'Global package operations affect the host installation.'),
      rule('npm-publication', ['npm'], risk([], 'publish', 'unpublish', 'dist-tag', 'deprecate', 'access', 'owner'), review, 'Publication and package access changes affect a remote registry.'),
      rule('npm-tag-mutation', ['npm'], {kind: 'prefix', values: [choice('dist-tag', 'dist-tags'), choice('add', 'a', 'set', 's', 'rm', 'r', 'del', 'd', 'remove')]}, review, 'Change distribution tags in the configured package registry.'),
      rule('npm-credentials-config', ['npm'], risk([], 'login', 'adduser', 'logout', 'token', 'config', 'set', 'get', 'profile'), privileged, 'Authentication, token and configuration commands can expose or change credentials and registry settings.'),
      rule('npm-launch-overrides', ['npm'], risk([], '--userconfig', '--globalconfig', '--script-shell', '--registry', '--location', {regex: '--(?:userconfig|globalconfig|script-shell|registry|location)=.*'}), review, 'Configuration and execution overrides require review.'),
      rule('node-project-script', ['node'], {kind: 'sequence', prefix: [{regex: '(?:\\./)?(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+\\.(?:js|cjs|mjs)'}], rest: {kind: 'any'}}, profiles('ask'), 'Node project scripts require project policy review.', {guidance: scriptReview}),
      rule('node-test', ['node'], {kind: 'prefix', values: ['--test']}, profiles('ask'), 'Node tests execute project code and need project policy review.', {guidance: scriptReview}),
      rule('node-inline-preload', ['node'], risk([], '-e', '--eval', '-p', '--print', '-r', '--require', '--import', '--loader', '--experimental-loader', {regex: '--(?:eval|print|require|import|loader|experimental-loader)=.*'}), review, 'Inline code, preloads and loaders execute code beyond a plain script launch.'),
      rule('node-unlisted', ['node'], {kind: 'any'}, review, 'Unlisted Node options, stdin, alternate script locations and execution modes require review.', {fallback: true}),
      rule('npm-unlisted', ['npm'], {kind: 'any'}, profiles('ask'), 'Unlisted npm syntax requires review; no blanket package-manager permission.', {fallback: true, guidance: scriptReview}),
      inProject(rule('pnpm-install', ['pnpm', 'pn'], options([choice('install', 'i', 'add', 'update', 'remove', 'rebuild')], ['--save-dev', '-D', '--save-exact', '-E', '--ignore-scripts', '--frozen-lockfile', '--prefer-offline', '--offline', '--prod'], [], {match: packageName, min: 0, max: 32}), installs, 'Trust local pnpm dependency changes and any configured lifecycle or project hooks.')),
      inProject(rule('yarn-install', ['yarn', 'yarnpkg'], options([choice('install', 'add', 'remove', 'upgrade', 'up')], ['--dev', '-D', '--exact', '-E', '--ignore-scripts', '--frozen-lockfile', '--immutable', '--immutable-cache', '--check-cache', '--offline'], [], {match: packageName, min: 0, max: 32}), installs, 'Trust listed Yarn Classic and modern dependency operations, including configured plugins and lifecycle scripts.')),
      rule('manager-scripts', ['pnpm', 'pn', 'yarn', 'yarnpkg'], {kind: 'prefix', values: [choice('run', 'run-script', 'test', 't', 'start', 'stop', 'restart', 'build', 'lint', 'typecheck', 'format', 'check', 'dev')]}, profiles('ask'), 'Project scripts need an explicit project rule; shorthand is not a safety classification.', {guidance: scriptReview}),
      inProject(rule('manager-inspection', ['pnpm', 'pn', 'yarn', 'yarnpkg'], options([choice('list', 'ls', 'why', 'outdated', 'info')], ['--json'], [], {match: packageName, min: 0, max: 8}), profiles('allow'), 'Inspect listed dependency metadata using trusted project configuration.')),
      rule('manager-execution', ['pnpm', 'pn', 'yarn', 'yarnpkg'], risk([], 'exec', 'dlx', 'create'), review, 'Package execution and initializers run arbitrary code.'),
      rule('pnpm-package-execution', ['pnpx', 'pnx'], {kind: 'any'}, review, 'pnpm package execution aliases can download and run arbitrary code.', {fallback: true}),
      rule('manager-global', ['pnpm', 'pn', 'yarn', 'yarnpkg'], risk([], '-g', '--global', 'global', {regex: '--global=.*'}), privileged, 'Global package operations affect the host installation.'),
      rule('manager-publication', ['pnpm', 'pn', 'yarn', 'yarnpkg'], risk([], 'publish', 'unpublish', 'dist-tag', 'deprecate', 'owner', 'access'), review, 'Publication and access changes affect a remote registry.'),
      rule('yarn-tag-mutation', ['yarn', 'yarnpkg'], {kind: 'prefix', values: ['tag', choice('add', 'remove')]}, review, 'Change registry distribution tags using Yarn Classic.'),
      rule('yarn-npm-tag-mutation', ['yarn', 'yarnpkg'], {kind: 'prefix', values: ['npm', 'tag', choice('add', 'remove')]}, review, 'Change registry distribution tags using modern Yarn.'),
      rule('manager-credentials-config', ['pnpm', 'pn', 'yarn', 'yarnpkg'], risk([], 'login', 'logout', 'adduser', 'token', 'config', 'set', 'profile', 'plugin', 'import', 'policies'), privileged, 'Credential/configuration changes and plugin installation require explicit operator control.'),
      rule('manager-launch-overrides', ['pnpm', 'pn', 'yarn', 'yarnpkg'], risk([], '--registry', '--store-dir', '--modules-dir', '--lockfile-dir', '--use-yarnrc', '--userconfig', {regex: '--(?:registry|store-dir|modules-dir|lockfile-dir|use-yarnrc|userconfig)=.*'}), review, 'Execution configuration overrides require review.'),
      rule('manager-unlisted', ['pnpm', 'pn', 'yarn', 'yarnpkg'], {kind: 'any'}, profiles('ask'), 'Unlisted manager syntax and implicit script commands require review.', {fallback: true, guidance: scriptReview}),
  ];
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/node', version: '0.1.0',
    description: 'Node development with optional npm/pnpm/Yarn selection, local installs and inspection; project scripts require project policy review.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: '>=0.2.0, <0.4.0'},
    capabilities: ['argument-rules-v1', 'fallback-rules-v1', 'location-v1', 'regex-v1', 'structured-rules-v1', 'variables-v1', 'preconditions-v1', 'templates-v1'],
    variables: {package_manager: {type: 'choice', description: 'Package manager agents must use; leave unset to permit any supported manager.',
      values: ['npm', 'pnpm', 'yarn'], setup: {question: 'Require a specific package manager?', unset: 'Any supported package manager'},
      suggest: [{file: 'pnpm-lock.yaml', value: 'pnpm'}, {file: 'yarn.lock', value: 'yarn'}, {file: 'package-lock.json', value: 'npm'}]}},
    preconditions: managerGates(),
    rules: [...rules, ...projectRoutes(rules), ...corepackRules([...rules, ...projectRoutes(rules)]),
      inProject(rule('corepack-install', ['corepack'], {kind: 'exact', values: ['install']}, installs, 'Install the project-configured package manager; this does not install project dependencies.')),
      rule('corepack-host-configuration', ['corepack'], risk([], '-g', '--global', 'enable', 'disable', 'prepare', 'use', 'up', 'hydrate', {regex: '--global=.*'}), privileged, 'Corepack host shims, global setup and manager-selection changes affect tool configuration.'),
      rule('corepack-unlisted', ['corepack'], {kind: 'any'}, review, 'Unlisted Corepack routes, version overrides and options require review.', {fallback: true}),
    ],
  };
}

export async function buildNodePack() {
  const pack = nodePack();
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify({schema_version: 1,
    commands: commandNames.map(name => ({name, rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of.includes(name)).map(rule => rule.id)}))}, null, 2) + '\n');
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', destination));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildNodePack();
