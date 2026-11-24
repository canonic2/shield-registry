import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const tools = {
  go: {source: 'https://pkg.go.dev/cmd/go',
    operations: ['bug', 'build', 'clean', 'doc', 'env', 'fix', 'fmt', 'generate', 'get', 'help', 'install', 'list',
      'mod download', 'mod edit', 'mod graph', 'mod init', 'mod tidy', 'mod vendor', 'mod verify', 'mod why',
      'run', 'telemetry', 'test', 'tool', 'tool cover', 'tool covdata', 'tool test2json', 'tool pprof', 'tool trace',
      'version', 'vet', 'work edit', 'work init', 'work sync', 'work use', 'work vendor'],
    reason: 'Review toolchain selection/download, module and cache access, compiler/cgo execution, tests, generators, tools, persistent configuration or external programs.'},
  gofmt: {source: 'https://pkg.go.dev/cmd/gofmt', operations: [],
    reason: 'Review formatting syntax, CPU profile output or paths that cannot be established.'},
  gofumpt: {source: 'https://pkg.go.dev/mvdan.cc/gofumpt', operations: [],
    reason: 'Review source/module paths, formatting changes, profile output and options outside the modeled gofmt grammar.'},
  goimports: {source: 'https://pkg.go.dev/golang.org/x/tools/cmd/goimports', operations: [],
    reason: 'Import discovery can invoke Go tools and inspect module/GOPATH trees; review source changes, toolchain/cache effects and profiles.'},
  'golangci-lint': {source: 'https://golangci-lint.run/docs/configuration/cli/',
    operations: ['run', 'fmt', 'migrate', 'formatters', 'linters', 'cache clean', 'cache status', 'config path',
      'config verify', 'custom', 'version', 'completion', 'help'],
    reason: 'Review package loading, custom linters/plugins, formatting, config migration, caches, outputs and custom binary builds.'},
  govulncheck: {source: 'https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck', operations: [],
    reason: 'Review Go package loading, toolchain and vulnerability-database access, binary/source reads and output.'},
  staticcheck: {source: 'https://staticcheck.dev/docs/running-staticcheck/cli/', operations: [],
    reason: 'Review Go package loading, compiler/cgo and cache effects, response files and source/configuration access.'},
  gotestsum: {source: 'https://github.com/gotestyourself/gotestsum', operations: ['tool slowest', 'tool ci-matrix'],
    reason: 'Review tests, raw child commands, rerun/watch hooks, source edits and JSON/JUnit report files.'},
  ginkgo: {source: 'https://onsi.github.io/ginkgo/#the-ginkgo-cli',
    operations: ['watch', 'build', 'bootstrap', 'generate', 'labels', 'outline', 'unfocus', 'version', 'completion',
      'convert', 'blur', 'nodot'],
    reason: 'Review tests and hooks, Go builds, watch processes, suite generation, source edits and output files.'},
  gocov: {source: 'https://github.com/axw/gocov', operations: ['test', 'convert', 'report', 'annotate'],
    reason: 'Review test execution, coverage profiles and source paths embedded in coverage data.'},
  'gocov-xml': {source: 'https://github.com/AlekSi/gocov-xml', operations: [],
    reason: 'Review coverage data and any implicit source/module lookup performed by the selected converter.'},
  'gocover-cobertura': {source: 'https://github.com/t-yuki/gocover-cobertura', operations: [],
    reason: 'Coverage profile paths drive additional source-file reads; standard input is not a file-access boundary.'},
  'go-junit-report': {source: 'https://github.com/jstemmer/go-junit-report', operations: [],
    reason: 'Review explicit input/output files or unclassified report-conversion syntax.'},
};
export const commands = Object.keys(tools);
export const forms = name => [...executableForms(name), ...(['go', 'gofmt'].includes(name)
  ? ['/usr/local/go/bin/', '/usr/lib/go/bin/', '/usr/lib/golang/bin/'].map(prefix => prefix + name) : [])];
const execution = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const protectedPaths = ['.git', '.shield', '.ssh', '.aws', '.codex', '.claude', '.env', '.mcp.json'];
const writePath = {within: {root: 'write'}, exclude: protectedPaths.map(path => ({root: 'project', path}))};

export function goPack() {
  const rules = [];
  const add = (id, name, args, decision, reason, extra = {}) => {
    const row = {id, conditions: {domain: 'argv', executable: {one_of: forms(name)}, arguments: args}, decision, reason, ...extra};
    rules.push(row);
    return row;
  };
  const exact = (name, args, label) => add(`${name}-info-${label}`, name, {kind: 'exact', values: args}, 'allow',
    'Print built-in metadata using the trusted installed executable.');
  for (const [name, tool] of Object.entries(tools)) {
    for (const operation of tool.operations) add(`${name}-${operation.replaceAll(' ', '-')}`, name,
      {kind: 'prefix', values: operation.split(' ')}, execution, tool.reason);
    // Go's broad fallback asks so declared -C requests can be normalized first.
    // Known operations regain their effect class after directory selection.
    const review = ['go', 'gofmt', 'gofumpt', 'go-junit-report'].includes(name);
    add(`${name}-unclassified`, name, {kind: 'any'}, review ? 'ask' : execution, tool.reason, {fallback: true});
  }

  // Select() explicitly bypasses toolchain switching for these three complete
  // local queries. Combining queries or adding flags removes that guarantee.
  // See golang/go src/cmd/go/internal/toolchain/select.go, Select().
  for (const variable of ['GOTOOLCHAIN', 'GOMOD', 'GOWORK'])
    exact('go', ['env', variable], `env-${variable}`).conditions.cwd = {within: {root: 'read'}};

  for (const name of ['gofmt', 'gofumpt', 'goimports', 'golangci-lint', 'govulncheck', 'staticcheck', 'gotestsum', 'ginkgo', 'go-junit-report']) {
    // These Go flag/Cobra help forms exit before the operational path. Version
    // spellings are declared separately rather than inferred from a basename.
    for (const flag of ['-h', '--help']) exact(name, [flag], flag.replaceAll('-', '') || 'help');
  }
  for (const name of ['gofumpt', 'govulncheck', 'staticcheck', 'go-junit-report']) exact(name, ['-version'], 'version-flag');
  exact('golangci-lint', ['--version'], 'version-flag');
  exact('golangci-lint', ['version'], 'version-command');
  exact('gotestsum', ['--version'], 'version-flag');
  exact('ginkgo', ['version'], 'version-command');
  exact('staticcheck', ['-list-checks'], 'list-checks');
  add('staticcheck-explain', 'staticcheck', {kind: 'sequence', prefix: ['-explain'],
    rest: {kind: 'each', match: {regex: '[A-Z][A-Z0-9]+'}, min: 1, max: 1}}, 'allow', 'Explain a built-in diagnostic.');

  // Go's flag package has no short-option clusters. Boolean switches, including
  // -w=false, need no declaration; only -r consumes the following token.
  const grammar = {kind: 'options', prefix: [], flags: [], values: ['-r'],
    operands: true, unknown_options: 'skip', short_clusters: false};
  const format = add('gofmt-paths', 'gofmt', grammar, routine,
    'Format or rewrite Go files at approved writable paths.', {
      requirements: {argument_paths: {grammar, operands: {path: writePath, recursive: true}}},
      on_unmet: {decision: 'ask', message: 'Review formatting paths outside writable roots, protected trees, stdin operands or unparseable arguments.'},
    });
  format.conditions.cwd = writePath;
  // Go accepts both -name=value and --name=value. Its long single-dash profile
  // option cannot be declared as a short-option cluster in Shield's grammar.
  // Review it conservatively instead of skipping an attached output filename.
  add('gofmt-profile-review', 'gofmt', {kind: 'risk_tokens', prefix: [],
    any_of: [{regex: '(?s:^-{1,2}cpuprofile(?:=.*)?$)'}]}, 'ask', 'Review the CPU profile file opened by gofmt.');

  // This converter only reads stdin/writes stdout unless -in/-out select files.
  // Other options change parsing, report metadata or display, not file access.
  add('junit-stream', 'go-junit-report', {kind: 'options', prefix: [], flags: [], values: ['-p'],
    operands: true, unknown_options: 'skip', short_clusters: false}, 'allow', 'Convert supplied test output to JUnit XML on standard output.');
  add('junit-file-review', 'go-junit-report', {kind: 'risk_tokens', prefix: [],
    any_of: [{regex: '(?s:^-{1,2}(?:in|out)(?:=.*)?$)'}]}, 'ask', 'Review explicit test-log input or JUnit output files.');

  return {schema_version: 1, kind: 'pack', id: 'canonic/go', version, license: 'MIT', maintainers: ['Canonic'],
    description: 'Go toolchain, formatting, linting, vulnerability scans, test runners and coverage, with checked gofmt paths and review for execution, acquisition, configuration and generated files.',
    engines: {shield: engine},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'argument-paths-v1', 'location-v1', 'access-paths-v1',
      'requirements-v1', 'regex-v1', 'fallback-rules-v1', 'unknown-options-v1', 'directory-options-v1'],
    directory_options: [{executable: {one_of: forms('go')}, option: '-C', forms: ['separate', 'equals'], paths: 'follow'}],
    rules};
}
