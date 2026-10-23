// Layer everyday lookups, piped text tools, project builds and secret-dump
// denials over the immutable 0.4.0 release.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { append } from './usable-cases.mjs';

const previous = new URL('../packs/canonic/baseline/0.4.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.5.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

const bins = (...names) => ({ one_of: names.flatMap(name => [name, `/bin/${name}`, `/usr/bin/${name}`]) });
const profiles = (loose, recommended, strict) => ({ loose, recommended, strict });
const always = decision => profiles(decision, decision, decision);
const local = profiles('allow', 'allow', 'ask');
const rule = (id, executable, args, decision, extra = {}) =>
  ({ id, conditions: { domain: 'argv', executable, arguments: args }, decision, ...extra });
const options = (flags, values = [], operands = true) => ({ kind: 'options', prefix: [], flags, values, operands });
const value = (name, regex) => (regex ? { name, match: { regex } } : name);

const digits = '[0-9]+';
/** A relative path whose segments never start with `.`, so no `..` or hidden folders. */
export const relative = String.raw`[A-Za-z0-9_-][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_-][A-Za-z0-9_.-]*)*/?`;
const word = '[^-].*';

// Subcommands that build, check, test, format or run the project itself.
const cargo = ['build', 'b', 'check', 'c', 'test', 't', 'run', 'r', 'bench', 'clippy', 'fmt', 'doc', 'd',
  'tree', 'metadata', 'nextest', 'llvm-cov', 'clean', 'fix', 'insta', 'deny'];
const go = ['build', 'test', 'vet', 'fmt', 'run', 'list', 'doc', 'generate'];
const npm = ['run', 'run-script', 'test', 't', 'start', 'ls', 'list', 'outdated', 'explain', 'why'];
const scripts = ['run', 'test', 't', 'start', 'ls', 'list', 'why', 'outdated',
  'build', 'lint', 'typecheck', 'format', 'check', 'dev'];
const choose = list => ({ one_of: list });
const prefix = (...values) => ({ kind: 'prefix', values });
const projectTools = ['tsc', 'eslint', 'prettier', 'biome', 'vitest', 'jest', 'pytest', 'mypy', 'ruff', 'black',
  'rustfmt', 'gofmt'];

export const added = [
  // Lookups that print names, identities or path facts and read no file contents.
  rule('lookup', bins('test', '[', 'type', 'which', 'whoami', 'id', 'groups', 'realpath', 'readlink', 'lsof',
    'expr', 'uptime', 'sw_vers', 'arch', 'nproc', 'tty', 'locale'), { kind: 'any' }, always('allow')),
  rule('hostname-read', bins('hostname'), options(['-s', '-f', '-d', '-i', '-I', '-A', '--short', '--fqdn'], [], false),
    always('allow')),
  rule('seq', bins('seq'), options(['-w'], ['-s', '-f'], { match: { regex: String.raw`[0-9]+(?:\.[0-9]+)?` }, min: 1, max: 3 }),
    always('allow')),
  rule('space-du', bins('du'), options(['-a', '-c', '-h', '-H', '-k', '-m', '-s', '-x'],
    [value('-d', digits), value('--max-depth', digits)]), always('allow')),
  rule('metadata-stat', bins('stat'), options(['-L', '-l', '-n', '-q', '-r', '-s', '-x', '--dereference', '--terse'],
    ['-f', '-c', '--format', '--printf']), always('allow')),
  rule('type-file', bins('file'), options(['-b', '-i', '-I', '-k', '-L', '-h', '-N', '-n', '-r', '-s', '--brief',
    '--mime', '--mime-type', '--mime-encoding', '--dereference', '--no-dereference']), always('allow')),
  rule('list-tree', bins('tree'), options(['-a', '-d', '-f', '-i', '-l', '-s', '-h', '-D', '-F', '-C', '-n', '-p', '-u',
    '-g', '-q', '-N', '-r', '-t', '-v', '-x', '-J', '-X', '--dirsfirst', '--noreport', '--du', '--si', '--gitignore'],
  [value('-L', digits), '-I', '-P', value('--filelimit', digits), '--charset']), always('allow')),
  // Text tools on standard input; file operands wait for Shield path models.
  rule('stdin-nl', bins('nl'), options([], ['-b', '-d', '-f', '-h', '-i', '-n', '-s', '-v', '-w'], false), always('allow')),
  rule('stdin-column', bins('column'), options(['-t', '-x'], ['-s', value('-c', digits), '-o'], false), always('allow')),
  rule('stdin-paste', bins('paste'), options(['-s'], ['-d'], { match: { regex: '-' }, min: 0, max: 8 }), always('allow')),
  rule('stdin-bc', bins('bc'), options(['-l', '-q', '-s', '-w', '--mathlib', '--quiet'], [], false), always('allow')),
  // Secret and system-identity changes stay blocked.
  rule('deny-printenv', bins('printenv'), { kind: 'any' }, always('deny')),
  rule('deny-env-dump', bins('env'), options(['-0', '--null', '-i', '--ignore-environment'], ['-u', '--unset'], false),
    always('deny')),
  rule('deny-keychain-secrets', bins('security'),
    prefix(choose(['find-generic-password', 'find-internet-password', 'dump-keychain', 'export'])), always('deny')),
  rule('deny-gh-auth-token', bins('gh'), prefix('auth', 'token'), always('deny')),
  rule('deny-hostname-set', bins('hostname'), { kind: 'sequence', prefix: [{ regex: word }], rest: { kind: 'any' } },
    always('deny')),
  // Building, checking and testing the project runs its own code, which the
  // agent can already edit. Installs, publishing and package downloads keep review.
  rule('build-cargo', bins('cargo'), prefix(choose(cargo)), local),
  rule('build-cargo-toolchain', bins('cargo'), prefix({ regex: String.raw`\+[A-Za-z0-9._-]+` }, choose(cargo)), local),
  rule('build-go', bins('go'), prefix(choose(go)), local),
  rule('build-go-mod', bins('go'), prefix('mod', choose(['tidy', 'download', 'verify', 'graph', 'why'])), local),
  rule('build-make', bins('make'), {
    kind: 'options', prefix: [],
    flags: ['-k', '-s', '-n', '-B', '-q', '-w', '--keep-going', '--silent', '--quiet', '--dry-run', '--always-make',
      '--no-print-directory'],
    values: [value('-j', digits), value('--jobs', digits), value('-C', relative), value('--directory', relative)],
    operands: { match: { regex: String.raw`[A-Za-z0-9_][A-Za-z0-9_./+-]*|[A-Za-z_][A-Za-z0-9_]*=.*` }, min: 0, max: 256 },
  }, local),
  rule('scripts-npm', bins('npm'), prefix(choose(npm)), local),
  rule('scripts-npm-prefix', bins('npm'), prefix('--prefix', { regex: relative }, choose(npm)), local),
  rule('scripts-npm-prefix-attached', bins('npm'), prefix({ regex: `--prefix=${relative}` }, choose(npm)), local),
  rule('scripts-npm-workspace', bins('npm'), prefix(choose(['-w', '--workspace']), { regex: word }, choose(npm)), local),
  rule('scripts-npm-workspace-attached', bins('npm'), prefix({ regex: '--workspace=.+' }, choose(npm)), local),
  rule('scripts-npm-workspaces', bins('npm'), prefix(choose(['-ws', '--workspaces']), choose(npm)), local),
  rule('scripts-pnpm-yarn', bins('pnpm', 'yarn'), prefix(choose(scripts)), local),
  rule('scripts-pnpm-dir', bins('pnpm'), prefix(choose(['--dir', '-C']), { regex: relative }, choose(scripts)), local),
  rule('scripts-pnpm-dir-attached', bins('pnpm'), prefix({ regex: `--dir=${relative}` }, choose(scripts)), local),
  rule('scripts-pnpm-filter', bins('pnpm'), prefix(choose(['--filter', '-F']), { regex: word }, choose(scripts)), local),
  rule('scripts-pnpm-filter-attached', bins('pnpm'), prefix({ regex: '--filter=.+' }, choose(scripts)), local),
  rule('scripts-pnpm-recursive', bins('pnpm'), prefix(choose(['-r', '--recursive']), choose(scripts)), local),
  rule('scripts-yarn-cwd', bins('yarn'), prefix('--cwd', { regex: relative }, choose(scripts)), local),
  rule('scripts-yarn-workspace', bins('yarn'), prefix('workspace', { regex: word }, choose(scripts)), local),
  rule('project-tools', bins(...projectTools), { kind: 'any' }, local),
];

const changedFallbacks = {
  'shared-review-npm': 'Installs, publishing, exec and unlisted package-manager commands download or run code outside the project scripts.',
  'shared-review-uv': 'Installs, publishing, uv run and unlisted subcommands download or run code outside the project build.',
  'review-make': 'Make with another makefile, an outside directory or unlisted options needs review.',
};

export async function everydayPack() {
  const pack = await read('pack.yml');
  pack.version = '0.5.0';
  pack.engines = { shield: '>=0.1.13, <0.3.0' };
  pack.description = 'Everyday commands, project builds and tests, and local file operations within approved paths; secret dumps, privilege and destructive system operations denied.';
  for (const [id, reason] of Object.entries(changedFallbacks)) pack.rules.find(rule => rule.id === id).reason = reason;
  pack.rules.push(...structuredClone(added));
  return pack;
}

const base = name => name.slice(name.lastIndexOf('/') + 1);

export async function everydayCommands() {
  const commands = await read('commands.json');
  for (const { id, conditions } of added) {
    for (const name of new Set(conditions.executable.one_of.map(base))) {
      let entry = commands.commands.find(command => command.name === name);
      if (!entry) commands.commands.push(entry = { name, rule_ids: [], source_rule_ids: [] });
      entry.rule_ids.push(id);
      entry.source_rule_ids.push(id);
    }
  }
  commands.commands.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return commands;
}

// Independent expectations; these do not read the generated rules.
export const lookups = [
  ['test-file', ['test', '-f', 'README.md']], ['bracket-test', ['[', '-d', 'scripts', ']']],
  ['type', ['type', 'rg']], ['which', ['which', 'node']], ['whoami', ['whoami']], ['id', ['id', '-u']],
  ['hostname', ['hostname']], ['hostname-short', ['hostname', '-s']], ['realpath', ['realpath', 'README.md']],
  ['readlink', ['readlink', '-f', 'README.md']], ['lsof-port', ['lsof', '-i', ':3000']],
  ['du-summary', ['du', '-sh', 'scripts']], ['du-depth', ['du', '-d', '1', '-h', '.']],
  ['stat', ['stat', 'README.md']], ['stat-format', ['stat', '-f', '%z', 'README.md']],
  ['file', ['file', 'README.md']], ['tree-depth', ['tree', '-L', '2', 'scripts']],
  ['tree-ignore', ['tree', '-a', '-I', 'node_modules']], ['nl-stdin', ['nl', '-ba']],
  ['column-stdin', ['column', '-t', '-s', ',']], ['paste-stdin', ['paste', '-sd,', '-']], ['bc-stdin', ['bc', '-l']],
  ['seq', ['seq', '1', '10']], ['expr', ['expr', '1', '+', '2']], ['uptime', ['uptime']], ['nproc', ['nproc']],
];
export const builds = [
  ['cargo-test', ['cargo', 'test', '--locked']], ['cargo-clippy', ['cargo', 'clippy', '--all-targets', '--', '-D', 'warnings']],
  ['cargo-toolchain', ['cargo', '+nightly', 'fmt']], ['cargo-nextest', ['cargo', 'nextest', 'run']],
  ['go-test', ['go', 'test', './...']], ['go-mod-tidy', ['go', 'mod', 'tidy']],
  ['make-default', ['make']], ['make-target', ['make', 'build']], ['make-directory', ['make', '-C', 'packages/shield', 'build']],
  ['make-jobs', ['make', '-j8', 'test']], ['make-variable', ['make', 'test-focus', 'FILTER=acme']],
  ['npm-test', ['npm', 'test']], ['npm-run-args', ['npm', 'run', 'build', '--', '--watch']],
  ['npm-prefix', ['npm', '--prefix', 'packages/site', 'run', 'build']], ['npm-workspace', ['npm', '-w', 'acme', 'test']],
  ['pnpm-test', ['pnpm', 'test']], ['pnpm-dir', ['pnpm', '--dir', 'packages/workbench', 'test']],
  ['pnpm-dir-attached', ['pnpm', '--dir=packages/workbench', 'run', 'check']], ['pnpm-recursive', ['pnpm', '-r', 'build']],
  ['pnpm-filter', ['pnpm', '--filter', 'acme', 'lint']], ['yarn-test', ['yarn', 'test']],
  ['yarn-workspace', ['yarn', 'workspace', 'acme', 'build']], ['yarn-cwd', ['yarn', '--cwd', 'packages/site', 'dev']],
  ['tsc', ['tsc', '--noEmit']], ['eslint', ['eslint', '.']], ['vitest', ['vitest', 'run']], ['pytest', ['pytest', '-q']],
];
export const denied = [
  ['printenv', ['printenv']], ['printenv-name', ['printenv', 'AWS_SECRET_ACCESS_KEY']], ['env-dump', ['env']],
  ['env-null-dump', ['env', '-0']], ['hostname-set', ['hostname', 'acme-host']],
  ['keychain-password', ['security', 'find-generic-password', '-s', 'acme', '-w']],
  ['keychain-dump', ['security', 'dump-keychain']], ['gh-token', ['gh', 'auth', 'token']],
];
export const reviewed = [
  ['cargo-install', ['cargo', 'install', 'ripgrep']], ['cargo-publish', ['cargo', 'publish']],
  ['cargo-add', ['cargo', 'add', 'serde']], ['cargo-global-config', ['cargo', '--config', 'acme', 'build']],
  ['go-install', ['go', 'install', 'example.com/acme@latest']], ['go-get', ['go', 'get', 'example.com/acme']],
  ['npm-install', ['npm', 'install']], ['npm-ci', ['npm', 'ci']], ['npm-publish', ['npm', 'publish']],
  ['npm-exec', ['npm', 'exec', 'acme']], ['npm-prefix-outside', ['npm', '--prefix', '../other', 'test']],
  ['pnpm-add', ['pnpm', 'add', 'acme']], ['pnpm-install', ['pnpm', 'install']], ['pnpm-exec', ['pnpm', 'exec', 'acme']],
  ['pnpm-dlx', ['pnpm', 'dlx', 'acme']], ['pnpm-dir-parent', ['pnpm', '--dir', '../other', 'test']],
  ['pnpm-dir-absolute', ['pnpm', '--dir', '/shield-baseline-unapproved', 'test']], ['yarn-add', ['yarn', 'add', 'acme']],
  ['make-parent', ['make', '-C', '../other', 'build']], ['make-absolute', ['make', '-C', '/shield-baseline-unapproved']],
  ['make-makefile', ['make', '-f', 'other.mk']], ['uv-run', ['uv', 'run', 'pytest']],
  ['tree-output', ['tree', '-o', 'out.txt']], ['tree-file-list', ['tree', '--fromfile', 'list.txt']],
  ['nl-file', ['nl', 'README.md']], ['column-file', ['column', '-t', 'README.md']], ['comm-files', ['comm', 'a.txt', 'b.txt']],
  ['bc-file', ['bc', 'calc.bc']], ['file-decompress', ['file', '-z', 'archive.gz']], ['file-magic', ['file', '-m', 'magic', 'README.md']],
  ['du-file-list', ['du', '--files0-from=list']], ['hostname-file', ['hostname', '-F', 'name.txt']],
  ['open-url', ['open', 'https://example.com']], ['chmod', ['chmod', '+x', 'script.sh']], ['ln', ['ln', '-s', 'a', 'b']],
  ['tee', ['tee', 'out.txt']], ['less', ['less', 'README.md']], ['node-script', ['node', 'script.mjs']],
];

export async function everydayCases() {
  const cases = await read('cases.json');
  for (const fixture of cases.cases) {
    const index = ['loose', 'recommended', 'strict'].indexOf(fixture.profile);
    // Project builds allow like other local work.
    if (fixture.name.startsWith('build-') && fixture.argv.join(' ') === 'cargo build') fixture.expected = ['allow', 'allow', 'ask'][index];
  }
  append(cases.cases, lookups, ['allow', 'allow', 'allow']);
  append(cases.cases, builds, ['allow', 'allow', 'ask']);
  append(cases.cases, denied, ['deny', 'deny', 'deny']);
  append(cases.cases, reviewed, ['ask', 'ask', 'ask']);
  return cases;
}

export async function build(output = destination) {
  await mkdir(output, { recursive: true });
  const pack = await everydayPack();
  const cases = await everydayCases();
  await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', output), JSON.stringify(cases, null, 2) + '\n');
  await writeFile(new URL('commands.json', output), JSON.stringify(await everydayCommands(), null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', output));
  await writeFile(new URL('README.md', output), guide(pack.rules.length, cases.cases.length));
}

const guide = (rules, fixtures) => `# Baseline permissions 0.5.0

Everyday commands, project builds and tests, and local file operations within
approved paths. Harmful forms are denied rather than left for review: secret and
environment dumps, privilege escalation, device and system administration, and
known destructive cloud/container commands. Requires Shield 0.1.13 or later
within the 0.1 and 0.2 series. The pack stores ${rules} rules.

## Everyday reads and lookups

These forms allow under all three profiles:

\`\`\`sh
rg -n PATTERN src
rg --files --hidden -g '!.git'
sed -n '1,200p' README.md
sed 's/token/<redacted>/g' config.json
awk -F: '{print $1, $2}' input.txt
jq -r '.name' package.json
sort -rn input.txt
diff -u before.txt after.txt
test -f README.md && echo present
type rg; which node; whoami; id -u; hostname -s
realpath src; readlink -f link
du -sh src; stat README.md; file README.md; df -h
tree -L 2 -I node_modules
lsof -i :3000
cat data.csv | column -t -s,
cat list.txt | paste -sd, -
seq 1 10; expr 1 + 2; echo '2^10' | bc -l
\`\`\`

Sed supports \`p\`, \`d\`, \`y\` and \`s\` scripts with line addresses/ranges, including \`$\`, using \`/\`, \`|\` or \`#\` delimiters, and \`r\` reads of named files within the read roots. Awk supports print statements
of numeric fields. Jq supports field/index selection and pipelines through keys,
keys_unsorted, length, type, sort, unique, values and tostring. Text filters can
also read standard input in pipelines. Inputs must be regular files within the
approved read roots; contained symlinks receive the same path checks.

\`nl\`, \`column\`, \`paste\` and \`bc\` allow on standard input. With file
operands they, \`comm\` and the \`less\`/\`more\` pagers ask until Shield can check
their paths; read the file with \`cat\` and pipe it instead. \`tree\` options that
write or read lists (\`-o\`, \`--fromfile\`), \`file -z\`/\`-m\` and unlisted
\`du\`/\`stat\` options ask.

Ambient tool configuration is trusted. \`rg --no-config\` is optional. Submitted
program files, helper execution, environment expressions, other file loading
and output-file options need review. These are scoped read forms,
not general permission to execute awk/sed programs or arbitrary jq filters.

Credential directories, outside paths and Shield's private state remain protected.
Ripgrep honors ignore files and globs in bounded approved directories. Its native
content check examines at most 1,024 metadata entries and 32 levels; narrow an
ambiguous search. Filename listings accept \`--hidden\` and skip that content check. Explicit \`--hidden\` content searches remain outside the supported model. Explicit protected
state access remains blocked.

## Builds, checks and tests

Building, checking, formatting and testing the project run its own code, which
the agent can already edit. These allow in Loose/Recommended and ask in Strict:

\`\`\`sh
cargo build; cargo test --locked; cargo +nightly fmt; cargo clippy -- -D warnings
go test ./...; go vet ./...; go mod tidy
make; make -j8 test; make -C packages/acme build; make test-focus FILTER=acme
npm test; npm run build -- --watch; npm --prefix packages/site run build; npm -w acme test
pnpm test; pnpm --dir packages/site run check; pnpm -r build; pnpm --filter acme lint
yarn test; yarn workspace acme build; yarn --cwd packages/site dev
tsc --noEmit; eslint .; prettier --check .; vitest run; jest; pytest -q; ruff check
\`\`\`

Cargo covers build, check, test, run, bench, clippy, fmt, doc, tree, metadata,
nextest, llvm-cov, clean, fix, insta and deny. Go covers build, test, vet, fmt,
run, list, doc, generate and \`mod tidy/download/verify/graph/why\`. npm covers
run, test, start, ls, outdated and explain; pnpm and yarn cover run, test, start,
ls, why, outdated and the build, lint, typecheck, format, check and dev scripts.
Directory options (\`make -C\`, \`npm --prefix\`, \`pnpm --dir\`, \`yarn --cwd\`)
must name relative folders without \`..\` or hidden segments.

Dependency installs and additions, publishing, \`npm exec\`, \`pnpm exec\`/\`dlx\`,
\`npx\`, \`uv run\`, \`cargo install\`, \`go install\`/\`get\`, other makefiles and
global tool options before the subcommand keep review. Interpreters (\`node\`,
\`python3\`, \`bun\`, shells) keep review: Shield asks for them before policy.

## Edits and other operations

Sed edits files in place with \`sed -i '' SCRIPT FILE\`, GNU \`sed -i SCRIPT FILE\`
or \`--in-place\`, and writes named files with \`w\`, \`W\` or the \`w\` flag. Edited and
written files must be within the approved write roots and outside \`.git\` and
Shield's review state; inputs follow the read rules. These allow in
Loose/Recommended and ask in Strict. Backup suffixes, other delimiters, regex
addresses, blocks and \`e\` need review.

Approved local file writes, moves and removals allow in Loose/Recommended and ask
in Strict. Read/write roots, \`.git\` and Shield's review state and cache remain excluded.
Agent settings and Shield policy files are left to Shield's own protected-path
guard and the operator's \`shield protection\` choice, so other files under
\`.claude/\` and similar folders follow these rules.
Recursive copies, unknown mutation options and unresolved targets remain blocked
where containment cannot be established. \`chmod\`, \`chown\`, \`ln\` and \`tee\` ask
until Shield can check their targets. Network/cloud operations, \`open\`,
unlisted helpers and unknown operations retain their review paths.

## Denied

These deny under every profile:

\`\`\`sh
printenv; env; env -0                     # environment dumps
security find-generic-password -w ...     # keychain secrets
gh auth token
hostname NEW-NAME
sudo ...; su; doas ...
dd ...; mkfs ...; diskutil ...; mount ...; shutdown ...
docker system prune; kubectl delete ...; terraform destroy; aws s3 rm ...
\`\`\`

See the [usability review](https://github.com/canonic2/shield-registry/blob/main/docs/usability-review.md) for decisions and
remaining boundaries, and [commands.json](commands.json) for the rule inventory.

## Validation

\`node scripts/build-baseline-everyday.mjs\` reproduces this release from 0.4.0.
All ${fixtures} decision fixtures run through production Shield.
Historical releases remain immutable. Licensed under MIT.
`;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
