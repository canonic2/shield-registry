// Published packs are immutable; command-position matching gets a new release.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/node/0.3.0/', import.meta.url);
export const destination = new URL('../packs/canonic/node/0.3.1/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const verbs = ['login', 'adduser', 'logout', 'token', 'config', 'set', 'get', 'profile'];
const leading = {
  flags: ['--json', '--parseable', '--long', '--silent', '-s', '--verbose', '--quiet', '-q', '--timing', '-g', '--global', '--workspaces'],
  values: ['--prefix', '--workspace', '-w', '--userconfig', '--globalconfig', '--registry', '--location', '--loglevel'].map(name => ({name, match: {regex: '.+'}})),
};

export async function commandReviewPack() {
  const pack = await read('pack.yml');
  pack.version = '0.3.1';
  pack.capabilities = [...pack.capabilities, 'prefix-leading-v1'].sort();
  for (const rule of pack.rules) {
    if (!rule.id.endsWith('npm-credentials-config')) continue;
    const prefix = rule.conditions.arguments.prefix;
    rule.conditions.arguments = {kind: 'prefix', values: [...prefix, {one_of: verbs}], leading};
  }
  // Manifest edits do not execute their script values. Unknown options still ask.
  const executable = pack.rules.find(rule => rule.id === 'npm-inspect-project').conditions.executable;
  const corepack = pack.rules.find(rule => rule.id === 'corepack-npm-npm-credentials-config').conditions.executable;
  for (const [verb, min, max, regex] of [
    ['get', 0, 32, '[^-].*'], ['set', 1, 32, '[^-=][^=]*=.*'],
    ['delete', 1, 32, '[^-].*'], ['fix', 0, 0, '[^-].*'],
  ]) {
    for (const wrapped of [false, true]) {
      pack.rules.push({id: `${wrapped ? 'corepack-npm-' : ''}npm-pkg-${verb}`,
        conditions: {domain: 'argv', executable: wrapped ? corepack : executable,
          cwd: {within: {root: 'project'}},
          arguments: {kind: 'options', prefix: [...(wrapped ? ['npm'] : []), 'pkg', verb],
            flags: ['--json'], values: [], operands: max ? {match: {regex}, min, max} : false}},
        decision: {loose: 'allow', recommended: 'allow', strict: 'ask'},
        reason: 'Read or edit the local package manifest without executing package scripts.'});
    }
  }
  return pack;
}

export async function commandReviewCases() {
  const cases = {...await read('cases.json'), cases: []};
  const fixtures = [
    ['pkg-set-script', ['npm', 'pkg', 'set', 'scripts.lint=oxlint && oxfmt --check'], 'routine'],
    ['pkg-get-script', ['npm', 'pkg', 'get', 'scripts'], 'routine'],
    ['pkg-delete-script', ['npm', 'pkg', 'delete', 'scripts.lint'], 'routine'],
    ['pkg-fix', ['npm', 'pkg', 'fix'], 'routine'],
    ['corepack-pkg-set', ['corepack', 'npm', 'pkg', 'set', 'scripts.lint=oxlint'], 'routine'],
    ['script-called-get', ['npm', 'run', 'get'], 'ask'],
    ['script-called-config', ['npm', 'run', 'config'], 'ask'],
    ['dependency-called-config', ['npm', 'install', 'config'], 'dependency'],
    ['tag-alias-set', ['npm', 'dist-tag', 'set', 'acme@1', 'latest'], 'review'],
    ['credentials-alias-get', ['npm', 'get', '//registry.example.com/:_authToken'], 'protected'],
    ['credentials-alias-set', ['npm', 'set', 'registry=https://registry.example.com'], 'protected'],
    ['credentials-json-config', ['npm', '--json', 'config', 'get'], 'protected'],
    ['corepack-credentials-get', ['corepack', 'npm', 'get', 'registry'], 'protected'],
    ['pkg-override', ['npm', '--userconfig', 'alternate.npmrc', 'pkg', 'get', 'scripts'], 'review'],
  ];
  const decisions = {routine: {loose: 'allow', recommended: 'allow', strict: 'ask'},
    dependency: {loose: 'allow', recommended: 'ask', strict: 'deny'},
    protected: {loose: 'ask', recommended: 'deny', strict: 'deny'},
    review: {loose: 'ask', recommended: 'ask', strict: 'deny'}};
  // Historical fixtures run separately against this pack in the test runner.
  for (const [name, argv, kind] of fixtures) for (const profile of ['loose', 'recommended', 'strict']) {
    cases.cases.push({name: `${name}-${profile}`, profile, argv, expected: decisions[kind]?.[profile] ?? kind});
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await commandReviewPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await commandReviewCases(), null, 2) + '\n');
  const commands = await read('commands.json');
  for (const command of commands.commands) {
    command.rule_ids = pack.rules.filter(rule => rule.conditions.executable.one_of.includes(command.name)).map(rule => rule.id);
  }
  await writeFile(new URL('commands.json', destination), JSON.stringify(commands, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Node permissions 0.3.1

Supports Shield \`${pack.engines.shield}\`.

Credential commands match the npm command position, so script or dependency
names such as \`get\`, \`set\` and \`config\` do not become credential operations.
Direct npm credential/configuration commands and their Corepack forms retain
their profile decisions. Recognized leading npm options retain those checks;
unlisted forms require review.

Local \`npm pkg get/set/delete/fix\` operations allow in Loose and Recommended
and ask in Strict. They inspect or edit package.json without executing scripts.
Corepack npm forms have the same policy. Project scripts, dependency additions,
and execution/configuration overrides retain their existing review boundaries.

Generate with \`node scripts/build-node-command-review.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/node-command-review.test.mjs\`.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
