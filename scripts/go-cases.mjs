// Independent expected decisions; do not import policy tables or derive
// expectations from evaluator output.
const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const execute = ['ask', 'ask', 'deny'];
const rows = [];
const go = [
  'bug', 'build ./...', 'clean -cache -testcache -modcache', 'doc net/http', 'env', 'fix ./...', 'fmt ./...',
  'generate ./...', 'get example.com/acme@v1.0.0', 'help', 'help build', 'install example.com/acme@v1.0.0',
  'list ./...', 'mod download', 'mod edit -replace=example.com/old=../new', 'mod graph', 'mod init example.com/acme',
  'mod tidy', 'mod vendor', 'mod verify', 'mod why example.com/acme', 'run ./cmd/acme', 'telemetry on',
  'test ./...', 'tool compile main.go', 'tool cover -func=coverage.out', 'tool covdata percent -i=coverage',
  'tool test2json ./test.binary', 'tool pprof cpu.pprof', 'tool trace trace.out', 'version', 'vet ./...',
  'work edit -go=1.27', 'work init', 'work sync', 'work use ./module', 'work vendor',
];
for (const invocation of go) rows.push([['go', ...invocation.split(' ')], execute]);

rows.push(
  [['go', 'env', 'GOTOOLCHAIN'], allow], [['go', 'env', 'GOMOD'], allow], [['go', 'env', 'GOWORK'], allow],
  [['go', 'env', 'GOMOD', 'GOWORK'], execute], [['go', 'env', '-json', 'GOMOD'], execute],
  [['go', 'env', 'GOPROXY'], execute], [['go', 'env', '-w', 'GOTOOLCHAIN=auto'], execute],
  [['go', 'env', '-u', 'GOPROXY'], execute], [['go', 'env', '-changed'], execute],
  [['go', 'version', '-m', '/outside/binary'], execute], [['go', 'version', '-w', 'binary'], execute],
  [['go', 'test', '-run=^$', './...'], execute], [['go', 'test', '-c', '-o', '/outside/test'], execute],
  [['go', 'test', '-coverprofile=/outside/coverage.out', './...'], execute],
  [['go', 'test', '-cpuprofile', '/outside/cpu', '-memprofile=/outside/mem', './...'], execute],
  [['go', 'test', '-outputdir', '/outside', '-args', '--version'], execute],
  [['go', 'test', '-exec=/outside/runner', './...'], execute],
  [['go', 'build', '-toolexec=/outside/runner', '-o=/outside/acme', './cmd/acme'], execute],
  [['go', 'build', '-overlay=/outside/overlay.json', '-modfile=/outside/go.mod', './...'], execute],
  [['go', 'build', '-buildmode=plugin', '-pkgdir=/outside/cache', './...'], execute],
  [['go', 'generate', '-n', './...'], execute], [['go', 'run', 'example.com/acme@latest', '--version'], execute],
  [['go', 'run', './script.go', '--help'], execute], [['go', 'tool', 'example', '--help'], execute],
  [['go', 'tool', '-n', 'example'], execute], [['go', 'tool', 'cover', '-html=coverage.out'], execute],
  [['go', 'tool', 'covdata', 'merge', '-i=one,two', '-o=/outside/coverage'], execute],
  [['go', 'mod', 'download', '-json'], execute], [['go', 'mod', 'tidy', '-diff'], execute],
  [['go', 'get', '-tool', 'example.com/tool@latest'], execute], [['go', 'telemetry', 'off'], execute],
  [['go', 'help', 'testflag'], execute], [['go', 'build', '--help'], execute],
  [['go', '--help'], review], [['go', '--version'], review], [['go'], review],
  [['go', 'future-command'], review], [['go', '-C'], review], [['go', '-C='], review],
  [['go', '-C', '.', '-C', '.', 'env', 'GOMOD'], review],
  [['go', '-C', '.', 'env', 'GOMOD'], allow], [['go', '-C=.', 'env', 'GOWORK'], allow],
  [['go', '-C', '/outside', 'env', 'GOMOD'], execute],
  [['go', '-C=.', 'env', '-w', 'GOPROXY=https://packages.example.com'], execute],
  [['go', 'build', '-o'], execute], [['go', 'test', '-exec'], execute], [['go', 'mod', 'future-command'], review],
);
for (const selector of [['-C', '.'], ['-C=.']]) for (const args of [
  ['build', './...'], ['test', './...'], ['generate', './...'], ['install', 'example.com/tool@latest'],
  ['mod', 'tidy'], ['tool', 'cover', '-html=coverage.out'], ['env', '-w', 'GOTOOLCHAIN=auto'],
]) rows.push([['go', ...selector, ...args], execute]);

const format = [
  [[], routine], [['main.go'], routine], [['-w', 'main.go'], routine], [['-l', '-d', 'src'], routine],
  [['-w=false', 'main.go'], routine], [['--w=false', '--d', 'main.go'], routine],
  [['-r', 'a[b:len(a)] -> a[b:]', '-w', 'main.go'], routine],
  [['-r=a[b:len(a)] -> a[b:]', 'main.go'], routine],
  [['-future-display', 'main.go'], routine], [['main.go', 'other.go'], routine],
  [['-w', '/outside/main.go'], review], [['-w', '../main.go'], review],
  [['-w', '.shield/policy.go'], review], [['-w', '.git/main.go'], review],
  [['-w', '.codex/config.go'], review], [['-w', 'src', '/outside/main.go'], review],
  [['-w', '.'], review], [['-w', '--', '/outside/main.go'], review], [['-'], review],
  [['-r'], review], [['-cpuprofile', 'cpu.pprof', 'main.go'], review],
  [['-cpuprofile=/outside/cpu.pprof', 'main.go'], review], [['--cpuprofile=/outside/cpu.pprof', 'main.go'], review],
  [['-cpuprofile=/outside/cpu\nprofile', 'main.go'], review],
  [['-w', 'main.go', '-cpuprofile=/outside/cpu'], review],
  [['-h'], allow], [['--help'], allow],
];
for (const [args, expected] of format) rows.push([['gofmt', ...args], expected]);

const families = {
  'golangci-lint': ['run ./...', 'fmt ./...', 'migrate', 'formatters', 'linters', 'cache clean', 'cache status',
    'config path', 'config verify', 'custom --destination /outside', 'completion zsh', 'help linters'],
  gotestsum: ['tool slowest --jsonfile tests.json', 'tool ci-matrix --input timing.json'],
  ginkgo: ['watch', 'build', 'bootstrap', 'generate example', 'labels', 'outline suite_test.go', 'unfocus',
    'completion', 'convert', 'blur', 'nodot'],
  gocov: ['test ./...', 'convert coverage.out', 'report coverage.json', 'annotate coverage.json'],
};
for (const [name, invocations] of Object.entries(families))
  for (const invocation of invocations) rows.push([[name, ...invocation.split(' ')], execute]);
rows.push(
  [['gofumpt', '-w', 'main.go'], review], [['gofumpt', '-lang=go1.27', '-modpath=example.com/acme', 'src'], review],
  [['gofumpt', '-cpuprofile=/outside/profile', 'src'], review],
  [['goimports', '-w', 'main.go'], execute], [['goimports', '-srcdir', '/outside', '-local', 'example.com/acme'], execute],
  [['goimports', '-cpuprofile=/outside/cpu', '-memprofile=/outside/mem', 'src'], execute],
  [['golangci-lint', 'run', '--fix', '--config=/outside/lint.yml', './...'], execute],
  [['golangci-lint', 'run', '--output.json.path=/outside/report', './...'], execute],
  [['golangci-lint', 'fmt', '--diff', '--enable', 'gofumpt', './...'], execute],
  [['golangci-lint', 'version'], allow], [['golangci-lint', '--version'], allow],
  [['golangci-lint', 'version', '--json'], execute],
  [['govulncheck', './...'], execute], [['govulncheck', '-mode=binary', '/outside/acme'], execute],
  [['govulncheck', '-mode=extract', '/outside/acme'], execute],
  [['govulncheck', '-mode=convert', '-format=sarif'], execute],
  [['govulncheck', '-mode=query', '-json', 'example.com/acme@v1.0.0'], execute],
  [['govulncheck', '-db=https://audit.example.com', '-C', '/outside', './...'], execute],
  [['govulncheck', '-scan=module', '-test', '-tags=integration'], execute],
  [['govulncheck', '-version', './...'], execute],
  [['staticcheck', './...'], execute], [['staticcheck', '-checks=all', '-f', 'json', './...'], execute],
  [['staticcheck', '-list-checks'], allow], [['staticcheck', '-explain', 'SA1000'], allow],
  [['staticcheck', '-explain', '/outside/config'], execute], [['staticcheck', '@args.txt'], execute],
  [['staticcheck', '-list-checks', './...'], execute],
  [['gotestsum'], execute], [['gotestsum', '--', '-race', '-coverprofile=/outside/cover', './...'], execute],
  [['gotestsum', '--raw-command', '--', './scripts/test.sh', '--version'], execute],
  [['gotestsum', '--watch', '--post-run-command', '/outside/hook'], execute],
  [['gotestsum', '--junitfile', '/outside/junit.xml', '--jsonfile', '/outside/tests.json'], execute],
  [['gotestsum', 'tool', 'slowest', '--skip-stmt', 'src/main_test.go', '--jsonfile', 'tests.json'], execute],
  [['ginkgo'], execute], [['ginkgo', '-r', '--dry-run'], execute], [['ginkgo', 'version'], allow],
  [['ginkgo', '--cover', '--coverprofile=/outside/coverage', '--json-report=/outside/report', './...'], execute],
  [['ginkgo', '--after-run-hook=/outside/hook', './...'], execute],
  [['gocov-xml'], execute], [['gocover-cobertura'], execute],
  // This converter has no flag parser: even metadata-looking arguments do not
  // stop it from reading files named by coverage input.
  [['gocover-cobertura', '--help'], execute], [['gocover-cobertura', '--version'], execute],
  [['gocov-xml', '--help'], execute], [['gocov', '--help'], execute],
  [['go-junit-report'], allow], [['go-junit-report', '-parser=gojson'], allow],
  [['go-junit-report', '-p', 'suite=acme', '-set-exit-code', '-no-xml-header'], allow],
  [['go-junit-report', '-package-name', 'acme', '-subtest-mode=exclude-parents'], allow],
  [['go-junit-report', '-in', 'tests.log'], review], [['go-junit-report', '-in=/outside/log'], review],
  [['go-junit-report', '--in=/outside/log'], review], [['go-junit-report', '-out', 'junit.xml'], review],
  [['go-junit-report', '--out=/outside/report.xml'], review],
  [['go-junit-report', '--out=/outside/report\n.xml'], review],
  [['go-junit-report', '-in', 'tests.log', '-out', '.git/report.xml'], review],
  [['go-junit-report', '-p'], review], [['go-junit-report', '-out'], review],
);
for (const name of ['gofumpt', 'govulncheck', 'staticcheck', 'go-junit-report']) rows.push([[name, '-version'], allow]);
for (const name of ['gofmt', 'gofumpt', 'goimports', 'golangci-lint', 'govulncheck', 'staticcheck', 'gotestsum', 'ginkgo', 'go-junit-report'])
  rows.push([[name, '-h'], allow], [[name, '--help'], allow]);
rows.push([['gotestsum', '--version'], allow]);

// Fixed executable spellings, lookalikes and nonstandard locations are separate
// from operation matching. No executable authentication is implied.
for (const name of ['go', 'gofmt', 'gofumpt', 'goimports', 'golangci-lint', 'govulncheck', 'staticcheck', 'gotestsum',
  'ginkgo', 'gocov', 'gocov-xml', 'gocover-cobertura', 'go-junit-report']) {
  const args = name === 'go' ? ['env', 'GOMOD'] : name === 'gofmt' ? ['-w', 'main.go'] : name === 'go-junit-report' ? [] : ['future-operation'];
  const expected = name === 'go' || name === 'go-junit-report' ? allow : name === 'gofmt' ? routine : name === 'gofumpt' ? review : execute;
  for (const prefix of ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/']) rows.push([[prefix + name, ...args], expected]);
  rows.push([[`${name}-unrelated`, ...args], review], [[`/outside/bin/${name}`, ...args], review]);
}
rows.push(
  [['/usr/local/go/bin/go', 'env', 'GOMOD'], allow], [['/usr/lib/go/bin/go', '-C', '.', 'test', './...'], execute],
  [['/usr/lib/golang/bin/gofmt', '-w', 'src'], routine], [['go1.27.4', 'test', './...'], review],
  [['.local/bin/govulncheck', './...'], review],
);

export function goCases() {
  const cases = ['loose', 'recommended', 'strict'].flatMap((profile, index) =>
    rows.map(([argv, expected], row) => ({name: `go-${row}-${profile}`, profile, argv, expected: expected[index]})));
  for (const profile of ['loose', 'recommended', 'strict']) cases.push({name: `unmatched-go-mcp-${profile}`, profile,
    input: {kind: 'mcp', server: 'go', tool: 'run', arguments: {}, original_input: {}}, expected: 'ask'});
  return {schema_version: 1, cases};
}
