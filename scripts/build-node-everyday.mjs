// Node 0.5.0 allows the everyday development loop by default. 0.4.0 asked for
// every project script (`yarn test`, `npm run build`, `pnpm lint`), every
// `node --test` or `node scripts/x.mjs` run, script shorthand such as
// `yarn format:check`, and read-only listings with options it did not list,
// such as `pnpm list --depth 0` or `yarn workspaces list --json`. This revision:
//
// - allows project scripts, script shorthand and project files run with node in
//   Loose and Recommended; Strict asks;
// - accepts any option on read-only listings and adds `yarn workspaces list`;
// - keeps asking for code that is not committed project code: inline code and
//   preloads (`node -e`, `-r`, `--import`), files outside the project
//   (`node /tmp/x.mjs`, `node ../x.mjs`) and registry packages run with
//   `npx`, `pnpx`, `pnpm dlx`, `yarn dlx` or `exec`;
// - keeps dependency changes, publication, global installs, configuration and
//   registry overrides and credential reads at their 0.4.0 decisions.
//
// Baseline 0.13.0 makes its own package-script reviews fallbacks, so they still
// ask when no Node pack is installed and yield to the Node pack's decision when
// one is. Across packs Ask outranks Allow, so 0.12.0's regular script reviews
// would otherwise keep every script asking.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const nodeRevision = ['0.4.0', '0.5.0'];
export const baselineRevision = ['0.12.0', '0.13.0'];
const directory = (name, version) => new URL(`../packs/canonic/${name}/${version}/`, import.meta.url);
const read = async (name, version, file = 'pack.yml') => JSON.parse(await readFile(new URL(file, directory(name, version))));
const everyday = {loose: 'allow', recommended: 'allow', strict: 'ask'};

// Manager commands that are not script shorthand. Script verbs already listed
// by the script rules (run, test, build, lint, ...) are omitted; they allow.
export const builtins = [...new Set(`add audit autoclean bin cache cat-file cat-index config constraints create dedupe
  deploy dlx doctor env exec explain fetch find-hash generate-lock-entry global help i import info init install
  install-test it la licenses link list ll login logout ls node npm outdated owner pack patch patch-commit
  patch-remove peers plugin policies prune publish rb rebuild recursive remove rm root s sbom search self-update
  server set setup stage store tag team un uninstall unlink unplug up update upgrade upgrade-interactive version
  versions why workspace workspaces approve-builds ignored-builds`.split(/\s+/))].sort();
// A relative project file, including dot-folders, with no `..` segment.
const segment = '\\.?[A-Za-z0-9_-][A-Za-z0-9_.-]*';
export const projectFile = `(?:\\./)?(?:${segment}/)*${segment}\\.(?:js|cjs|mjs|ts|cts|mts)`;

export async function nodeEverydayPack() {
  const pack = await read('node', nodeRevision[0]);
  pack.version = nodeRevision[1];
  const rule = id => pack.rules.find(entry => entry.id === id);
  for (const entry of pack.rules) if (/-scripts$/.test(entry.id)) {
    entry.decision = {...everyday};
    entry.reason = 'Run a project script; Strict asks.';
    delete entry.guidance;
    // A Corepack route's catch-all (`corepack yarn`) is also a rank-1 prefix and
    // would tie with the script, so the same words match as a rank-2 sequence.
    if (entry.id.startsWith('corepack-'))
      entry.conditions.arguments = {kind: 'sequence', prefix: entry.conditions.arguments.values, rest: {kind: 'any'}};
  }
  for (const id of ['node-test', 'node-project-script']) {
    rule(id).decision = {...everyday};
    rule(id).reason = 'Run project code with node; Strict asks. Inline code, preloads and files outside the project ask.';
  }
  rule('node-project-script').conditions.arguments.prefix = [{regex: projectFile}];
  // Read-only listings accept options the grammar does not name. Global and
  // registry options keep asking through the existing token checks.
  const inspection = rule('manager-inspection');
  inspection.conditions.arguments = {...inspection.conditions.arguments, unknown_options: 'skip', operands: true,
    prefix: [{one_of: ['list', 'ls', 'll', 'la', 'why', 'outdated', 'info', 'explain', 'root', 'bin']}]};
  const managers = rule('manager-scripts').conditions.executable;
  const yarn = rule('yarn-workspace-manager-scripts').conditions.executable;
  const at = pack.rules.indexOf(inspection) + 1;
  // An empty leading grammar refuses any option before the script name, so
  // `yarn --flag add pkg` cannot pass as shorthand.
  const shorthand = (id, executable, values) => ({id, conditions: {domain: 'argv', executable,
    arguments: {kind: 'prefix', leading: {flags: [], values: []}, values}},
  decision: {...everyday}, reason: 'Run a project script or installed package binary by name; Strict asks.'});
  pack.rules.splice(at, 0,
    {id: 'yarn-workspaces-list', conditions: {domain: 'argv', executable: yarn,
      arguments: {kind: 'options', prefix: ['workspaces', 'list'], flags: [], values: [], operands: true, unknown_options: 'skip'},
      cwd: structuredClone(inspection.conditions.cwd)},
    decision: {...inspection.decision}, reason: 'List the project workspaces.'},
    shorthand('manager-script-shorthand', managers, [{not: {one_of: builtins}}]),
    shorthand('yarn-workspace-script-shorthand', yarn, ['workspace', {regex: '[^-].*'}, {not: {one_of: builtins}}]));
  const unlisted = rule('manager-unlisted');
  unlisted.reason = 'Unlisted package-manager commands require review.';
  unlisted.guidance.message = 'Package-manager commands this pack does not list require review.';
  if (!pack.capabilities.includes('negated-selectors-v1')) pack.capabilities.push('negated-selectors-v1');
  if (!pack.capabilities.includes('unknown-options-v1')) pack.capabilities.push('unknown-options-v1');
  return pack;
}

export async function baselineScriptFallbackPack() {
  const pack = await read('baseline', baselineRevision[0]);
  pack.version = baselineRevision[1];
  for (const entry of pack.rules) if (/^scripts-/.test(entry.id) && !/-inspection$/.test(entry.id)) entry.fallback = true;
  return pack;
}
export const baselineFallbackIds = async () => (await baselineScriptFallbackPack()).rules
  .filter(entry => /^scripts-/.test(entry.id) && !/-inspection$/.test(entry.id)).map(entry => entry.id);

const routine = ['allow', 'allow', 'ask'];
const allowed = ['allow', 'allow', 'allow'];
const reviewed = ['ask', 'ask', 'ask'];
const dependency = ['allow', 'ask', 'ask'];
const refused = ['deny', 'deny', 'deny'];

// 0.4.0 fixtures whose expectation changes, with the reason.
export const changed = {
  // Project scripts are the everyday development loop.
  'script-loose': 'allow',
  'script-recommended': 'allow',
};

const added = [
  // Project scripts and shorthand.
  ['npm-test', 'npm test', routine],
  ['npm-workspace-script', 'npm --workspace web run build', routine],
  ['pnpm-script', 'pnpm build', routine],
  ['pnpm-run-script', 'pnpm run check', routine],
  ['pnpm-filter-script', 'pnpm --filter web build', routine],
  ['pnpm-recursive-script', 'pnpm -r test', routine],
  ['yarn-script', 'yarn test', routine],
  ['yarn-script-arguments', 'yarn test --watch=false src/app.test.ts', routine],
  // Arguments after the script name go to the script, not to node.
  ['yarn-script-dash-e', 'yarn test -e x', routine],
  ['yarn-shorthand', 'yarn format:check', routine],
  ['yarn-shorthand-binary', 'yarn tsc --noEmit', routine],
  ['pnpm-shorthand', 'pnpm openapi:generate', routine],
  ['yarn-workspace-script', 'yarn workspace @acme/web test', routine],
  ['yarn-workspace-shorthand', 'yarn workspace @acme/web lint:fix', routine],
  ['corepack-script', 'corepack yarn test', routine],
  ['corepack-pnpm-script', 'corepack pnpm --filter web build', routine],
  ['corepack-npm-script', 'corepack npm run build', routine],
  ['corepack-shorthand', 'corepack yarn format:check', reviewed],
  // Project code run with node.
  ['node-test', 'node --test src/app.test.mjs', routine],
  ['node-test-options', 'node --test --test-concurrency=4 src/app.test.mjs', routine],
  ['node-script', 'node scripts/build.mjs', routine],
  ['node-dot-folder-script', 'node .local-tools/sync.mjs', routine],
  ['node-typescript', 'node src/server.ts', routine],
  // Read-only listings with any option.
  ['pnpm-list-depth', 'pnpm list --depth 0', allowed],
  ['pnpm-ls-json', 'pnpm ls --json --depth 1', allowed],
  ['yarn-why-recursive', 'yarn why typescript --recursive', allowed],
  ['pnpm-outdated-format', 'pnpm outdated --format json', allowed],
  ['pnpm-root', 'pnpm root', allowed],
  ['yarn-workspaces-list', 'yarn workspaces list --json', allowed],
  // Code that is not committed project code keeps asking.
  ['node-inline', 'node -p process.version', reviewed],
  ['node-preload', 'node --import ./hook.mjs scripts/build.mjs', reviewed],
  ['node-script-inline-argument', 'node scripts/build.mjs -e x', reviewed],
  ['node-outside-file', 'node /tmp/acme/run.mjs', reviewed],
  ['node-parent-file', 'node ../acme/run.mjs', reviewed],
  ['npx-local-binary', 'npx tsc --noEmit', reviewed],
  ['pnpm-dlx', 'pnpm dlx acme-tool', reviewed],
  ['yarn-dlx', 'yarn dlx acme-tool', reviewed],
  ['pnpm-exec', 'pnpm exec acme-tool', reviewed],
  ['yarn-node', 'yarn node -e x', reviewed],
  // Built-in commands keep their decisions; options cannot disguise them.
  ['yarn-add', 'yarn add zod', dependency],
  ['pnpm-add-unlisted-option', 'pnpm add zod --some-future-option', reviewed],
  ['yarn-leading-option-add', 'yarn --some-future-option add zod', reviewed],
  ['pnpm-leading-option-shorthand', 'pnpm --silent lint:fix', reviewed],
  ['yarn-plugin-import', 'yarn plugin import acme', reviewed],
  ['yarn-set-version', 'yarn set version stable', reviewed],
  ['yarn-rebuild', 'yarn rebuild', reviewed],
  ['pnpm-publish', 'pnpm publish', reviewed],
  ['pnpm-list-global', 'pnpm list --global', reviewed],
  ['yarn-script-registry', 'yarn test --registry=https://example.com', reviewed],
  ['pnpm-config-token', 'pnpm config get _authToken', refused],
];

export async function nodeEverydayCases() {
  const {cases} = await read('node', nodeRevision[0], 'cases.json');
  const next = cases.map(row => row.name in changed ? {...row, expected: changed[row.name]} : row);
  for (const [name, text, decisions] of added)
    ['loose', 'recommended', 'strict'].forEach((profile, index) => next.push({
      name: `everyday-${name}-${profile}`, profile, argv: text.split(' '), expected: decisions[index]}));
  // The manager selection still refuses other managers' scripts.
  for (const profile of ['loose', 'recommended', 'strict']) next.push({name: `everyday-wrong-manager-script-${profile}`,
    profile, variables: {package_manager: 'pnpm'}, argv: ['yarn', 'test'], expected: 'deny'});
  return next;
}

const nodeReadme = `# Node permissions ${nodeRevision[1]}

Requires Shield \`>=0.20.0, <1.0.0\` with the declared capabilities. Coverage
follows [${nodeRevision[0]}](../${nodeRevision[0]}/README.md). This release allows the
everyday development loop by default and keeps reviewing code that is not
committed project code.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata and help, and read-only listings with any option | Allow | Allow | Allow |
| Project scripts, script shorthand such as \`yarn format:check\`, and project files run with \`node\` or \`node --test\` | Allow | Allow | Ask |
| Installing declared dependencies, removal and package.json edits | Allow | Allow | Ask |
| Adding or updating dependencies | Allow | Ask | Ask |
| Supported authentication and configuration command prefixes | Allow | Ask | Ask |
| Explicit reads of token/password/secret configuration keys | Deny | Deny | Deny |
| Inline code and preloads, files outside the project, registry packages run with \`npx\`, \`pnpx\`, \`dlx\` or \`exec\`, global/publication risk scans and unlisted syntax | Ask | Ask | Ask |

## Project scripts

\`npm run\`, \`npm test\`, \`pnpm\`/\`yarn\` script verbs and their \`--dir\`,
\`--filter\`, \`-r\`, \`--workspace\` and Corepack forms run committed project
scripts, so Loose and Recommended allow them. \`yarn NAME\` and \`pnpm NAME\` also
allow when \`NAME\` is not one of the manager's own commands, such as
\`yarn format:check\` or \`yarn tsc --noEmit\`; a manager option before the name, as
in \`pnpm --silent lint:fix\`, asks. Built-in commands such as \`add\`, \`rebuild\`,
\`dlx\`, \`node\`, \`plugin\` and \`set\` keep their own decisions.

\`node FILE\` allows a relative project file ending in \`.js\`, \`.cjs\`, \`.mjs\`,
\`.ts\`, \`.cts\` or \`.mts\`, including files in dot-folders such as
\`.local-tools/sync.mjs\`. Absolute paths and paths with \`..\` ask, as do \`-e\`,
\`-p\`, \`-r\` and \`--import\` anywhere in the request.

A project script runs whatever the project defines. Choose Strict, or add a
project rule, to review each script run.

## Read-only listings

\`list\`, \`ls\`, \`why\`, \`outdated\`, \`info\`, \`explain\`, \`root\` and \`bin\`, and
\`yarn workspaces list\`, accept any option in every profile, such as
\`pnpm list --depth 0\`. \`--global\` and registry overrides still ask.

The optional package-manager selection remains a boundary: choosing pnpm still
denies npm and Yarn operations, scripts included.

Generate with \`node scripts/build-node-everyday.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/node-everyday.test.mjs\`.
`;

const baselineReadme = `# Baseline permissions ${baselineRevision[1]}

Supports Shield \`>=0.20.0, <1.0.0\`.

Package-script reviews (\`npm run\`, \`npm test\`, \`pnpm\`/\`yarn\` script verbs and
their \`--prefix\`, \`--workspace\`, \`--dir\`, \`--filter\`, \`-r\` and \`--cwd\` forms) are
fallback rules. Without a package-manager pack they still ask; with one, such as
canonic/node, that pack decides. Other rules, profiles and cases match
[${baselineRevision[0]}](../${baselineRevision[0]}/README.md).

Generate with \`node scripts/build-node-everyday.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/node-everyday.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`;

// Each command lists the argv rules naming its executable, new rules included.
export async function nodeEverydayCommands() {
  const [pack, inventory] = [await nodeEverydayPack(), await read('node', nodeRevision[0], 'commands.json')];
  for (const command of inventory.commands) for (const entry of pack.rules) {
    const executable = entry.conditions.executable;
    if (entry.conditions.domain === 'argv' && (executable === command.name || executable?.one_of?.includes(command.name))
      && !command.rule_ids.includes(entry.id)) command.rule_ids.push(entry.id);
  }
  return inventory;
}

export async function buildNodeEveryday() {
  for (const [name, [previous, version], pack, cases, commands, readme] of [
    ['node', nodeRevision, nodeEverydayPack, nodeEverydayCases, nodeEverydayCommands, nodeReadme],
    ['baseline', baselineRevision, baselineScriptFallbackPack, async () => (await read('baseline', baselineRevision[0], 'cases.json')).cases,
      () => read('baseline', baselineRevision[0], 'commands.json'), baselineReadme],
  ]) {
    const output = directory(name, version);
    await mkdir(output, {recursive: true});
    await writeFile(new URL('pack.yml', output), JSON.stringify(await pack(), null, 2) + '\n');
    await writeFile(new URL('cases.json', output), JSON.stringify({schema_version: 1, cases: await cases()}, null, 2) + '\n');
    await writeFile(new URL('commands.json', output), JSON.stringify(await commands(), null, 2) + '\n');
    await copyFile(new URL('LICENSE', directory(name, previous)), new URL('LICENSE', output));
    await writeFile(new URL('README.md', output), readme);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildNodeEveryday();
