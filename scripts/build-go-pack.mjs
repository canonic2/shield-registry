import {copyFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {commands, tools, version, engine, forms, goPack} from './go-policy.mjs';
import {goCases} from './go-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = new URL(`../packs/canonic/go/${version}/`, import.meta.url);
export function guide() {
  return `# Go permissions ${version}

One Go ecosystem pack covering ${commands.map(name => `\`${name}\``).join(', ')}.
Requires Shield \`${engine}\`. This pack was
reviewed on 2026-11-23 against the official references below.
Full fixture parity requires the non-cluster option-scanner correction included
with this change. Earlier 0.53.0 builds conservatively ask for some harmless
single-dash flag forms; use the matching development build for validation.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact local \`go env GOTOOLCHAIN\`, \`go env GOMOD\`, \`go env GOWORK\` queries in approved read folders | Allow | Allow | Allow |
| gofmt formatting, rewrites and stdout transformation in approved write folders, with checked explicit source trees | Allow | Allow | Ask |
| gofmt CPU profile output, protected/outside paths and syntax whose paths cannot be established | Ask | Ask | Ask |
| Verified exact standalone help/version forms and Staticcheck diagnostic descriptions | Allow | Allow | Allow |
| go-junit-report stdin-to-stdout conversion without explicit input/output files | Allow | Allow | Allow |
| go-junit-report explicit input/output files | Ask | Ask | Ask |
| Known Go operations: build, test, generation, acquisition, tools, configuration, documentation, help and version | Ask | Ask | Deny |
| goimports, lint/vulnerability tools, test runners and coverage converters | Ask | Ask | Deny |
| gofumpt formatting and unclassified Go/gofmt/report syntax | Ask | Ask | Ask |

## Go toolchains, builds and execution

Go can select or download and run a toolchain before handling even a version or
help request. Its environment, go.mod and go.work select that behavior. The
three exact single-variable env queries above have an explicit local-toolchain
bypass in Go's implementation. Adding another variable or a display flag loses
that guarantee and retains review. These queries print locations or the
toolchain setting; they do not grant access to arbitrary environment values.

Build, list, documentation, vet and source-analysis paths can load packages,
invoke compiler/cgo or analysis tools, access module proxies and caches, and
acquire toolchains. Tests, including compile-only and \`-run=^$\` forms, do not
establish a general no-execution boundary. \`go generate\`, \`go run\`,
\`-exec\`, \`-toolexec\` and module-provided \`go tool\` programs require review.
Review includes explicit output, overlay, module, package-directory, coverage,
profile, trace and generated-file paths; URLs, credentials and host selection;
and any implicit effects in configuration or environment. The pack cannot
establish a safe runtime footprint for arbitrary Go code or selected tools.

\`go env -w/-u\` changes persistent user configuration. Module/workspace edits,
dependency installation, vendoring, telemetry changes, bug reporting, cache
deletion and toolchain/module acquisition remain reviewed. The pack does not
turn a dry run, frozen/read-only module setting, help flag on a child program
or a pinned dependency into consent to those effects.

The declared \`go -C DIR\` and \`go -C=DIR\` leading forms are evaluated as the
plain command from that directory. Known restrictions remain in force and the
three local env queries still require an approved read directory. Repeated,
missing and malformed directory selectors ask. Other new global syntax and
unknown Go operations ask in all profiles.

## Formatting and report conversion

gofmt source operands are checked recursively against approved write roots,
excluding version control, Shield state, credential folders and agent settings.
An explicitly named tree overlapping protected folders asks, so prefer a bounded
source directory such as \`gofmt -w src\`. Even listing/diff-only invocations
conservatively require write access. With no operand, gofmt formats standard
input; it still uses the profile's ordinary formatting decision and cwd check.
The \`-r\` rewrite language transforms syntax and does not execute Go code.
Other display/boolean options do not need separate allowances.

The grammar identifies \`-r\` as value-taking and checks all remaining operands.
CPU profiling asks in both \`-cpuprofile FILE\` and \`--cpuprofile=FILE\` forms,
including repeated or newline-containing filenames. Shield's option grammar
does not declare Go's multi-letter single-dash options as value options; the
profile-output scan retains review rather than silently skipping an attached
filename. This pack does not encode a growing allowance list for build flags.
gofumpt's module-derived defaults and additional Go-style options keep its whole
formatting workflow reviewed; its exact version/help forms are separate.

go-junit-report converts supplied test text/JSON to XML on stdout. Its ordinary
report metadata and display options do not open files. Every \`-in\`, \`--in\`,
\`-out\` and \`--out\` occurrence asks, with either a separate or equals value;
these compound flag values are not treated as sandbox-checked paths. Shell
redirections remain separate host requests. In contrast, gocover-cobertura
reads Go source paths named by coverage input, so its bare invocation and even
metadata-looking arguments remain reviewed. gocov/gocov-xml also retain review
for coverage inputs and implicit source access.

## Lint, vulnerability, test and coverage tools

golangci-lint can load custom linters, build a custom executable, format files,
migrate configuration and write reports/caches. goimports and Staticcheck can
use Go package discovery. govulncheck source analysis can load packages and
contact a vulnerability database; its binary mode analyzes symbols without
executing the target, but binary reads and database access still need review.
gotestsum supports raw child commands, watch/post-run hooks, report files and
source edits. Ginkgo can run/build/watch suites and generate or edit source.
Coverage tools include core \`go tool cover/covdata\`, gocov and XML/JUnit
converters. A profile's embedded filenames can name files outside the project.

Exact \`-h\` and \`--help\` forms are allowed for gofmt, gofumpt, goimports,
golangci-lint, govulncheck, Staticcheck, gotestsum, Ginkgo and go-junit-report.
Exact \`-version\` is allowed for gofumpt, govulncheck, Staticcheck and
go-junit-report; \`--version\` for golangci-lint and gotestsum; and \`version\`
for golangci-lint and Ginkgo. Staticcheck's exact \`-list-checks\` and
\`-explain CHECK\` (one diagnostic identifier) describe built-in diagnostics.
These rules trust the selected installed executable. Metadata permissions are
not inferred for coverage converters or transferred through \`go run\` or
\`go tool\` wrappers. Unknown execution-tool syntax retains Ask/Ask/Deny.

Ask follows the host's approval or fallback behavior and does not guarantee a
displayed prompt. Paths in the argument list, cwd and metadata do not confine
processes at the OS level. Environment overrides (including GOTOOLCHAIN,
GOFLAGS, GOENV, GOPROXY, GOAUTH, GOCACHEPROG, GOBIN, CC and tool-specific
configuration), implicit files, child programs and network activity require
host enforcement or review.

## Executables and operation inventory

Every command matches its basename and standard \`/usr/bin/\`,
\`/usr/local/bin/\` and \`/opt/homebrew/bin/\` locations. go/gofmt also match
\`/usr/local/go/bin/\`, \`/usr/lib/go/bin/\` and \`/usr/lib/golang/bin/\`.
Other custom or versioned executables, Windows paths/launchers and MCP servers
use ordinary host fallback. Matching an executable name does not authenticate
its bytes. No interfaces have been retired from this first pack release.

Each listed operation has independent profile fixtures. Whole-invocation tools
classify options and default modes through their documented review boundary.

| Command | Operations | Official reference |
| --- | --- | --- |
${Object.entries(tools).map(([name, tool]) => `| ${name} | ${tool.operations.length ? tool.operations.map(operation => `\`${operation}\``).join(', ') : 'Whole invocation'} | [Reference](${tool.source}) |`).join('\n')}

Ginkgo's historical \`convert\`, \`blur\` and \`nodot\` spellings remain reviewed
compatibility coverage. gocov's archived upstream is supported as an installed
legacy tool; this pack does not recommend or install it.

Toolchain evidence: [Go toolchains](https://go.dev/doc/toolchain) and
[local-query startup exceptions](https://github.com/golang/go/blob/master/src/cmd/go/internal/toolchain/select.go).
Formatter and converter details were also checked against
[gofmt source](https://github.com/golang/go/blob/master/src/cmd/gofmt/gofmt.go),
[gofumpt source](https://github.com/mvdan/gofumpt/blob/master/gofmt.go),
[JUnit source](https://github.com/jstemmer/go-junit-report/blob/master/main.go) and
[Cobertura source](https://github.com/t-yuki/gocover-cobertura/blob/master/gocover-cobertura.go).

## Reproduction and validation

Canonical policy: \`scripts/go-policy.mjs\`. Independent expected decisions:
\`scripts/go-cases.mjs\`. Generate with \`node scripts/build-go-pack.mjs\`.
Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/go-pack.test.mjs\`.
All fixture files are evaluated through production Shield. They do not run Go
tools, install dependencies, contact services or execute project code. Installed
tool and live native-agent-hook acceptance are separate and remain unverified.
`;
}

export async function buildGoPack() {
  const pack = goPack();
  await mkdir(directory, {recursive: true});
  const inventory = {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of.includes(forms(name)[0])).map(rule => rule.id)}))};
  for (const [file, document] of [['pack.yml', pack], ...splitCaseFiles(goCases()), ['commands.json', inventory]])
    await writeFile(new URL(file, directory), JSON.stringify(document, null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildGoPack();
