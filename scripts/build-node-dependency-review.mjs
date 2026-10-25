// Published releases are immutable. Prepare a new source release in which the
// recommended profile asks before an agent adds or updates dependencies. An
// install of what the manifest and lockfile already declare stays allowed:
// a person chose and committed those packages.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/node/0.2.0/', import.meta.url);
export const destination = new URL('../packs/canonic/node/0.3.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

// Each verb group becomes its own rule; operand counts keep the declared
// install and the added packages apart, since both rules rank alike.
const groups = [
  {suffix: '', verbs: ['install', 'i', 'ci'], operands: 'none',
    reason: 'Install the dependencies the manifest and lockfile already declare. Lifecycle scripts run; --ignore-scripts does not establish full execution containment.'},
  {suffix: '-add', verbs: ['install', 'i', 'add'], operands: 'some', review: true,
    reason: 'Adding dependencies downloads packages chosen by name and can run their code.',
    message: 'Adding dependencies downloads packages chosen by name and can run their code during install or on first import; the user confirms the package names.'},
  {suffix: '-update', verbs: ['update', 'upgrade', 'up'], operands: 'any', review: true,
    reason: 'Updating dependencies moves them to newer published releases and can run their code.',
    message: 'Updating dependencies moves them to newer published releases, which can run code during install or on first import; the user confirms the update.'},
  {suffix: '-remove', verbs: ['uninstall', 'remove', 'rebuild'], operands: 'any',
    reason: 'Remove or rebuild declared dependencies. Lifecycle scripts run; --ignore-scripts does not establish full execution containment.'},
];

const installRule = rule => rule.id.endsWith('-install') && rule.conditions.arguments?.kind === 'options'
  && rule.conditions.arguments.prefix.at(-1)?.one_of?.includes('install');

function split(rule) {
  const verbs = rule.conditions.arguments.prefix.at(-1).one_of;
  return groups.flatMap(group => {
    const chosen = verbs.filter(verb => group.verbs.includes(verb));
    if (chosen.length === 0) return [];
    const copy = structuredClone(rule);
    copy.id += group.suffix;
    const args = copy.conditions.arguments;
    args.prefix[args.prefix.length - 1] = {one_of: chosen};
    if (group.operands === 'none') args.operands = false;
    if (group.operands === 'some') args.operands = {...args.operands, min: 1};
    copy.reason = group.reason;
    if (group.review) {
      copy.decision = {...copy.decision, recommended: 'ask'};
      copy.guidance = {message: group.message};
    }
    return [copy];
  });
}

export async function dependencyReviewPack() {
  const pack = await read('pack.yml');
  pack.version = '0.3.0';
  pack.rules = pack.rules.flatMap(rule => installRule(rule) ? split(rule) : [rule]);
  return pack;
}

// Recommended fixtures that add named packages now ask.
const adding = new Set(['install-express', 'install-ignore-scripts', 'install-dev', 'pnpm-add', 'yarn-add', 'corepack-npm-install']);
export async function dependencyReviewCases() {
  const cases = await read('cases.json');
  for (const fixture of cases.cases) {
    if (fixture.profile === 'recommended' && adding.has(fixture.name.replace(/-recommended$/, ''))) fixture.expected = 'ask';
  }
  // Fixtures hold at most 1024 cases. Only the recommended profile changes;
  // the loose and strict cases above keep covering the other two.
  const added = [
    ['dependency-install-declared', ['npm', 'install'], 'allow'],
    ['dependency-install-declared-flag', ['npm', 'install', '--no-audit'], 'allow'],
    ['dependency-add-named', ['npm', 'install', '-D', 'oxlint'], 'ask'],
    ['dependency-add-pnpm', ['pnpm', 'add', 'oxlint'], 'ask'],
    ['dependency-update-all', ['npm', 'update'], 'ask'],
    ['dependency-update-named', ['pnpm', 'update', 'express'], 'ask'],
    ['dependency-update-yarn', ['yarn', 'up', 'express'], 'ask'],
    ['dependency-uninstall', ['npm', 'uninstall', 'express'], 'allow'],
    ['dependency-workspace-add', ['npm', '-w', '@acme/web', 'install', 'oxlint'], 'ask'],
  ];
  for (const [name, argv, expected] of added) {
    cases.cases.push({name: `${name}-recommended`, profile: 'recommended', argv, expected});
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await dependencyReviewPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await dependencyReviewCases(), null, 2) + '\n');
  const ids = new Set(pack.rules.map(rule => rule.id));
  const commands = await read('commands.json');
  for (const command of commands.commands) {
    command.rule_ids = command.rule_ids.flatMap(id => ids.has(id) ? [id, ...groups.slice(1).map(g => id + g.suffix).filter(next => ids.has(next))] : groups.map(g => id + g.suffix).filter(next => ids.has(next)));
  }
  await writeFile(new URL('commands.json', destination), JSON.stringify(commands, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Node permissions 0.3.0

Supports Shield \`${pack.engines.shield}\`.

The recommended profile asks before dependencies change by name or version:
\`npm install NAME\`, \`npm i NAME\`, \`pnpm add NAME\`, \`yarn add NAME\` and the
\`update\`, \`upgrade\` and \`up\` commands, in every npm, pnpm, Yarn and Corepack
form. Those commands download packages an agent chose and can run their code
during install or on first import. Installing what \`package.json\` and the
lockfile already declare (\`npm install\`, \`npm ci\`, \`pnpm install\`,
\`yarn install\`) stays allowed, as do \`uninstall\`, \`remove\` and \`rebuild\`.
The loose profile allows all of them and the strict profile denies them, as in
0.2.0.

Each earlier install rule is split by command: the declared install keeps its
identity, and \`-add\`, \`-update\` and \`-remove\` rules cover the rest. Other
rules, profiles and cases match [0.2.0](../0.2.0/README.md); the recommended
cases that add named packages now expect Ask.

Generate with \`node scripts/build-node-dependency-review.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/node-dependency-review.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
