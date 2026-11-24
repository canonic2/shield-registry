import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {ecosystemRules, tools, version, forms} from './node-ecosystem-policy.mjs';
import {nodeEcosystemCases} from './node-ecosystem-cases.mjs';
import {playwrightRules, playwrightTools} from './node-playwright-policy.mjs';
import {nodePlaywrightCases} from './node-playwright-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const previous = new URL('../packs/canonic/node/0.5.1/', import.meta.url);
export const candidate = new URL(`../packs/canonic/node/${version}/`, import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

export async function nodeEcosystemRelease() {
  const pack = await read('pack.yml');
  pack.version = version;
  pack.description = 'JavaScript and TypeScript ecosystem: Node, package managers, quality, tests, coverage, monorepo tools and Playwright/browser QA; checked project paths, browser acquisition previews and review for browser, network and system effects.';
  pack.engines.shield = '>=0.53.0, <1.0.0';
  pack.capabilities.push('access-paths-v1');
  pack.rules.push(...ecosystemRules(), ...playwrightRules());
  const cases = await read('cases.json');
  cases.cases.push(...nodeEcosystemCases, ...nodePlaywrightCases);
  const commands = await read('commands.json');
  // Rebuild only the inventory, preserving every inherited policy rule itself.
  for (const name of [...Object.keys(tools), ...Object.keys(playwrightTools)]) commands.commands.push({name, rule_ids: []});
  for (const command of commands.commands) command.rule_ids = pack.rules.filter(rule => {
    const executable = rule.conditions.executable;
    return typeof executable === 'string' ? executable === command.name
      : executable?.one_of?.some(value => forms(command.name).includes(value));
  }).map(rule => rule.id);
  const inherited = await readFile(new URL('README.md', previous), 'utf8');
  const readme = `# JavaScript ecosystem permissions ${version}

Unpublished successor to Node 0.5.1. One pack, \`canonic/node\`, owns the Node
runtime, its package managers, quality, test, monorepo and Playwright/browser QA tools below.
Reviewed on 2026-11-23–24 against their official CLI references. Requires Shield
\`>=0.53.0, <1.0.0\`.

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
Bare \`yarn tsc --noEmit\` and \`pnpm eslint src\` use the same explicit-path
checks as direct tools. Manager selection still applies. Registry runners such
as npx, npm exec, pnpm exec/dlx, yarn dlx and Corepack keep the existing review
boundary. Project script bodies in \`npm run\`, \`yarn run\` and \`pnpm run\`
remain trusted opaque project scripts under the inherited rules.

The approved working directory must be writable. Explicit source operands,
output/cache locations and config paths must be approved, away from .git,
.shield, credential folders and agent settings. Source directories and output
trees are checked recursively; naming the whole project can overlap protected
trees and ask. Prefer bounded paths such as \`eslint src\`, \`prettier --write
src\` and \`vitest run tests/unit\`. All repeated explicit path values are
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

\`playwright\` and \`playwright-core\` share browser permissions; the former also
owns Playwright Test. Standalone help/version queries exit before their command
actions. \`install --list\` lists installed browser metadata, and \`install
--dry-run\` prints acquisition plans. Other display flags and browser selections
keep those decisions. \`--with-deps\` always asks because dependency processing
precedes the list/preview branches. \`install-deps --dry-run\` also asks: system
package-manager simulation is execution. Installation, forced downloads, cache
cleanup and uninstall remain reviewed.

Test runs, including snapshot updates and \`test --list\`, ask. Test collection
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
browser/test/MCP servers and delegated \`cli\`/\`mcp\` commands remain reviewed.
Agent/skill initialization changes persistent instructions and asks.

No Playwright MCP transport binding or browser-tool allowance is introduced;
requests through unregistered MCP servers retain host fallback. Custom absolute
executables and \`node_modules/.bin\` paths ask. The existing registry-runner and
manager-selection boundaries still apply to help and previews. Catalog discovery
is already at its 16-name limit; select Node directly for Playwright coverage.

Interface evidence: [Playwright 1.65.1](https://github.com/microsoft/playwright/releases/tag/v1.65.1),
[core CLI](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/cli/program.ts),
[install actions](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/cli/installActions.ts),
[test actions](https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright/src/cli/testActions.ts),
[trace CLI](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/tools/trace/traceCli.ts)
and current main (1.66.0-next), reviewed 2026-11-24. No older permission is retired.

## Reviewed interfaces

${Object.entries(tools).map(([name, tool]) => `- [${name}](${tool.source}): ${tool.operations.map(op => '\x60' + op + '\x60').join(', ')}.`).join('\n')}
${Object.entries(playwrightTools).map(([name, tool]) => `- [${name}](${tool.source}): ${tool.operations.map(([op]) => '\x60' + op + '\x60').join(', ')}.`).join('\n')}

## Maintenance and inherited permissions

Generate with \`node scripts/build-node-ecosystem.mjs\`. Policy is in
\`scripts/node-ecosystem-policy.mjs\`; expected decisions are independently
specified in \`scripts/node-ecosystem-cases.mjs\`. Fixtures retain all 264
published decisions, and all 309 inherited rules remain unchanged. No published
release is rewritten and no previous operation is retired. The complete command
inventory has 34 executable names. Playwright policy and independent decisions
live in \`scripts/node-playwright-policy.mjs\` and \`scripts/node-playwright-cases.mjs\`.
Catalog discovery keeps the existing ten
names and six representative new names because the registry allows 16 per pack.
The pack still covers all listed tools after installation.

The original Node permission contract follows for the retained rules.

${inherited.replace('# Node permissions 0.5.1', '## Retained Node runtime and package managers')}`;
  return {pack, cases, commands, readme};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {pack, cases, commands, readme} = await nodeEcosystemRelease();
  await mkdir(candidate, {recursive: true});
  // Compact JSON leaves ample space below Shield's 1 MiB admission limit.
  await writeFile(new URL('pack.yml', candidate), JSON.stringify(pack) + '\n');
  await writeFile(new URL('commands.json', candidate), JSON.stringify(commands, null, 2) + '\n');
  for (const [name, document] of splitCaseFiles(cases))
    await writeFile(new URL(name, candidate), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', candidate));
  await writeFile(new URL('README.md', candidate), readme);
}
