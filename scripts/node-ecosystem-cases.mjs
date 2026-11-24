// Independent expected results: never import the policy or evaluator output.
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const rows = [];
rows.push([['pnpx', 'tsc', '--noEmit'], review], [['pnx', 'tsc', '--noEmit'], review]);
const checks = [
  ['tsc', '--noEmit'], ['vue-tsc', '--noEmit'], ['eslint', 'src'], ['biome', 'check', 'src'],
  ['prettier', '--check', 'src'], ['oxlint', 'src'], ['oxfmt', '--check', 'src'], ['stylelint', 'src/app.css'],
  ['knip'], ['madge', 'src'], ['jscpd', 'src'], ['commitlint', '--from', 'HEAD~1', '--to', 'HEAD'],
  ['vitest', 'run', 'tests/unit'], ['jest', 'tests/unit'], ['mocha', 'tests/unit'], ['ava', 'tests/unit'],
];
for (const argv of checks) {
  rows.push([argv, routine], [[...argv, '--future-display'], routine]);
  for (const manager of ['yarn', 'yarnpkg', 'pnpm', 'pn']) rows.push([[manager, ...argv], routine]);
  rows.push([[`/usr/local/bin/${argv[0]}`, ...argv.slice(1)], routine]);
}
const names = ['tsc', 'vue-tsc', 'eslint', 'biome', 'prettier', 'oxlint', 'oxfmt', 'stylelint', 'knip', 'madge',
  'jscpd', 'commitlint', 'vitest', 'jest', 'mocha', 'ava', 'karma', 'c8', 'nyc', 'turbo', 'nx', 'lerna'];
for (const name of names) {
  for (const flag of ['--help', '-h', '--version']) {
    rows.push([[name, flag], allow], [['yarn', name, flag], routine]);
  }
  rows.push([['npx', name, '--help'], review], [['pnpm', 'exec', name, '--version'], review],
    [['yarn', 'dlx', name, '--help'], review], [['corepack', 'yarn', name, '--version'], review]);
}
const files = [
  ['tsc', '--project'], ['tsc', '--outDir'], ['tsc', '--outFile'], ['tsc', '--declarationDir'], ['tsc', '--tsBuildInfoFile'],
  ['vue-tsc', '-p'], ['vue-tsc', '--outDir'], ['eslint', '--config'], ['eslint', '-c'], ['eslint', '--output-file'],
  ['eslint', '-o'], ['eslint', '--cache-location'], ['eslint', '--ignore-path'], ['eslint', '--print-config'],
  ['biome', 'check', '--config-path'], ['biome', 'check', '--log-file'], ['biome', 'check', '--reporter-file'], ['prettier', '--config'],
  ['prettier', '--ignore-path'], ['prettier', '--cache-location'], ['oxlint', '--config'], ['oxlint', '--tsconfig'],
  ['oxfmt', '-c'], ['oxfmt', '--ignore-path'], ['stylelint', '--config'], ['stylelint', '--output-file'],
  ['stylelint', '--cache-location'], ['knip', '--config'], ['knip', '--tsConfig'], ['knip', '--cache-location'], ['knip', '--trace-file'],
  ['madge', '--webpack-config'], ['madge', '--require-config'], ['madge', '--ts-config'], ['madge', '--image'],
  ['jscpd', '--output'], ['jscpd', '--config'], ['jscpd', '--store-path'], ['commitlint', '--config'],
  ['vitest', 'run', '--config'], ['vitest', 'run', '--outputFile'], ['vitest', 'bench', '--outputJson'],
  ['jest', '--outputFile'], ['jest', '--coverageDirectory'], ['jest', '--cacheDirectory'],
  ['mocha', '--require'], ['mocha', '--file'], ['mocha', '--config'], ['ava', '--config'],
];
for (const prefix of files) {
  const flag = prefix.at(-1), before = prefix.slice(0, -1);
  rows.push([[...prefix, 'src/fixture'], routine], [[...before, `${flag}=src/fixture`], flag.startsWith('--') ? routine : review],
    [[...prefix, '/outside/fixture'], review], [[...before, `${flag}=/outside/fixture`], review],
    [[...prefix, '.shield/policy.yml'], review], [[...prefix, 'src/*'], review], [[...prefix], review],
    [[...prefix, 'src/fixture', flag, '/outside/repeated'], review],
    [['yarn', ...prefix, '/outside/fixture'], review]);
}
for (const argv of [
  ['eslint', 'src', '/outside/test.js'], ['prettier', '--write', 'src/*'], ['eslint', '.'],
  ['tsc', '@/outside/args'], ['tsc', '-outDir', '/outside'], ['tsc', '--typeRoots=src,/outside'],
  ['eslint', '--init'], ['eslint', '--inspect-config'], ['eslint', '--plugin', '/outside/plugin'],
  ['biome', 'start'], ['biome', 'lsp-proxy'], ['biome', 'search', 'pattern'],
  ['prettier', '--plugin=/outside/plugin'], ['prettier', '--stdin-filepath', '/outside/a.js'],
  ['oxlint', '--type-check', 'src'], ['oxfmt', '--migrate', 'prettier'], ['stylelint', '--custom-syntax', '/outside/module'],
  ['knip', '--remove-files'], ['knip', '--reporter', '/outside/reporter'], ['madge', '--basedir', '/outside'],
  ['knip', '--allow-remove-files', '--fix'], ['knip', '--output-file=json=/outside/report'], ['knip', '-D/outside'],
  ['oxlint', '--lsp'], ['oxfmt', '--lsp'],
  ['jscpd', 'mcp'], ['jscpd', '--reporters', '/outside/module'],
  ['jscpd', '--store', 'redis'], ['jscpd', '--semantic', 'src'], ['jscpd', '--pattern=../../*'],
  ['commitlint', '--edit'], ['commitlint', '--edit=/outside/message'], ['commitlint', '--env', 'MESSAGE_FILE'],
  ['commitlint', '--git-log-args', '--output=/outside/report'],
  ['vitest', '--ui'], ['vitest', 'run', '--browser.enabled'], ['vitest', '--api.port=51204'],
  ['vitest', 'init', 'browser'], ['vitest', 'merge-reports'], ['vitest', '--execArgv=--eval=process.exit()'],
  ['vitest', '--coverage.reportsDirectory=coverage'], ['vitest', '--coverage.reportsDirectory', '/outside/report'],
  ['vitest', '--cache.dir', 'cache'], ['commitlint', '-e/outside/message'],
  ['vitest', 'list', '--json=/outside/tests.json'], ['vitest', '--poolOptions.threads.execArgv=--import=/outside/hook'],
  ['vitest', '--outputFile.json=/outside/report'], ['vitest', '--output-file.junit=/outside/report'],
  ['tsc', '--OUTDIR=/outside'], ['tsc', '--outdir=/outside'], ['tsc', '--OutDir=dist'],
  ['tsc', '--generatecpuprofile=/outside/profile'], ['vue-tsc', '--PROJECT=/outside/tsconfig.json'],
  ['jest', '--config', '{"rootDir":"/outside"}'], ['jest', '--roots', 'src', '/outside'],
  ['jest', '--setupFilesAfterEnv=/outside/setup'], ['mocha', '--node-option', 'import=/outside/hook'],
  ['mocha', '--reporter-option', 'output=/outside/report'], ['ava', '--node-arguments=--import=/outside/hook'],
  ['ava', '--reset-cache'], ['eslint', '--cwd', '/outside', 'src'], ['tsc', '--watch'],
]) {
  rows.push([argv, review], [['yarn', ...argv], review], [['pnpm', ...argv], review]);
}
for (const argv of [
  ['karma', 'start', 'karma.conf.js'], ['karma', 'run'], ['karma', 'stop'], ['karma', 'init'],
  ['c8', 'node', '--version'], ['c8', 'report'], ['c8', 'check-coverage'], ['c8', 'merge', 'coverage', 'out.json'],
  ['nyc', 'node', '--help'], ['nyc', 'report'], ['nyc', 'check-coverage'], ['nyc', 'merge', 'coverage', 'out.json'], ['nyc', 'instrument', 'src', 'out'],
  ['turbo', 'run', 'build'], ['turbo', 'run', 'build', '--cache=local:rw'], ['turbo', 'run', 'build', '--dry=json'],
  ['turbo', 'watch', 'build'], ['turbo', 'prune'], ['turbo', 'login'], ['turbo', 'logout'], ['turbo', 'link'],
  ['turbo', 'unlink'], ['turbo', 'ls'], ['turbo', 'query'], ['turbo', 'telemetry', 'disable'],
  ['nx', 'run', 'app:build'], ['nx', 'run-many', '-t', 'test', '--skipRemoteCache'], ['nx', 'affected', '-t', 'lint'],
  ['nx', 'show', 'projects'], ['nx', 'graph', '--file=/outside/graph.json'], ['nx', 'daemon', '--stop'],
  ['nx', 'reset'], ['nx', 'migrate', 'latest'], ['nx', 'release'], ['nx', 'connect'], ['nx', 'exec', 'node', '--help'],
  ['lerna', 'run', 'test'], ['lerna', 'run', 'build', '--skip-nx-cache'], ['lerna', 'list'], ['lerna', 'changed'],
  ['lerna', 'exec', 'node', '--version'], ['lerna', 'publish'], ['lerna', 'version'], ['lerna', 'clean'],
  ['lerna', 'bootstrap'], ['lerna', 'watch'], ['turbo', 'future-command'], ['nx', 'future-command'],
]) rows.push([argv, review], [['yarn', ...argv], review]);
for (const argv of [
  ['eslint', '--fix', 'src'], ['prettier', '--write', 'src'], ['biome', 'check', '--write', 'src'],
  ['oxlint', '--fix', 'src'], ['oxfmt', '--write', 'src'], ['stylelint', '--fix', 'src/app.css'], ['knip', '--fix'],
  ['vitest', 'watch', 'tests/unit'], ['jest', '--updateSnapshot', 'tests/unit'], ['ava', '--update-snapshots', 'tests/unit'],
  ['mocha', '--require', 'tests/setup.js', 'tests/unit'], ['tsc', '--outDir=dist', '--project=src/tsconfig.json'],
  ['eslint', '-csrc/eslint.config.js', 'src'], ['eslint', '-osrc/report.json', 'src'],
  ['eslint', '--cache', 'src'], ['knip', '--cache'], ['stylelint', '--cache', 'src/app.css'],
  ['vitest', '--output-file=reports/results.json', 'tests/unit'], ['jest', '--coverage-directory=coverage', 'tests/unit'],
]) rows.push([argv, routine]);
for (const argv of [['eslint', '-o/outside/report', 'src'], ['eslint', '-qo/outside/report', 'src'],
  ['stylelint', '-qo/outside/report', 'src/app.css'], ['eslint', '--config', 'src/eslint.config.js', '--config', '.git/config']])
  rows.push([argv, review], [['yarn', ...argv], review]);
for (const argv of [['vitest', '--output-file=/outside/report'], ['jest', '--coverage-directory=/outside/coverage'],
  ['vitest', '--exec-argv=--import=/outside/hook']]) rows.push([argv, review]);

export const nodeEcosystemCases = rows.flatMap(([argv, decisions], index) =>
  ['loose', 'recommended', 'strict'].map((profile, p) => ({name: `ecosystem-${index}-${profile}`,
    profile, argv, expected: decisions[p]})));
for (const manager of ['yarn', 'pnpm']) nodeEcosystemCases.push({
  name: `ecosystem-manager-selection-${manager}`, profile: 'recommended', variables: {package_manager: 'npm'},
  argv: [manager, 'eslint', 'src'], expected: 'deny',
});
for (const profile of ['loose', 'recommended', 'strict']) {
  nodeEcosystemCases.push({name: `ecosystem-mcp-${profile}`, profile,
    input: {kind: 'mcp', server: 'node', tool: 'eslint', arguments: {}, original_input: {}}, expected: 'ask'});
  for (const executable of ['eslint-lookalike', '/outside/bin/eslint', 'node_modules/.bin/eslint'])
    nodeEcosystemCases.push({name: `ecosystem-executable-${executable.replaceAll('/', '-')}-${profile}`, profile,
      argv: [executable, 'src'], expected: 'ask'});
}
