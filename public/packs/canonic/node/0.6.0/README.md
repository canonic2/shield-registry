# JavaScript ecosystem permissions 0.6.0

Unpublished successor to Node 0.5.1. One pack, `canonic/node`, owns the Node
runtime, its package managers, quality, test, monorepo and Playwright/browser QA tools below.
Reviewed on 2026-11-23–24 against their official CLI references. Requires Shield
`>=0.53.0, <1.0.0`.

| New operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact standalone --help, -h and --version | Allow | Allow | Allow |
| Trusted project quality checks, compilation, formatting/fixes, tests, snapshots and watch tests, with checked explicit paths | Allow | Allow | Ask |
| The same tools through bare yarn/yarnpkg/pnpm/pn shorthand | Allow | Allow | Ask |
| Explicit unbounded paths/globs, process hooks, root overrides, servers, browsers, downloads and hosted effects | Ask | Ask | Ask |
| Karma, c8/nyc wrappers and report processing, Turbo/Nx/Lerna operations | Ask | Ask | Ask |
| Playwright built-in root/operation help and version; browser install listing/download preview without --with-deps | Allow | Allow | Allow |
| Those Playwright metadata queries through bare Yarn/pnpm shorthand | Allow | Allow | Ask |
| Playwright tests/listing, browser navigation/capture, profiles/storage, reports/traces, installation/removal, servers and agents | Ask | Ask | Ask |

## Project trust and path boundaries

Supported direct executables use PATH or /bin, /usr/bin, /usr/local/bin and
/opt/homebrew/bin. Custom executable locations ask. Use project-installed tools
through the supported manager shorthand or declare a project-specific policy.
Bare `yarn tsc --noEmit` and `pnpm eslint src` use the same explicit-path
checks as direct tools. Manager selection still applies. Registry runners such
as npx, npm exec, pnpm exec/dlx, yarn dlx and Corepack keep the existing review
boundary. Project script bodies in `npm run`, `yarn run` and `pnpm run`
remain trusted opaque project scripts under the inherited rules.

The approved working directory must be writable. Explicit source operands,
output/cache locations and config paths must be approved, away from .git,
.shield, credential folders and agent settings. Source directories and output
trees are checked recursively; naming the whole project can overlap protected
trees and ask. Prefer bounded paths such as `eslint src`, `prettier --write
src` and `vitest run tests/unit`. All repeated explicit path values are
checked. Missing values and unparseable paths ask. Tool-owned glob/brace patterns
and comma-separated paths ask because argv path checking cannot expand them;
literal shell-expanded files are supported. Response files and stdin filename
overrides are reviewed through the same conservative boundary.

Configuration discovery, imports, project plugins, compiler output configured
inside tsconfig, test setup, reporters and tested code are trusted project code.
These permissions are not filesystem or network confinement. Even check-only
and list modes may load that code. Strict asks. Explicit process/loader hooks,
opaque configuration carriers and unmodeled root selectors ask. Harmless
display/boolean options do not require individual permission entries; the values
table identifies scalars and explicit files for parsing. TypeScript multi-letter
single-dash aliases, ambiguous short-option equals values and short clusters
outside the modeled syntax ask.
Noncanonical capitalization of TypeScript file selectors asks. Dashed aliases
of camelCase options use the same file checks or effect review.
Vitest dotted output/cache options (including --coverage.reportsDirectory and
--cache.dir) ask: Shield's current option grammar cannot declare dotted names.
When combined with Baseline 0.17.0, its independent project-tools restriction
also asks in Strict for metadata of tsc, ESLint, Prettier, Biome, Vitest and Jest.

Karma needs browser/server scope. c8/nyc can execute an arbitrary child and their
reports can follow filenames embedded in coverage data, so their operational
forms ask. Monorepo tasks can run arbitrary scripts, use remote caches selected
by project/environment, manage daemons, generate files, publish and change
versions. Turbo/Nx/Lerna operational commands ask, including local-cache and
dry-run spellings: those switches alone do not establish the full effect set.
Unknown operations and structured MCP requests gain no allowance.

## Playwright and browser QA

`playwright` and `playwright-core` share browser permissions; the former also
owns Playwright Test. Standalone help/version queries exit before their command
actions. `install --list` lists installed browser metadata, and `install
--dry-run` prints acquisition plans. Other display flags and browser selections
keep those decisions. `--with-deps` always asks because dependency processing
precedes the list/preview branches. `install-deps --dry-run` also asks: system
package-manager simulation is execution. Installation, forced downloads, cache
cleanup and uninstall remain reviewed.

Test runs, including snapshot updates and `test --list`, ask. Test collection
imports project configuration and test modules, and environment-selected watch
mode can bypass the ordinary listing pipeline. A list flag, headless mode,
single worker or disabled tracing cannot establish browser, server or network
scope. Existing opaque Node/package scripts retain their trusted-project
permissions; this pack does not inspect arbitrary script bodies.

Navigation, code generation, screenshots and PDF capture ask even for localhost.
A starting URL does not bound redirects, subresources or script requests.
Review includes URL/proxy/credential scope, borrowed user profiles, storage-state
reads/writes, HAR files, generated code and capture destinations. Trace/report
viewers may serve content or launch browsers. Merging reports, trace sessions,
exports and attachments also require review for embedded data and paths. Driver,
browser/test/MCP servers and delegated `cli`/`mcp` commands remain reviewed.
Agent/skill initialization changes persistent instructions and asks.

No Playwright MCP transport binding or browser-tool allowance is introduced;
requests through unregistered MCP servers retain host fallback. Custom absolute
executables and `node_modules/.bin` paths ask. The existing registry-runner and
manager-selection boundaries still apply to help and previews. Catalog discovery
is already at its 16-name limit; select Node directly for Playwright coverage.

Interface evidence: [Playwright 1.65.1](https://github.com/microsoft/playwright/releases/tag/v1.65.1),
[core CLI](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/cli/program.ts),
[install actions](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/cli/installActions.ts),
[test actions](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright/src/cli/testActions.ts),
[trace CLI](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/trace/traceCli.ts)
and current main (1.66.0-next), reviewed 2026-11-24. No older permission is retired.

## Reviewed interfaces

- [tsc](https://www.typescriptlang.org/docs/handbook/compiler-options.html): `compile`, `--build`, `--init`, `--showConfig`.
- [vue-tsc](https://github.com/vuejs/language-tools/tree/master/packages/tsc): `compile`, `--build`, `--showConfig`.
- [eslint](https://eslint.org/docs/latest/use/command-line-interface): `lint`, `--fix`, `--print-config`, `--init`, `--inspect-config`.
- [biome](https://biomejs.dev/reference/cli/): `check`, `lint`, `format`, `ci`, `init`, `migrate`, `search`, `start`, `stop`, `lsp-proxy`, `rage`.
- [prettier](https://prettier.io/docs/cli): `format`, `--check`, `--write`, `--list-different`, `--find-config-path`.
- [oxlint](https://oxc.rs/docs/guide/usage/linter/cli.html): `lint`, `--fix`, `--init`, `--rules`.
- [oxfmt](https://oxc.rs/docs/guide/usage/formatter/cli.html): `format`, `--check`, `--write`, `--init`, `--migrate`.
- [stylelint](https://stylelint.io/user-guide/cli/): `lint`, `--fix`, `--print-config`.
- [knip](https://knip.dev/reference/cli): `analyze`, `--fix`, `--remove-files`, `--init`.
- [madge](https://github.com/pahen/madge): `graph`, `--circular`, `--image`, `--dot`, `--depends`, `--orphans`, `--leaves`.
- [jscpd](https://github.com/kucherenko/jscpd): `scan`, `mcp`.
- [commitlint](https://commitlint.js.org/reference/cli.html): `lint`, `--edit`, `--from`, `--to`, `--print-config`.
- [vitest](https://vitest.dev/guide/cli.html): `run`, `watch`, `bench`, `related`, `list`, `init`, `merge-reports`.
- [jest](https://github.com/jestjs/jest/blob/main/docs/CLI.md): `test`, `--watch`, `--listTests`, `--updateSnapshot`, `--init`.
- [mocha](https://mochajs.org/running/cli/): `test`, `--watch`, `--parallel`, `init`.
- [ava](https://github.com/avajs/ava/blob/main/docs/05-command-line.md): `test`, `--watch`, `--update-snapshots`, `--reset-cache`.
- [karma](https://karma-runner.github.io/latest/intro/installation.html): `start`, `run`, `stop`, `init`, `completion`.
- [c8](https://github.com/bcoe/c8): `exec`, `report`, `check-coverage`, `merge`.
- [nyc](https://github.com/istanbuljs/nyc): `exec`, `report`, `check-coverage`, `merge`, `instrument`.
- [turbo](https://turborepo.com/docs/reference/run): `run`, `watch`, `prune`, `boundaries`, `trace`, `ls`, `query`, `devtools`, `docs`, `generate`, `scan`, `login`, `logout`, `link`, `unlink`, `bin`, `info`, `telemetry`.
- [nx](https://nx.dev/docs/reference/nx-commands): `run`, `run-many`, `affected`, `show`, `graph`, `list`, `report`, `daemon`, `reset`, `generate`, `g`, `migrate`, `release`, `init`, `add`, `import`, `repair`, `sync`, `sync:check`, `watch`, `connect`, `connect-to-nx-cloud`, `record`, `exec`, `format:check`, `format:write`.
- [lerna](https://lerna.js.org/docs/api-reference/commands): `add-caching`, `changed`, `clean`, `create`, `diff`, `exec`, `import`, `info`, `init`, `list`, `ls`, `publish`, `repair`, `run`, `version`, `watch`, `bootstrap`, `add`, `link`.
- [playwright](https://playwright.dev/docs/test-cli): `install`, `install-deps`, `uninstall`, `open`, `cr`, `ff`, `wk`, `codegen`, `screenshot`, `pdf`, `show-trace`, `run-driver`, `run-server`, `launch-server`, `mcp`, `mark-docker-image`, `cli`, `trace open`, `trace close`, `trace actions`, `trace action`, `trace requests`, `trace request`, `trace console`, `trace errors`, `trace snapshot`, `trace screenshot`, `trace attachments`, `trace attachment`, `trace install-skill`, `test`, `clear-cache`, `test-server`, `show-report`, `merge-reports`, `run-test-mcp-server`, `init-agents`, `init-skills`.
- [playwright-core](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/cli/program.ts): `install`, `install-deps`, `uninstall`, `open`, `cr`, `ff`, `wk`, `codegen`, `screenshot`, `pdf`, `show-trace`, `run-driver`, `run-server`, `launch-server`, `mcp`, `mark-docker-image`, `cli`, `trace open`, `trace close`, `trace actions`, `trace action`, `trace requests`, `trace request`, `trace console`, `trace errors`, `trace snapshot`, `trace screenshot`, `trace attachments`, `trace attachment`, `trace install-skill`.

## Maintenance and inherited permissions

Generate with `node scripts/build-node-ecosystem.mjs`. Policy is in
`scripts/node-ecosystem-policy.mjs`; expected decisions are independently
specified in `scripts/node-ecosystem-cases.mjs`. Fixtures retain all 264
published decisions, and all 309 inherited rules remain unchanged. No published
release is rewritten and no previous operation is retired. The complete command
inventory has 34 executable names. Playwright policy and independent decisions
live in `scripts/node-playwright-policy.mjs` and `scripts/node-playwright-cases.mjs`.
Catalog discovery keeps the existing ten
names and six representative new names because the registry allows 16 per pack.
The pack still covers all listed tools after installation.

The original Node permission contract follows for the retained rules.

## Retained Node runtime and package managers

Requires Shield `>=0.20.0, <1.0.0` with the declared capabilities. Coverage
follows [0.4.0](../0.4.0/README.md). This release allows the
everyday development loop by default and keeps reviewing code that is not
committed project code.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata and help, and read-only listings with any option | Allow | Allow | Allow |
| Node version through Yarn with `--cwd` inside the project | Allow | Allow | Ask |
| Project scripts, script shorthand such as `yarn format:check`, and project files run with `node` or `node --test` | Allow | Allow | Ask |
| Installing declared dependencies, removal and package.json edits | Allow | Allow | Ask |
| Adding or updating dependencies | Allow | Ask | Ask |
| Supported authentication and configuration command prefixes | Allow | Ask | Ask |
| Explicit reads of token/password/secret configuration keys | Deny | Deny | Deny |
| Inline code and preloads, files outside the project, registry packages run with `npx`, `pnpx`, `dlx` or `exec`, global/publication risk scans and unlisted syntax | Ask | Ask | Ask |

## Project scripts

`npm run`, `npm test`, `pnpm`/`yarn` script verbs and their `--dir`,
`--filter`, `-r`, `--workspace` and Corepack forms run committed project
scripts, so Loose and Recommended allow them. `yarn NAME` and `pnpm NAME` also
allow when `NAME` is not one of the manager's own commands, such as
`yarn format:check` or `yarn tsc --noEmit`; a manager option before the name, as
in `pnpm --silent lint:fix`, asks. Built-in commands such as `add`, `rebuild`,
`dlx`, `node`, `plugin` and `set` keep their own decisions.

`node FILE` allows a relative project file ending in `.js`, `.cjs`, `.mjs`,
`.ts`, `.cts` or `.mts`, including files in dot-folders such as
`.local-tools/sync.mjs`. Absolute paths and paths with `..` ask, as do `-e`,
`-p`, `-r` and `--import` anywhere in the request.

A project script runs whatever the project defines. Choose Strict, or add a
project rule, to review each script run.

## Node version through Yarn

Use `yarn --cwd packages/web node --version` (or `-v`) to print the Node
version used by Yarn. Both the launch directory and the directory selected by
`--cwd` must be inside the project. No other Node arguments are covered by
this permission. Strict asks because Yarn can load project configuration and
runtime hooks.

## Read-only listings

`list`, `ls`, `why`, `outdated`, `info`, `explain`, `root` and `bin`, and
`yarn workspaces list`, accept any option in every profile, such as
`pnpm list --depth 0`. `--global` and registry overrides still ask.

The optional package-manager selection remains a boundary: choosing pnpm still
denies npm and Yarn operations, scripts included.

Generate with `node scripts/build-node-yarn-version.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/node-yarn-version.test.mjs`.
