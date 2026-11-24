// Current tool interfaces and parsing data. Expected decisions live separately
// in node-ecosystem-cases.mjs. Historical Node builders remain immutable.
import {executableForms} from './tool-pack.mjs';

export const version = '0.6.0';
export const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
export const tools = {
  tsc: {source: 'https://www.typescriptlang.org/docs/handbook/compiler-options.html',
    operations: ['compile', '--build', '--init', '--showConfig'],
    reads: ['--project', '-p'], writes: ['--outDir', '--outFile', '--declarationDir', '--tsBuildInfoFile'],
    scalars: ['--target', '-t', '--module', '-m', '--moduleResolution', '--jsx', '--lib', '--types', '--newLine'],
    risks: ['--generateCpuProfile', '--generateTrace', '--typeRoots', '--rootDirs', '--baseUrl', '--rootDir', '--mapRoot', '--sourceRoot', '--watch', '-w']},
  'vue-tsc': {source: 'https://github.com/vuejs/language-tools/tree/master/packages/tsc',
    operations: ['compile', '--build', '--showConfig'],
    reads: ['--project', '-p'], writes: ['--outDir', '--outFile', '--declarationDir', '--tsBuildInfoFile'],
    scalars: ['--target', '-t', '--module', '-m', '--moduleResolution', '--jsx', '--lib', '--types'],
    risks: ['--generateCpuProfile', '--generateTrace', '--typeRoots', '--rootDirs', '--baseUrl', '--rootDir', '--mapRoot', '--sourceRoot', '--watch', '-w']},
  eslint: {source: 'https://eslint.org/docs/latest/use/command-line-interface', operations: ['lint', '--fix', '--print-config', '--init', '--inspect-config'],
    flags: ['--fix', '--cache'],
    reads: ['--config', '-c', '--ignore-path', '--print-config'], writes: ['--output-file', '-o', '--cache-location'],
    scalars: ['--ext', '--rule', '--parser-options', '--env', '--global', '--fix-type', '--max-warnings', '--concurrency'],
    risks: ['--init', '--inspect-config', '--mcp', '--rulesdir', '--resolve-plugins-relative-to', '--parser', '--plugin', '--stdin-filename']},
  biome: {source: 'https://biomejs.dev/reference/cli/', operations: ['check', 'lint', 'format', 'ci', 'init', 'migrate', 'search', 'start', 'stop', 'lsp-proxy', 'rage'],
    prefixes: [['check'], ['lint'], ['format'], ['ci'], ['init'], ['migrate']],
    reads: ['--config-path', '--ignore-path'], writes: ['--log-file', '--reporter-file'],
    scalars: ['--reporter', '--max-diagnostics', '--diagnostic-level', '--indent-style', '--indent-width', '--line-width', '--line-ending', '--quote-style', '--semicolons', '--trailing-commas', '--arrow-parentheses', '--vcs-client-kind', '--vcs-default-branch', '--since'],
    risks: ['--use-server', '--vcs-root', '--stdin-file-path', '--log-path']},
  prettier: {source: 'https://prettier.io/docs/cli', operations: ['format', '--check', '--write', '--list-different', '--find-config-path'],
    reads: ['--config', '--ignore-path', '--find-config-path'], writes: ['--cache-location'],
    scalars: ['--parser', '--tab-width', '--print-width', '--end-of-line', '--trailing-comma', '--quote-props', '--arrow-parens', '--html-whitespace-sensitivity', '--embedded-language-formatting', '--prose-wrap', '--log-level', '--object-wrap', '--experimental-operator-position'],
    risks: ['--plugin', '--plugin-search-dir', '--plugin-search-dirs', '--stdin-filepath']},
  oxlint: {source: 'https://oxc.rs/docs/guide/usage/linter/cli.html', operations: ['lint', '--fix', '--init', '--rules'],
    reads: ['--config', '-c', '--ignore-path', '--tsconfig'], writes: [],
    scalars: ['--format', '-f', '--threads', '--max-warnings', '--allow', '-A', '--warn', '-W', '--deny', '-D', '--disable-plugins', '--enable-plugins'],
    risks: ['--js-plugins', '--type-check', '--type-aware', '--lsp']},
  oxfmt: {source: 'https://oxc.rs/docs/guide/usage/formatter/cli.html', operations: ['format', '--check', '--write', '--init', '--migrate'],
    reads: ['--config', '-c', '--ignore-path'], writes: [], scalars: ['--threads', '--log-level'],
    risks: ['--stdin-filepath', '--migrate', '--lsp']},
  stylelint: {source: 'https://stylelint.io/user-guide/cli/', operations: ['lint', '--fix', '--print-config'],
    flags: ['--cache'],
    reads: ['--config', '-c', '--ignore-path', '--print-config', '--formatter', '-f'], writes: ['--output-file', '-o', '--cache-location'],
    scalars: ['--max-warnings'],
    risks: ['--config-basedir', '--custom-syntax', '--custom-formatter', '--stdin-filename', '--report-descriptionless-disables', '--report-invalid-scope-disables', '--report-needless-disables']},
  knip: {source: 'https://knip.dev/reference/cli', operations: ['analyze', '--fix', '--remove-files', '--init'],
    flags: ['--fix', '--cache'],
    reads: ['--config', '-c', '--tsConfig'], writes: ['--cache-location', '--trace-file'],
    scalars: ['--include', '--exclude', '--workspace', '-W', '--tags', '--max-issues', '--concurrency', '--fix-type'],
    risks: ['--remove-files', '--allow-remove-files', '--directory', '-D', '--preprocessor', '--preprocessor-options', '--reporter', '--reporter-options', '--output-file', '--format', '-F']},
  madge: {source: 'https://github.com/pahen/madge', operations: ['graph', '--circular', '--image', '--dot', '--depends', '--orphans', '--leaves'],
    reads: ['--webpack-config', '--require-config', '--ts-config'], writes: ['--image', '-i'],
    scalars: ['--depends', '-d', '--exclude', '-x', '--extensions', '--layout', '-l', '--rankdir'],
    risks: ['--basedir', '-b']},
  jscpd: {source: 'https://github.com/kucherenko/jscpd', operations: ['scan', 'mcp'],
    reads: ['--config', '-c', '--ignore-path'], writes: ['--output', '-o', '--store-path'],
    scalars: ['--format', '-f', '--min-lines', '--min-tokens', '--max-lines', '--max-size', '--threshold', '-t', '--mode', '-m', '--ignore', '-i'],
    risks: ['--hook', '--reporters-options', '--reporters', '-r', '--redis', '--server', '--store', '--semantic', '--mcp', '--serve', '--pattern', '-p'], riskWords: ['mcp', 'serve']},
  commitlint: {source: 'https://commitlint.js.org/reference/cli.html', operations: ['lint', '--edit', '--from', '--to', '--print-config'],
    reads: ['--config', '-g'], writes: [],
    scalars: ['--from', '-f', '--to', '-t', '--last', '-l', '--help-url', '-H', '--print-config'],
    risks: ['--edit', '-e', '--env', '-E', '--cwd', '-d', '--git-log-args', '--format', '-o', '--extends', '-x', '--parser-preset', '-p']},
  vitest: {source: 'https://vitest.dev/guide/cli.html', operations: ['run', 'watch', 'bench', 'related', 'list', 'init', 'merge-reports'],
    prefixes: [[], ['run'], ['watch'], ['bench'], ['related'], ['list']],
    reads: ['--config', '-c', '--workspace'], writes: ['--outputFile', '--outputJson', '--coverage.reportsDirectory', '--cache.dir'],
    scalars: ['--testNamePattern', '-t', '--project', '--pool', '--maxWorkers', '--minWorkers', '--retry', '--repeat', '--sequence.seed', '--testTimeout', '--hookTimeout', '--shard', '--changed', '--mode'],
    risks: ['--root', '-r', '--dir', '--ui', '--api', '--browser', '--inspect', '--inspect-brk', '--execArgv', '--coverage.customProviderModule', '--coverage.provider', '--mergeReports', '--standalone', '--reporter', '--json', '--diff', '--typecheck', '--poolOptions', '--setupFiles'],
    riskWords: ['init', 'merge-reports']},
  jest: {source: 'https://github.com/jestjs/jest/blob/main/docs/CLI.md', operations: ['test', '--watch', '--listTests', '--updateSnapshot', '--init'],
    // Jest accepts executable JSON in --config and many array-valued file or
    // module selectors. Keep these opaque carriers reviewed rather than
    // pretending a JSON string or an array is a single checked file.
    reads: [], writes: ['--outputFile', '--coverageDirectory', '--cacheDirectory'],
    scalars: ['--testNamePattern', '-t', '--maxWorkers', '-w', '--testTimeout', '--shard', '--seed', '--testEnvironmentOptions'],
    risks: ['--config', '-c', '--rootDir', '--roots', '--runTestsByPath', '--setupFiles', '--setupFilesAfterEnv', '--globalSetup', '--globalTeardown', '--resolver', '--transform', '--testRunner', '--testSequencer', '--testResultsProcessor', '--watchPlugins', '--init', '--findRelatedTests', '--selectProjects', '--ignoreProjects', '--reporters', '--coverageReporters', '--testEnvironment']},
  mocha: {source: 'https://mochajs.org/running/cli/', operations: ['test', '--watch', '--parallel', 'init'],
    reads: ['--config', '--package', '--require', '-r', '--file'], writes: [],
    scalars: ['--grep', '-g', '--fgrep', '-f', '--timeout', '-t', '--slow', '-s', '--retries', '--jobs', '-j', '--extension'],
    risks: ['--node-option', '-n', '--reporter-option', '--reporter-options', '-O', '--watch-files', '--watch-ignore', '--loader', '--inspect', '--inspect-brk', '--reporter', '-R', '--ui', '-u'], riskWords: ['init']},
  ava: {source: 'https://github.com/avajs/ava/blob/main/docs/05-command-line.md', operations: ['test', '--watch', '--update-snapshots', '--reset-cache'],
    reads: ['--config'], writes: [], scalars: ['--match', '-m', '--timeout', '-T', '--concurrency', '-c', '--shard'],
    risks: ['--node-arguments', '--inspect', '--inspect-brk', '--reset-cache', '--environment-variables']},
  karma: {source: 'https://karma-runner.github.io/latest/intro/installation.html', operations: ['start', 'run', 'stop', 'init', 'completion'], review: true},
  c8: {source: 'https://github.com/bcoe/c8', operations: ['exec', 'report', 'check-coverage', 'merge'], review: true},
  nyc: {source: 'https://github.com/istanbuljs/nyc', operations: ['exec', 'report', 'check-coverage', 'merge', 'instrument'], review: true},
  turbo: {source: 'https://turborepo.com/docs/reference/run', operations: ['run', 'watch', 'prune', 'boundaries', 'trace', 'ls', 'query', 'devtools', 'docs', 'generate', 'scan', 'login', 'logout', 'link', 'unlink', 'bin', 'info', 'telemetry'], review: true},
  nx: {source: 'https://nx.dev/docs/reference/nx-commands', operations: ['run', 'run-many', 'affected', 'show', 'graph', 'list', 'report', 'daemon', 'reset', 'generate', 'g', 'migrate', 'release', 'init', 'add', 'import', 'repair', 'sync', 'sync:check', 'watch', 'connect', 'connect-to-nx-cloud', 'record', 'exec', 'format:check', 'format:write'], review: true},
  lerna: {source: 'https://lerna.js.org/docs/api-reference/commands', operations: ['add-caching', 'changed', 'clean', 'create', 'diff', 'exec', 'import', 'info', 'init', 'list', 'ls', 'publish', 'repair', 'run', 'version', 'watch', 'bootstrap', 'add', 'link'], review: true},
};

const protectedPaths = ['.git', '.shield', '.ssh', '.aws', '.codex', '.claude', '.env', '.mcp.json'];
const path = root => ({within: {root}, exclude: protectedPaths.map(path => ({root: 'project', path})),
  // The argv path checker does not expand tool-owned globs or compound paths.
  match: {regex: '[^*?\\[\\]{}!,\\r\\n]+'}});
const escape = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const spellings = names => [...new Set(names.flatMap(name => [name, name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())]))];
const optionSelector = (names, insensitive) => ({regex: `(?${insensitive ? 'is' : 's'}:^(?:${spellings(names).map(name => escape(name) + (name.startsWith('--') ? '(?:[=.].*)?' : '.*')).join('|')})$)`});
// TypeScript lowercases option names. Noncanonical spellings must not skip the
// explicit file checker. Review case variants, while canonical syntax keeps
// the checked-path permission. Each alternative's first differing letter
// excludes the canonical spelling without lookaround or parser exceptions.
const otherCase = names => ({regex: `^(?:${names.flatMap(name => [...name].flatMap((letter, index) => {
  if (!/[A-Za-z]/.test(letter)) return [];
  const opposite = letter === letter.toLowerCase() ? letter.toUpperCase() : letter.toLowerCase();
  return [escape(name.slice(0, index) + opposite) + '(?i:' + escape(name.slice(index + 1)) + ')'];
})).join('|')})(?:=.*)?$`});
export const forms = name => [...executableForms(name), `/bin/${name}`];
const managers = ['yarn', 'yarnpkg', 'pnpm', 'pn'];

export function ecosystemRules() {
  const rules = [];
  for (const [name, tool] of Object.entries(tools)) for (const manager of [null, 'manager']) {
    const typescript = ['tsc', 'vue-tsc'].includes(name);
    const base = manager ? [name] : [];
    const id = `ecosystem-${manager ?? 'direct'}-${name}`;
    const executable = {one_of: manager ? managers.flatMap(forms) : forms(name)};
    const add = (suffix, arguments_, decision, extra = {}) => rules.push({id: `${id}-${suffix}`,
      conditions: {domain: 'argv', executable, arguments: arguments_}, decision,
      reason: 'Review unestablished files, execution hooks, servers, acquisition, hosted services or task effects.', ...extra});
    // A non-fallback wrapper guard prevents old manager shorthand permissions
    // from granting new tool syntax when its more specific checked rule fails.
    // Keep direct review non-fallback too: Baseline's broad project-tools
    // allowance must not suppress malformed/path-unestablished requests.
    add('review', base.length ? {kind: 'prefix', values: base} : {kind: 'any'}, 'ask');
    for (const flag of ['--help', '-h', '--version']) add(`metadata-${flag.replaceAll('-', '')}`,
      {kind: 'exact', values: [...base, flag]}, manager ? routine : 'allow',
      {reason: 'Print metadata using a trusted installed tool; manager startup still loads project configuration.'});
    if (tool.review) continue;
    const dottedFiles = [...tool.reads, ...tool.writes].filter(name => name.includes('.'));
    const risks = [...new Set([...tool.risks, ...dottedFiles, '--cwd', '--root', '--prefix', '-C', '--eval', '--require', '--loader', '--import', '--node-options', '--node-arg', '--node-args', '--format', '-f'])]
      // Mocha's explicit local setup file is checked below as a read path.
      .filter(name => !tool.reads.includes(name) && !tool.scalars.includes(name));
    add('effects', {kind: 'risk_tokens', prefix: base,
      any_of: [optionSelector(risks, typescript), {prefix: '@'}, {exact: '-'}, {regex: '^-[A-Za-z0-9]=.*$'},
        {regex: '^--output(?:File|-file)\\..*'},
        ...(typescript ? [{regex: '^-[A-Za-z][A-Za-z].*'}, otherCase([...tool.reads, ...tool.writes])] : []),
        ...(tool.riskWords ?? []).map(exact => ({exact}))]}, 'ask');
    for (const [index, prefix] of (tool.prefixes ?? [[]]).entries()) {
      const names = spellings([...tool.reads, ...tool.writes, ...tool.scalars]).filter(name => !name.includes('.'));
      const grammar = {kind: 'options', prefix: [...base, ...prefix], flags: tool.flags ?? [], values: names,
        operands: true, unknown_options: 'skip'};
      const selection = {grammar,
        options: Object.fromEntries([...spellings(tool.reads).filter(name => !name.includes('.')).map(name => [name, {path: path('read')}]),
          ...spellings(tool.writes).filter(name => !name.includes('.')).map(name => [name, {path: path('write'), recursive: true}])]),
        operands: {path: path('write'), recursive: true}};
      add(`project-${index}`, grammar, routine, {
        // Project code and configuration are trusted at this profile. These
        // checks constrain explicit argv paths, not arbitrary code execution.
        conditions: {domain: 'argv', executable, cwd: {within: {root: 'write'},
          exclude: protectedPaths.map(path => ({root: 'project', path}))}, arguments: grammar},
        requirements: {cwd: {within: {root: 'project'}}, argument_paths: selection},
        on_unmet: {decision: 'ask', message: 'Use literal approved project paths; review protected/outside files, glob patterns and malformed values.'},
        reason: 'Run a trusted local project check, test or edit with checked explicit source, configuration, cache and output paths. Strict reviews project execution.',
      });
    }
  }
  return rules;
}
