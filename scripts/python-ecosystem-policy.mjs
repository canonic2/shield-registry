import {executableForms} from './tool-pack.mjs';

// Reviewed CLI families. Keeping the operation inventory beside its effect
// classification makes intentional review coverage distinct from unknown syntax.
// Expected decisions are maintained independently in python-ecosystem-cases.mjs.
export const ecosystem = {
  hatch: {source: 'https://hatch.pypa.io/latest/cli/reference/',
    operations: ['build', 'check code', 'check fmt', 'check types', 'clean', 'config explore', 'config find',
      'config restore', 'config set', 'config show', 'config update', 'dep hash', 'dep lock', 'dep show requirements',
      'dep show sources', 'dep show table', 'dep sync', 'env create', 'env find', 'env lock', 'env prune',
      'env remove', 'env run', 'env show', 'fmt', 'lock', 'new', 'project metadata', 'publish',
      'python find', 'python install', 'python remove', 'python show', 'python update', 'run',
      'self report', 'self restore', 'self update', 'shell', 'status', 'test', 'version'],
    reason: 'Review Hatch project/environment plugins, metadata and build hooks, configured scripts, dependency/toolchain acquisition, secrets, publication and removal.'},
  black: {source: 'https://black.readthedocs.io/en/stable/usage_and_configuration/the_basics.html', operations: [],
    reason: 'Review Black source/configuration/cache paths, stdin, inline inputs or an invocation whose file effects cannot be established.'},
  ty: {source: 'https://docs.astral.sh/ty/reference/cli/',
    operations: ['check', 'server', 'version', 'generate-shell-completion', 'explain rule', 'explain help', 'help'],
    reason: 'Review ty configuration and source paths, fixes/baselines, watchers and language servers; current ty can invoke uv metadata and synchronize standalone-script dependencies.'},
  watchfiles: {source: 'https://watchfiles.helpmanual.io/cli/', operations: [],
    reason: 'watchfiles imports and restarts Python callables or executes commands; custom filters can import Python code and watchers persist.'},
  'pre-commit': {source: 'https://pre-commit.com/#command-line-interface',
    operations: ['autoupdate', 'clean', 'gc', 'hazmat cd', 'hazmat ignore-exit-code', 'hazmat n1', 'init-templatedir',
      'install', 'install-hooks', 'migrate-config', 'run', 'sample-config', 'try-repo', 'uninstall',
      'validate-config', 'validate-manifest', 'hook-impl'],
    reason: 'Review hook/environment installation, downloaded toolchains, configured command execution, Git hook changes, configuration migration and cache removal.'},
  uv: {
    source: 'https://docs.astral.sh/uv/reference/cli/',
    operations: ['run', 'init', 'add', 'remove', 'version', 'sync', 'lock', 'export', 'tree', 'format', 'check', 'audit',
      'build', 'publish', 'venv', 'pip install', 'pip uninstall', 'pip sync', 'pip compile', 'pip list', 'pip show',
      'pip freeze', 'pip check', 'pip tree', 'tool run', 'tool install', 'tool upgrade', 'tool list', 'tool audit',
      'tool uninstall', 'tool update-shell', 'tool dir', 'python list', 'python install', 'python upgrade',
      'python find', 'python pin', 'python dir', 'python uninstall', 'python update-shell',
      'cache clean', 'cache prune', 'cache dir', 'auth login', 'auth logout', 'auth token', 'auth dir',
      'self update', 'generate-shell-completion'],
    reason: 'Review dependency resolution and executable build backends, environment and toolchain changes, delegated commands, credentials or publication.',
  },
  uvx: {source: 'https://docs.astral.sh/uv/guides/tools/', operations: [],
    reason: 'uvx delegates to uv tool run and can acquire and execute a package, including when the child asks for its version.'},
  pipx: {source: 'https://pipx.pypa.io/stable/reference/cli.html',
    operations: ['install', 'install-all', 'uninstall', 'uninstall-all', 'inject', 'uninject', 'expose', 'unexpose',
      'pin', 'unpin', 'upgrade', 'upgrade-all', 'upgrade-shared', 'reinstall', 'reinstall-all', 'reset', 'health',
      'repair', 'list', 'interpreter', 'cache', 'manifest', 'run', 'exec', 'runpip', 'ensurepath', 'environment', 'completions'],
    reason: 'Review package execution, interpreter discovery, environment changes, package acquisition and shell startup changes.'},
  poetry: {source: 'https://python-poetry.org/docs/cli/',
    operations: ['about', 'add', 'build', 'check', 'config', 'debug info', 'debug resolve', 'debug tags', 'env activate',
      'env info', 'env list', 'env remove', 'env use', 'export', 'init', 'install', 'list', 'lock', 'new', 'publish',
      'python install', 'python list', 'python remove', 'remove', 'run', 'search', 'self add', 'self install',
      'self lock', 'self remove', 'self show', 'self sync', 'self update', 'shell', 'show', 'source add',
      'source remove', 'source show', 'sync', 'update', 'version', 'cache clear', 'cache list'],
    reason: 'Poetry can load installed and project-required plugins; review project commands, dependency and environment changes, configuration and publication.'},
  pipenv: {source: 'https://pipenv.pypa.io/en/latest/cli.html',
    operations: ['install', 'uninstall', 'lock', 'sync', 'clean', 'check', 'scan', 'graph', 'open', 'requirements',
      'run', 'scripts', 'shell', 'update', 'upgrade', 'verify', 'remove'],
    reason: 'Review Pipfile scripts, dotenv/configuration, dependency resolution, environment changes, shell execution and security-service access.'},
  virtualenv: {source: 'https://virtualenv.pypa.io/en/stable/reference/cli.html', operations: [],
    reason: 'Review interpreter discovery, creator/seeder plugins, environment destinations, app-data writes and seed-package downloads.'},
  ruff: {source: 'https://docs.astral.sh/ruff/configuration/',
    operations: ['check', 'format', 'rule', 'config', 'linter', 'version', 'analyze graph', 'clean', 'server', 'generate-shell-completion'],
    reason: 'Review unclassified Ruff modes, configuration overrides, argument files, cache removal or the persistent language server.'},
  pyright: {source: 'https://github.com/microsoft/pyright/blob/main/docs/command-line.md', operations: [],
    reason: 'Review source/configuration paths, Python interpreter execution for import discovery, stub generation and watch processes.'},
  basedpyright: {source: 'https://docs.basedpyright.com/latest/configuration/command-line/', operations: [],
    reason: 'Review interpreter discovery, source/configuration access, baseline/report writes, stub generation and watch processes.'},
  mypy: {source: 'https://mypy.readthedocs.io/en/stable/command_line.html', operations: [],
    reason: 'mypy can import configured plugins, inspect interpreters, install stubs and write caches/reports; review the invocation.'},
  dmypy: {source: 'https://mypy.readthedocs.io/en/stable/mypy_daemon.html',
    operations: ['start', 'restart', 'status', 'stop', 'kill', 'check', 'run', 'recheck', 'suggest', 'inspect', 'hang'],
    reason: 'Review the mypy daemon, its status socket, configured plugins, process control and generated files.'},
  tox: {source: 'https://tox.wiki/en/latest/reference/cli.html',
    operations: ['run', 'r', 'run-parallel', 'p', 'depends', 'de', 'list', 'l', 'devenv', 'd', 'schema', 'config', 'c',
      'quickstart', 'q', 'exec', 'e', 'legacy', 'le', 'man'],
    reason: 'tox loads plugins and can provision environments and execute commands; listing or showing configuration is not an execution boundary.'},
  nox: {source: 'https://nox.thea.codes/en/stable/usage.html', operations: [],
    reason: 'Nox imports its Python noxfile even to list sessions; review sessions, dependencies, backends and delegated arguments.'},
  coverage: {source: 'https://coverage.readthedocs.io/en/latest/commands/index.html',
    operations: ['run', 'combine', 'erase', 'report', 'html', 'xml', 'json', 'lcov', 'annotate', 'debug'],
    reason: 'Review measured code, configured plugins and file tracers, coverage data, report output and data deletion.'},
  bandit: {source: 'https://bandit.readthedocs.io/en/latest/man/bandit.html', operations: [],
    reason: 'Review scanner/formatter plugins, configuration, recursive source reads, baseline files and report destinations.'},
  'pip-audit': {source: 'https://github.com/pypa/pip-audit', operations: [],
    reason: 'Auditing can resolve dependencies through pip, execute build backends, send package metadata to services and modify packages with --fix.'},
};

export const ecosystemAliases = {coverage3: 'coverage', 'pyright-langserver': 'pyright', 'basedpyright-langserver': 'basedpyright'};
export const ecosystemCommands = [...Object.keys(ecosystem), ...Object.keys(ecosystemAliases)];
// Authenticated discovery hints are capped at 16; this does not limit rules or
// the complete commands.json inventory. Alternatives remain searchable by ID.
export const discoveryCommands = ['python', 'pip', 'pytest', 'uv', 'pipx', 'poetry', 'pipenv', 'virtualenv',
  'ruff', 'pyright', 'mypy', 'tox', 'nox', 'coverage', 'bandit', 'pip-audit'];

const execution = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const uvMetadata = ['cache dir', 'tool dir', 'tool list', 'auth dir', 'python dir'];
const protectedPaths = ['.git', '.shield', '.ssh', '.aws', '.codex', '.claude', '.env', '.mcp.json'];
const checkedPath = root => ({path: {within: {root}, exclude: protectedPaths.map(path => ({root: 'project', path}))}});
const config = {name: '--config', match: {not: {regex: '(?s:.*=.*)'}}, repeat: 'all'};
const ruffGlobals = {flags: ['-q', '--quiet', '-v', '--verbose', '-s', '--silent', '--isolated'],
  values: [config, '--color']};
// Parsing data, separate from decisions: all other switches are skipped and
// cannot hide a following token, which remains a checked file operand.
const ruffValues = ['--color', '--output-format', '-o', '--output-file', '--target-version', '--extension', '--select', '--ignore',
  '--extend-select', '--extend-ignore', '--per-file-ignores', '--extend-per-file-ignores', '--exclude', '--extend-exclude',
  '--line-length', '--cache-dir', '--stdin-filename', '--range', config];

export function ecosystemRules() {
  const rules = [];
  const add = (id, name, arguments_, decision, reason, extra = {}) => {
    const rule = {id, conditions: {domain: 'argv', executable: {one_of: executableForms(name)}, arguments: arguments_},
      decision, reason, ...extra};
    rules.push(rule);
    return rule;
  };
  for (const name of ecosystemCommands) {
    const canonical = ecosystemAliases[name] ?? name;
    const tool = ecosystem[canonical];
    // Language-server binaries and uvx are execution entry points, not CLI
    // aliases whose version/help behavior we can inherit from another program.
    if (!name.endsWith('-langserver') && name !== 'uvx' && !['tox', 'nox', 'virtualenv', 'bandit'].includes(name)) {
      for (const flag of ['--version', '--help', '-h'])
        add(`${name}-flag-${flag.replaceAll('-', '')}`, name, {kind: 'exact', values: [flag]}, 'allow',
          'Print the trusted installation’s built-in version or help without running a project operation.');
    }
    for (const operation of name.endsWith('-langserver') ? [] : tool.operations) {
      const builtin = name === 'ty' && ['version', 'explain rule', 'explain help', 'help', 'generate-shell-completion'].includes(operation) ||
        name === 'pre-commit' && operation === 'sample-config';
      add(`${name}-${operation.replaceAll(' ', '-')}`, name, {kind: 'prefix', values: operation.split(' ')},
        builtin ? 'allow' : name === 'ruff' || name === 'uv' && uvMetadata.includes(operation) ||
        name === 'pre-commit' && ['validate-config', 'validate-manifest'].includes(operation) ? 'ask' : execution,
        builtin ? 'Print built-in information without executing a project or installing environments.' : tool.reason);
      // Rust uv/ruff help exits before running a command. Python-based tools
      // can load plugins while constructing help, so retain their review.
      if (name === 'uv' || name === 'ruff')
        for (const flag of ['--help', '-h']) add(`${name}-${operation.replaceAll(' ', '-')}-${flag.replaceAll('-', '')}`,
          name, {kind: 'exact', values: [...operation.split(' '), flag]}, 'allow', 'Print built-in command help.');
    }
    // Baseline has broad project-tool allowances for these names. Their review
    // boundaries must remain regular restrictions when both packs are selected.
    add(`${name}-unclassified`, name, {kind: 'any'}, ['ruff', 'black'].includes(name) ? 'ask' : execution,
      tool.reason, ['ruff', 'black', 'mypy'].includes(name) ? {} : {fallback: true});
  }

  // Value arities come from Black's CLI, not a list of options we permit.
  // Files may be rewritten even when a caller intended only a check.
  const blackGrammar = {kind: 'options', prefix: [], flags: ['-q', '-v', '-S', '-C', '-x', '-h', '--fast'],
    values: ['-c', '--code', '-l', '--line-length', '-t', '--target-version', '--python-cell-magics',
      '--enable-unstable-feature', '--line-ranges', '--required-version', '--exclude', '--extend-exclude',
      '--force-exclude', '--stdin-filename', '--include', '-W', '--workers', '--config', '--cache-dir'],
    forbid: ['-c', '--code', '--fast'], operands: true, unknown_options: 'skip'};
  const black = add('black-format-paths', 'black', blackGrammar, routine,
    'Check or format Python files with explicit sources, configuration, cache and stdin filenames checked.',
    {requirements: {argument_paths: {grammar: blackGrammar, operands: {...checkedPath('write'), recursive: true}, options: {
      '--config': checkedPath('read'), '--cache-dir': checkedPath('write'), '--stdin-filename': checkedPath('write'),
    }}}, on_unmet: {decision: 'ask', message: 'Review source/config/cache paths outside approved roots or protected state.'}});
  black.conditions.cwd = {within: {root: 'write'}, exclude: protectedPaths.map(path => ({root: 'project', path}))};
  add('black-review-inputs', 'black', {kind: 'risk_tokens', prefix: [], any_of: [
    {prefix: '@'}, {regex: '^--fast(?:=.*)?$'}, {regex: '^--code(?:=.*)?$'},
    {regex: '^-c.*$'},
  ]}, 'ask', 'Review inline formatting input, argument-file-like operands or disabling the formatter AST safety check.');

  for (const operation of ['validate-config', 'validate-manifest']) {
    const grammar = {kind: 'options', prefix: [operation], flags: [], values: ['--color'],
      operands: true, unknown_options: 'skip'};
    const row = add(`pre-commit-${operation}-paths`, 'pre-commit', grammar, routine,
      'Validate YAML structure without installing environments or executing hooks, with checked explicit file paths.',
      {requirements: {argument_paths: {grammar, operands: checkedPath('read')}},
        on_unmet: {decision: 'ask', message: 'Review validation files outside readable roots or in protected state.'}});
    row.conditions.cwd = {within: {root: 'read'}, exclude: protectedPaths.map(path => ({root: 'project', path}))};
  }
  add('pre-commit-version-short', 'pre-commit', {kind: 'exact', values: ['-V']}, 'allow', 'Print the trusted installed pre-commit version.');
  for (const operation of ecosystem.ty.operations)
    for (const flag of ['--help', '-h'])
      add(`ty-${operation.replaceAll(' ', '-')}-${flag.replaceAll('-', '')}`, 'ty',
        {kind: 'exact', values: [...operation.split(' '), flag]}, 'allow', 'Print built-in ty command help without project discovery.');

  for (const operation of ['check', 'format']) {
    const grammar = {kind: 'options', prefix: [operation], leading: ruffGlobals, flags: ['-n', '-e', '-w', '-h'], values: ruffValues,
      operands: true, unknown_options: 'skip'};
    const row = add(`ruff-${operation}-paths`, 'ruff', grammar, routine,
      'Check, fix or format project Python files, with explicit source, cache, configuration and output paths checked.',
      {requirements: {argument_paths: {grammar, operands: {...checkedPath('write'), recursive: true}, options: {
        '--config': checkedPath('read'), '--cache-dir': checkedPath('write'), '--stdin-filename': checkedPath('write'),
        '-o': checkedPath('write'), '--output-file': checkedPath('write'),
      }}}, on_unmet: {decision: 'ask', message: 'Review paths outside approved roots, protected state, stdin or an argument list whose paths cannot be established.'}});
    row.conditions.cwd = {within: {root: 'write'}, exclude: protectedPaths.map(path => ({root: 'project', path}))};
  }
  for (const operation of ['rule', 'config', 'linter', 'version']) {
    // These commands describe the installed tool, not project files. Explicit
    // global config overrides still require review instead of arbitrary reads.
    add(`ruff-${operation}-inspect`, 'ruff', {kind: 'options', prefix: [operation], leading: {flags: ruffGlobals.flags, values: ['--color']},
      flags: [], values: ['--output-format', '--color', '--config'], forbid: ['--config'], operands: true, unknown_options: 'skip'},
      'allow', 'Describe built-in rules, settings, linters or the installed Ruff version.');
  }
  for (const tokens of [[{prefix: '@'}], [{regex: '^--unsafe-fixes(?:=.*)?$'}]])
    add(`ruff-review-${rules.length}`, 'ruff', {kind: 'risk_tokens', prefix: [], any_of: tokens}, 'ask',
      'Review expanded argument files and fixes that may change program behavior.');
  for (const operation of ['clean', 'server'])
    add(`ruff-${operation}-effect`, 'ruff', {kind: 'prefix', values: [operation]}, execution,
      'Review recursive cache removal or a persistent language-server process.');

  for (const operation of uvMetadata) {
    const grammar = {kind: 'options', prefix: operation.split(' '), flags: [],
      leading: {flags: ['-q', '--quiet', '-v', '--verbose', '--offline', '--no-config'], values: ['--color']},
      values: ['--color', '--cache-dir', '--config-file', '--directory', '--project'],
      operands: true, unknown_options: 'skip', forbid: ['--directory', '--project']};
    const row = add(`uv-${operation.replaceAll(' ', '-')}-inspect`, 'uv', grammar, 'allow',
      'Read installed tool metadata or print a configured directory without running or installing a tool.',
      {requirements: {argument_paths: {grammar, operands: checkedPath('read'), options: {
        '--cache-dir': checkedPath('read'), '--config-file': checkedPath('read'),
      }}}, on_unmet: {decision: 'ask', message: 'Review explicit configuration paths or a different project/directory selection.'}});
    row.conditions.cwd = {within: {root: 'read'}};
  }
  return rules;
}
