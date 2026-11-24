// Independent decisions. Do not import the policy inventory or evaluator.
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const rows = [];
const shared = [
  ['install'], ['install-deps'], ['uninstall'], ['open'], ['cr'], ['ff'], ['wk'], ['codegen'], ['screenshot'], ['pdf'],
  ['show-trace'], ['run-driver'], ['run-server'], ['launch-server'], ['mcp'], ['mark-docker-image'], ['cli'],
  ['trace', 'open'], ['trace', 'close'], ['trace', 'actions'], ['trace', 'action'], ['trace', 'requests'],
  ['trace', 'request'], ['trace', 'console'], ['trace', 'errors'], ['trace', 'snapshot'], ['trace', 'screenshot'],
  ['trace', 'attachments'], ['trace', 'attachment'], ['trace', 'install-skill'],
];
const testing = [['test'], ['clear-cache'], ['test-server'], ['show-report'], ['merge-reports'],
  ['run-test-mcp-server'], ['init-agents'], ['init-skills']];
for (const name of ['playwright', 'playwright-core']) {
  for (const args of [...shared, ...(name === 'playwright' ? testing : [])]) {
    rows.push([[name, ...args], review]);
    for (const manager of ['yarn', 'yarnpkg', 'pnpm', 'pn']) rows.push([[manager, name, ...args], review]);
    if (!['cli', 'mcp'].includes(args[0])) rows.push([[name, ...args, '--help'], allow],
      [['yarn', name, ...args, '--help'], routine]);
  }
  for (const flag of ['--help', '-h', '--version', '-V']) rows.push([[name, flag], allow], [['yarn', name, flag], routine]);
  for (const args of [
    ['install', '--list'], ['install', '--list', '--no-progress'], ['install', '--dry-run'],
    ['install', '--dry-run', 'chromium', 'firefox'], ['install', 'webkit', '--dry-run'],
    ['install', '--force', '--dry-run', '--only-shell', 'chromium'], ['install', '--list', '--future-display'],
  ]) {
    rows.push([[name, ...args], allow]);
    for (const manager of ['yarn', 'yarnpkg', 'pnpm', 'pn']) rows.push([[manager, name, ...args], routine]);
  }
  for (const args of [
    ['install', 'chromium'], ['install', '--with-deps', '--list'], ['install', '--list', '--with-deps'],
    ['install', '--dry-run', '--with-deps'], ['install', '--list', '--with-deps=false'],
    ['install', '--list=false'], ['install', '--dry-run=false'], ['install', '--list', '--', '--with-deps'],
    ['install-deps', '--dry-run'], ['uninstall', '--all'],
    ['open', 'http://localhost:3000'], ['open', 'https://example.com', '--user-data-dir', 'profiles/qa'],
    ['open', '--load-storage=.env', '--save-storage=auth/state.json', 'https://example.com'],
    ['codegen', '-o', 'tests/generated.spec.ts', 'http://localhost:3000'],
    ['codegen', '--load-storage=/outside/auth.json', '--save-har=artifacts/run.har', 'https://example.com'],
    ['screenshot', 'http://localhost:3000', 'artifacts/page.png'], ['screenshot', 'https://example.com', '/outside/page.png'],
    ['screenshot', '--proxy-server=http://proxy.example.com:8080', '--http-credentials=fixture:fixture', 'https://example.com', 'page.png'],
    ['pdf', 'file:///outside/private.html', 'artifacts/page.pdf'],
    ['show-trace', 'trace.zip'], ['show-trace', 'https://example.com/trace.zip'],
    ['show-trace', '--host=0.0.0.0', '--port=9322', 'trace.zip'], ['show-trace', '--stdin'],
    ['show-trace', '-h', '0.0.0.0', 'trace.zip'], ['run-server', '--host=0.0.0.0', '--unsafe'],
    ['launch-server', '--browser=chromium', '--config=/outside/launch.json'],
    ['mcp', '--user-data-dir=/outside/profile'], ['mcp', '--help'], ['cli', '--help'],
    ['cli', 'open', 'https://example.com'], ['cli', 'eval', 'document.cookie'],
    ['trace', 'open', '/outside/trace.zip'], ['trace', 'snapshot', '1', '--serve'],
    ['trace', 'screenshot', '1', '--output=/outside/page.png'], ['trace', 'attachment', '1', '-o', '/outside/data'],
    ['future-operation'], [], ['--version', 'install'],
  ]) rows.push([[name, ...args], review], [['yarn', name, ...args], review], [['pnpm', name, ...args], review]);
  for (const prefix of ['/bin/', '/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/'])
    rows.push([[prefix + name, '--version'], allow], [[prefix + name, 'screenshot', 'https://example.com', 'page.png'], review]);
  for (const executable of [`/outside/bin/${name}`, `node_modules/.bin/${name}`, `${name}-lookalike`])
    rows.push([[executable, '--version'], review]);
  for (const runner of [['npx'], ['pnpx'], ['pnx'], ['npm', 'exec'], ['pnpm', 'exec'], ['pnpm', 'dlx'],
    ['yarn', 'dlx'], ['corepack', 'yarn']]) rows.push([[...runner, name, 'install', '--list'], review]);
}
for (const args of [
  ['test', '--list'], ['test', '--list', '--reporter=list'], ['test', '--list', '--config=tests/playwright.config.ts'],
  ['test', '--list', '--ui'], ['test', '--list', '--ui-host=0.0.0.0'], ['test', '--list', '--debug'],
  ['test', '--list=false'], ['test', '--list', '--output=/outside/results'],
  ['test', 'tests/smoke.spec.ts', '--project=chromium'], ['test', '--grep=checkout', '--workers=1', '--retries=0'],
  ['test', '--update-snapshots', '--trace=on'], ['test', '--test-list=/outside/tests.txt'],
  ['test', '--tsconfig=/outside/tsconfig.json', '--output=artifacts'],
  ['test', '--list', '--reporter=/outside/custom.js'], ['test', '--run-agents=all'],
  ['show-report', 'playwright-report', '--host=0.0.0.0'], ['show-report', '/outside/report.zip'],
  ['merge-reports', '--reporter=html', 'blob-report'], ['merge-reports', '--config=/outside/report.ts', 'blob-report'],
  ['clear-cache', '--config=tests/playwright.config.ts'], ['test-server', '--host=0.0.0.0'],
  ['run-test-mcp-server', '--port=9324'], ['init-agents', '--loop=codex'], ['init-skills', '--loop=agents'],
]) rows.push([['playwright', ...args], review], [['yarn', 'playwright', ...args], review]);

export const nodePlaywrightCases = rows.flatMap(([argv, decisions], index) =>
  ['loose', 'recommended', 'strict'].map((profile, p) => ({name: `playwright-${index}-${profile}`, profile, argv, expected: decisions[p]})));
for (const profile of ['loose', 'recommended', 'strict']) for (const tool of ['browser_navigate', 'browser_snapshot', 'test_list_tests', 'future_tool'])
  nodePlaywrightCases.push({name: `playwright-mcp-${tool}-${profile}`, profile,
    input: {kind: 'mcp', server: 'playwright', tool, arguments: {url: 'http://localhost:3000'}, original_input: {}}, expected: 'ask'});
for (const manager of ['yarn', 'pnpm']) nodePlaywrightCases.push({
  name: `playwright-manager-selection-${manager}`, profile: 'recommended', variables: {package_manager: 'npm'},
  argv: [manager, 'playwright', 'install', '--list'], expected: 'deny'});
