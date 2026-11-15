// Published releases are immutable. Prepare a source release that allows
// everyday read-only commands by default and keeps Ask/Deny for known-harmful
// forms: ripgrep is decided by the paths it reads, not by a closed option list;
// jq filters that read only their input are allowed; and process, clock,
// PostgreSQL readiness and Docker listings that print no command arguments,
// credentials or container output are allowed.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/baseline/0.13.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.14.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const profiles = ['loose', 'recommended', 'strict'];
const every = decision => Object.fromEntries(profiles.map(profile => [profile, decision]));
const executable = name => ({one_of: [name, `/bin/${name}`, `/usr/bin/${name}`]});
const words = list => list.split(' ');
const options = (prefix, flags, values, operands = false, extra = {}) => ({kind: 'options', prefix, flags: words(flags),
  values: values.map(([name, regex]) => ({name, match: {regex}})), operands, ...extra});
const allow = (id, command, arguments_, reason) => ({id, conditions: {domain: 'argv', executable: executable(command), arguments: arguments_},
  decision: every('allow'), reason});

// Process fields without the command line or environment: names, IDs, states,
// times and resource use only.
const field = '(?:pid|ppid|pgid|sess|uid|gid|user|ruser|comm|ucomm|stat|state|etime|etimes|time|pcpu|%cpu|pmem|%mem|rss|vsz|lstart|start|nice|pri|tty|tt|wchan)=?';
const fields = `${field}(?:[, \\t]+${field})*`;
const pids = '[1-9][0-9]*(?:,[1-9][0-9]*)*';
const names = '[A-Za-z0-9_.-]+(?:,[A-Za-z0-9_.-]+)*';
const any = '.+';
const count = '[0-9]+';

export const changedRules = ['read-rg'];
// rg --version is already allowed by shared-git-version.
const information = {'rg-short-version': '-V', 'rg-help': '--help', 'rg-short-help': '-h', 'rg-type-list': '--type-list', 'rg-pcre2-version': '--pcre2-version'};
export const addedRules = {
  rg: Object.keys(information),
  ps: ['process-fields'],
  date: ['date-options'],
  pgrep: ['process-lookup'],
  pg_isready: ['postgres-ready'],
  docker: ['docker-containers', 'docker-images', 'docker-compose-status', 'docker-listings', 'docker-version'],
  jq: ['read-jq-filters', 'stdin-jq-filters', 'stdin-jq-variables'],
};
// jq on standard input reads nothing else unless its filter names the
// environment, a module or program paths; data-only builtins are harmless.
const jqEffects = '(?s:.*(?:\\benv\\b|\\$ENV\\b|\\$__prog|\\binclude\\b|\\bimport\\b|\\bmodulemeta\\b|\\bget_search_list\\b|\\bget_jq_origin\\b|\\bget_prog_origin\\b|\\binput_filename\\b).*)';
const jqFlags = '-r -c -e -S -M -C -a -s -R -n -j --raw-output --compact-output --exit-status --sort-keys --monochrome-output --color-output --ascii-output --slurp --raw-input --null-input --join-output --tab --seq --stream';
const jqFilter = count => ({match: {not: {regex: jqEffects}}, min: count, max: count});
// Added rules whose Allow requires Shield to verify the paths they read.
export const pathCheckedRules = ['read-jq-filters'];

function rules(targets) {
  return [
    // Shield's jq model accepts filters that read only their input and files in
    // approved paths. The path check is a condition: an unverified filter or
    // file leaves this rule out, so piped filters reach the rules below and the
    // rest ask as unmatched. read-jq still refuses its protected files.
    {id: 'read-jq-filters', conditions: {domain: 'argv', executable: executable('jq'), arguments: {kind: 'any'}, targets},
      decision: every('allow'), reason: 'Run jq filters that read only their input and files in approved paths.'},
    // One operand: the filter, with no file. Shield cannot count a two-word
    // option, so a single --arg/--argjson VALUE is the extra operand below.
    allow('stdin-jq-filters', 'jq', options([], jqFlags, [['--indent', count]], jqFilter(1)),
      'Filter standard input with jq without reading the environment, modules or files.'),
    allow('stdin-jq-variables', 'jq', {...options([], jqFlags, [['--indent', count]], jqFilter(2), {require_any: ['--arg', '--argjson']}),
      values: [{name: '--indent', match: {regex: count}}, {name: '--arg', match: {regex: '[A-Za-z_][A-Za-z0-9_]*'}, repeat: 'forbid'},
        {name: '--argjson', match: {regex: '[A-Za-z_][A-Za-z0-9_]*'}, repeat: 'forbid'}]},
    'Filter standard input with jq and one named value without reading the environment, modules or files.'),
    // Exact forms outrank read-rg's refusal, which no target can satisfy here.
    ...Object.entries(information).map(([id, option]) => allow(id, 'rg', {kind: 'exact', values: [option]},
      'Print ripgrep version, help or file types without searching.')),
    allow('process-fields', 'ps', options([], '-A -e -a -x -c -h -r -m', [['-o', fields], ['-p', pids], ['-u', names], ['-U', names], ['-g', names], ['-t', names]],
      false, {require_all: ['-o']}), 'List processes with fields that exclude command arguments and environments.'),
    // Setting the clock needs -s/--set or an operand without '+'; neither is listed.
    allow('date-options', 'date', options([], '-u --utc --universal -R --rfc-email --iso-8601 -j', [['-d', any], ['--date', any], ['-v', any], ['--rfc-3339', any]],
      {match: {regex: '\\+[^\\x00]*'}, min: 0, max: 1}), 'Print the date or a formatted date without setting the clock.'),
    // -l/-a and --list-* print command arguments; -F reads a PID file.
    allow('process-lookup', 'pgrep', options([], '-f -x -i -n -o -v -c --full --exact --ignore-case --newest --oldest --inverse --count',
      [['-u', names], ['-U', names], ['-P', pids], ['-g', names], ['-G', names], ['-t', names], ['-s', pids], ['-d', any],
        ['--euid', names], ['--uid', names], ['--parent', pids], ['--pgroup', names], ['--group', names], ['--terminal', names], ['--session', pids], ['--delimiter', any]],
      {match: {regex: any}, min: 1, max: 1}), 'Find process IDs by name without printing command arguments.'),
    allow('postgres-ready', 'pg_isready', options([], '-q --quiet -V --version', [['-h', any], ['--host', any], ['-p', count], ['--port', count],
      ['-d', any], ['--dbname', any], ['-U', any], ['--username', any], ['-t', count], ['--timeout', count]]),
      'Check whether a PostgreSQL server accepts connections.'),
    // --no-trunc and --format can print full container commands, which may hold credentials.
    allow('docker-containers', 'docker', options(['ps'], '-a --all -q --quiet -s --size -l --latest',
      [['-n', count], ['--last', count], ['-f', any], ['--filter', any]]), 'List containers without full commands.'),
    allow('docker-images', 'docker', options(['images'], '-a --all -q --quiet --digests', [['-f', any], ['--filter', any]], {match: {regex: any}, min: 0, max: 1}),
      'List images.'),
    allow('docker-compose-status', 'docker', options(['compose', {one_of: ['ps', 'ls']}], '-a --all -q --quiet --services',
      [['--status', any], ['--filter', any]], {match: {regex: '[A-Za-z0-9_.-]+'}, min: 0, max: 64}), 'List Compose services and projects without full commands.'),
    allow('docker-listings', 'docker', options([{one_of: ['image', 'container', 'network', 'volume', 'context']}, {one_of: ['ls', 'list']}], '-a --all -q --quiet',
      [['-f', any], ['--filter', any]]), 'List images, containers, networks, volumes or contexts.'),
    allow('docker-version', 'docker', {kind: 'exact', values: ['version']}, 'Print Docker client and server versions.'),
  ];
}

export async function everydayReadsPack() {
  const pack = await read('pack.yml');
  pack.version = '0.14.0';
  // The piped jq rules refuse filters by what they must not contain.
  pack.capabilities = [...new Set([...pack.capabilities, 'negated-selectors-v1'])].sort();
  const rg = pack.rules.find(rule => rule.id === 'read-rg');
  // Shield's ripgrep model parses options as ripgrep does and leaves helper
  // programs, link following and undefined options unverified, so the path
  // check alone decides: a closed option list only refused ordinary searches.
  rg.requirements = {arguments: {kind: 'any'}, targets: rg.requirements.targets};
  rg.on_unmet.message = 'Search approved paths. Protected files and folders stay blocked; --pre, --pre-glob, -z, --hostname-bin, -L/--follow, a - operand and options ripgrep does not define are refused. Drop them or narrow the path, then retry.';
  rg.on_unmet.alternatives = ['rg [OPTIONS] PATTERN PATH...', 'rg --files [OPTIONS] [PATH...]', 'rg [OPTIONS] -e PATTERN [-e PATTERN] PATH...'];
  // Each added rule sits before its command's review catch-all.
  const added = rules(structuredClone(pack.rules.find(rule => rule.id === 'read-jq').requirements.targets));
  for (const rule of added) {
    const command = Object.entries(addedRules).find(([, ids]) => ids.includes(rule.id))[0];
    const review = pack.rules.findIndex(item => item.conditions?.executable?.one_of?.includes(command) && item.decision?.recommended === 'ask' && item.conditions.arguments?.kind === 'any');
    pack.rules.splice(review === -1 ? pack.rules.length : review, 0, rule);
  }
  return pack;
}

export async function everydayReadsCommands() {
  const commands = await read('commands.json');
  for (const [name, ids] of Object.entries(addedRules)) {
    let command = commands.commands.find(item => item.name === name);
    if (!command) {
      command = {name, rule_ids: [], source_rule_ids: []};
      commands.commands.push(command);
    }
    command.rule_ids.push(...ids);
    command.source_rule_ids.push(...ids);
  }
  return commands;
}

// Fixtures run from the registry root. Read-only rules decide alike in every
// profile; the central cases cover each profile.
export async function everydayReadsCases() {
  const cases = await read('cases.json');
  const added = [
    // Ripgrep: options anywhere, ordinary options without a listing.
    ['rg-option-after-path', ['rg', '-n', 'Shield', 'docs', '-g', '*.md'], 'allow', profiles],
    ['rg-files-glob-after-path', ['rg', '--files', 'docs', '-g', '*.md'], 'allow'],
    ['rg-depth-after-pattern', ['rg', '-l', 'Shield', '--max-depth', '2', 'docs'], 'allow'],
    ['rg-sort', ['rg', '--sort', 'path', '-n', 'Shield', 'docs'], 'allow', profiles],
    ['rg-only-matching', ['rg', '-o', '-N', 'Shield', 'README.md'], 'allow'],
    ['rg-multiline-json', ['rg', '-U', '--json', 'Shield', 'docs'], 'allow'],
    ['rg-files-without-match', ['rg', '--files-without-match', 'Shield', 'docs'], 'allow'],
    ['rg-several-patterns', ['rg', '-n', '-e', 'Shield', '-e', 'pack', 'docs'], 'allow'],
    ['rg-attached-values', ['rg', '-g*.md', '-A3', 'Shield', 'docs'], 'allow'],
    ['rg-pattern-file', ['rg', '-f', 'LICENSE', 'docs'], 'allow'],
    ['rg-hidden-folder', ['rg', '--hidden', 'Shield', 'docs'], 'allow'],
    ['rg-version', ['rg', '--version'], 'allow'],
    ['rg-short-version', ['rg', '-V'], 'allow'],
    ['rg-type-list', ['rg', '--type-list'], 'allow'],
    ['rg-help', ['rg', '--help'], 'allow'],
    // Ripgrep: helpers, link following and undefined options stay refused.
    ['rg-preprocessor', ['rg', '--pre', 'cat', 'Shield', 'docs'], 'deny', profiles],
    ['rg-preprocessor-glob', ['rg', '--pre-glob', '*', 'Shield', 'docs'], 'deny'],
    ['rg-search-zip', ['rg', '-z', 'Shield', 'docs'], 'deny'],
    ['rg-hostname-program', ['rg', '--hostname-bin', 'hostname', 'Shield', 'docs'], 'deny'],
    ['rg-follow-after-path', ['rg', 'Shield', 'docs', '-L'], 'deny'],
    ['rg-undefined-option', ['rg', '--future-option', 'Shield', 'docs'], 'deny'],
    ['rg-outside', ['rg', 'Shield', '..'], 'deny'],
    ['rg-outside-pattern-file', ['rg', '-f', '../outside-patterns', 'docs'], 'deny'],
    ['rg-missing', ['rg', 'Shield', 'missing-folder'], 'deny'],
    // Processes: fields without command lines allow; command lines ask.
    ['ps-all-fields', ['ps', '-axo', 'pid,ppid,comm'], 'allow', profiles],
    ['ps-every-fields', ['ps', '-eo', 'pid,etime,comm'], 'allow'],
    ['ps-user-fields', ['ps', '-Ao', 'pid,user,%cpu,comm'], 'allow'],
    ['ps-user-selection', ['ps', '-o', 'pid,comm', '-u', 'acme'], 'allow'],
    ['ps-command-field', ['ps', '-axo', 'pid,command'], 'ask', profiles],
    ['ps-args-field', ['ps', '-eo', 'pid,args'], 'ask'],
    ['ps-bsd-all', ['ps', 'aux'], 'ask'],
    ['ps-default-columns', ['ps', '-e'], 'ask'],
    // Clock: printing allows; setting asks.
    ['date-utc', ['date', '-u'], 'allow', profiles],
    ['date-utc-format', ['date', '-u', '+%Y-%m-%dT%H:%M:%SZ'], 'allow'],
    ['date-relative', ['date', '-d', 'yesterday', '+%F'], 'allow'],
    ['date-adjusted', ['date', '-v-1d', '+%F'], 'allow'],
    ['date-set-operand', ['date', '0101000026'], 'ask', profiles],
    ['date-set-option', ['date', '-s', 'now'], 'ask'],
    // Process lookup: PIDs allow; printed command lines and PID files ask.
    ['pgrep-full', ['pgrep', '-f', 'node'], 'allow', profiles],
    ['pgrep-user-newest', ['pgrep', '-u', 'acme', '-n', 'node'], 'allow'],
    ['pgrep-list-full', ['pgrep', '-fl', 'node'], 'ask', profiles],
    ['pgrep-list-arguments', ['pgrep', '-a', 'node'], 'ask'],
    ['pgrep-pid-file', ['pgrep', '-F', 'server.pid'], 'ask'],
    // PostgreSQL readiness.
    ['pg-isready', ['pg_isready', '-h', 'localhost', '-p', '5432'], 'allow', profiles],
    ['pg-isready-quiet', ['pg_isready', '-q', '-d', 'acme'], 'allow'],
    // Docker listings allow; full commands, configuration, output and changes ask.
    ['docker-ps', ['docker', 'ps'], 'allow', profiles],
    ['docker-ps-filter', ['docker', 'ps', '-a', '--filter', 'status=running'], 'allow'],
    ['docker-images', ['docker', 'images'], 'allow'],
    ['docker-image-ls', ['docker', 'image', 'ls', '-q'], 'allow'],
    ['docker-compose-ps', ['docker', 'compose', 'ps'], 'allow'],
    ['docker-compose-ls', ['docker', 'compose', 'ls'], 'allow'],
    ['docker-network-ls', ['docker', 'network', 'ls'], 'allow'],
    ['docker-version', ['docker', 'version'], 'allow'],
    ['docker-ps-no-trunc', ['docker', 'ps', '--no-trunc'], 'ask', profiles],
    ['docker-ps-format', ['docker', 'ps', '--format', '{{.Command}}'], 'ask'],
    ['docker-info', ['docker', 'info'], 'ask'],
    ['docker-inspect', ['docker', 'inspect', 'web'], 'ask'],
    ['docker-logs', ['docker', 'logs', 'web'], 'ask'],
    ['docker-exec', ['docker', 'exec', 'web', 'sh'], 'ask'],
    ['docker-run', ['docker', 'run', 'alpine'], 'ask'],
    ['docker-remote-host', ['docker', '-H', 'tcp://example.com:2375', 'ps'], 'ask'],
    // jq: filters that read only their input allow; environment, file loading
    // and protected files keep their review or refusal.
    ['jq-object-shorthand', ['jq', '{head_sha,event,run_attempt,status,conclusion}'], 'allow', profiles],
    ['jq-select-map', ['jq', '-r', '.items | map(select(.enabled)) | .[].name'], 'allow'],
    ['jq-variable', ['jq', '-n', '--arg', 'sha', 'abc123', '{sha: $sha}'], 'allow'],
    ['jq-file-object', ['jq', '{name,version}', 'package.json'], 'allow'],
    ['jq-variable-value-not-file', ['jq', '--arg', 'mode', 'fast', '.items[] | select(.mode == $mode)'], 'allow'],
    ['jq-two-variables', ['jq', '--arg', 'a', '1', '--argjson', 'b', '2', '[$a, $b]'], 'ask'],
    // With a file, Shield's jq model checks the file and the variable alike.
    ['jq-variable-and-file', ['jq', '--arg', 'a', '1', '{a: $a, name}', 'package.json'], 'allow'],
    ['jq-environment', ['jq', 'env'], 'ask', profiles],
    ['jq-environment-variable', ['jq', '$ENV.HOME'], 'ask'],
    ['jq-environment-in-string', ['jq', '-r', '"home: \\(env.HOME)"'], 'ask'],
    ['jq-module', ['jq', 'import "helper" as h; h::read'], 'ask'],
    ['jq-slurp-file', ['jq', '--slurpfile', 'data', 'package.json', '$data'], 'ask'],
    ['jq-program-file', ['jq', '-f', 'filter.jq', 'package.json'], 'ask'],
    ['jq-path-outside', ['jq', '.', '../outside.json'], 'deny'],
    ['jq-object-outside', ['jq', '{name}', '../outside.json'], 'ask'],
  ];
  for (const [name, argv, expected, selected = ['recommended']] of added) {
    for (const profile of selected) cases.cases.push({name: `${name}-${profile}`, profile, argv, expected});
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await everydayReadsPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await everydayReadsCases(), null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify(await everydayReadsCommands(), null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.14.0

Supports Shield \`${pack.engines.shield}\`.

\`rg\` searches are decided by the paths they read rather than a list of options.
Shield reads ripgrep options the way ripgrep does, anywhere before \`--\`, so
\`rg -n PATTERN src -g '*.ts'\` checks \`src\`, and options that only shape
matching or output, such as \`--sort\`, \`-o\`, \`--json\` or \`-e PATTERN\`, are
allowed. \`-f\` pattern files and \`--ignore-file\` files are checked like explicit
files, and \`--hidden\` searches check every existing entry below each folder.
Outside or protected paths, \`--pre\`, \`--pre-glob\`, \`-z\`, \`--hostname-bin\`,
\`-L\`/\`--follow\`, a \`-\` operand and options ripgrep does not define are
refused. \`rg --version\`, \`--help\` and \`--type-list\` are allowed. Shield builds
whose ripgrep model predates this release refuse the forms they cannot read,
as before.

These read-only commands are allowed in every profile:

- \`ps\` with \`-o\` fields that exclude the command line and environment, such as
  \`ps -axo pid,ppid,comm\`. Fields such as \`command\` or \`args\`, \`ps aux\` and
  default columns still ask, because command lines can hold credentials.
- \`date\` with \`-u\`, \`-d\`, \`-v\` and a \`+FORMAT\`. Setting the clock still asks.
- \`pgrep\` by name, user, parent or session. \`-l\`, \`-a\` and \`--list-*\`, which
  print command lines, and \`-F\` PID files still ask.
- \`pg_isready\` with its connection options.
- \`jq\` filters that read only their input, on standard input or files in
  approved paths, such as \`jq '{head_sha,event}'\`, \`select\`, \`map\`, \`$name\`
  variables, \`-n\` and \`--arg NAME VALUE\` (one \`--arg\` or \`--argjson\` on
  standard input). \`env\`, \`$ENV\`, \`include\`/\`import\`, program-path builtins,
  \`-f\`, \`-L\`, \`--slurpfile\`, \`--rawfile\` and \`--args\` still ask, and protected
  files are still refused.
- \`docker ps\`, \`docker images\`, \`docker compose ps\`/\`ls\`, \`docker version\`
  and \`ls\` of images, containers, networks, volumes and contexts. \`--no-trunc\`,
  \`--format\`, \`docker info\`, \`inspect\`, \`logs\`, \`exec\`, \`run\`, global
  options such as \`-H\` and every change still ask.

Other rules, profiles and cases match [0.13.0](../0.13.0/README.md).

Generate with \`node scripts/build-baseline-everyday-reads.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-everyday-reads.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
