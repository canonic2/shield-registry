// Use Shield 0.2.0's path models for line/column readers, pagers, tee, ln and
// chmod/chown, and its builtin queries, over the immutable 0.5.0 release.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { append } from './usable-cases.mjs';

const previous = new URL('../packs/canonic/baseline/0.5.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.6.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

const bins = (...names) => ({ one_of: names.flatMap(name => [name, `/bin/${name}`, `/usr/bin/${name}`]) });
const profiles = (loose, recommended, strict) => ({ loose, recommended, strict });
const always = decision => profiles(decision, decision, decision);
const local = profiles('allow', 'allow', 'ask');
// File operands; a bare `-` is standard input, decided by the stdin rules.
const file = String.raw`[^-](?s:.*)|-(?s:.+)`;
const files = { match: { regex: file }, min: 1, max: 256 };
const options = (flags, values = [], operands = files) => ({ kind: 'options', prefix: [], flags, values, operands });
const each = (regex, min) => ({ kind: 'sequence', prefix: [], rest: { kind: 'each', match: { regex }, min, max: 256 } });

export async function pathModelsRules(pack) {
  const target = (id, action) => {
    const rule = pack.rules.find(rule => rule.id === id);
    const targets = [rule.requirements.targets].flat();
    return structuredClone(targets.find(target => target.action === action));
  };
  const readTarget = target('read-cat', 'read');
  const writeTarget = target('write-touch', 'write');
  const removeTarget = target('move-mv', 'remove');
  const unmet = message => ({
    decision: always('deny'),
    message,
    alternatives: [
      'To use a folder outside the project, propose it with shield_policy_propose (access_path_add); the user approves it with shield policy.',
    ],
  });
  const reader = (id, executable, args) => ({
    id, conditions: { domain: 'argv', executable, arguments: args }, decision: always('allow'),
    requirements: { targets: readTarget },
    on_unmet: unmet('Read only files within the approved read paths; credential folders and outside paths are blocked.'),
  });
  const writer = (id, executable, args, targets) => ({
    id, conditions: { domain: 'argv', executable, arguments: args }, decision: local,
    requirements: { targets },
    on_unmet: unmet('Change only files within the approved write paths; .git, Shield state and outside paths are blocked.'),
  });
  const allow = (id, executable, args) => ({ id, conditions: { domain: 'argv', executable, arguments: args }, decision: always('allow') });
  const named = names => names.map(name => ({ name }));
  return [
    reader('read-nl', bins('nl'), options(['-p'], named(['-b', '-d', '-f', '-h', '-i', '-n', '-s', '-v', '-w']),
      { ...files, max: 1 })),
    reader('read-comm', bins('comm'), options(['-1', '-2', '-3', '-i'], [], { ...files, min: 2, max: 2 })),
    reader('read-paste', bins('paste'), options(['-s'], named(['-d']))),
    reader('read-column', bins('column'), options(['-t', '-x'], named(['-s', '-c', '-o']))),
    reader('read-less', bins('less'), options(['-F', '-i', '-I', '-M', '-m', '-N', '-n', '-q', '-R', '-r', '-S', '-s', '-X'])),
    reader('read-more', bins('more'), options(['-c', '-d', '-f', '-l', '-p', '-s', '-u'])),
    allow('stdin-tee', bins('tee'), options(['-a', '-i'], [], false)),
    writer('write-tee', bins('tee'), options(['-a', '-i']), writeTarget),
    // A hard link shares its source's contents, so its source is read; -f also
    // removes the entry it replaces. Each form requires exactly its targets.
    ...[['link-symbolic', ['-s'], ['-f'], [writeTarget]],
      ['link-symbolic-replace', ['-s', '-f'], [], [writeTarget, removeTarget]],
      ['link-hard', [], ['-s', '-f'], [readTarget, writeTarget]],
      ['link-hard-replace', ['-f'], ['-s'], [readTarget, writeTarget, removeTarget]],
    ].map(([id, require, forbid, targets]) => writer(id, bins('ln'), {
      ...options(['-s', '-f', '-n', '-h', '-v', '-i']),
      ...(require.length ? { require_all: require } : {}),
      ...(forbid.length ? { forbid } : {}),
    }, targets)),
    // Symbolic modes such as -x look like options, so the grammar admits them by shape.
    writer('mode-chmod', bins('chmod'), each(String.raw`-[Rfvh]+|[ugoa]*[-+=][-+=rwxXstugo,]*|[^-].*`, 2), writeTarget),
    writer('owner-chown', bins('chown'), each(String.raw`-[Rfvh]+|[^-].*`, 2), writeTarget),
    allow('lookup-command', bins('command'), { kind: 'prefix', values: [{ regex: '-[pvV]*[vV][pvV]*' }] }),
    allow('lookup-command-path', bins('command'), { kind: 'prefix', values: ['-p', { regex: '-[pvV]*[vV][pvV]*' }] }),
    allow('limits-ulimit', bins('ulimit'), each('-[A-Za-z]+', 0)),
  ];
}

export async function pathModelsPack() {
  const pack = await read('pack.yml');
  pack.version = '0.6.0';
  // Shield 0.2.0 models these paths and lets builtin queries reach policy.
  pack.engines = { shield: '>=0.2.0, <0.3.0' };
  pack.rules.push(...await pathModelsRules(pack));
  return pack;
}

const base = name => name.slice(name.lastIndexOf('/') + 1);

export async function pathModelsCommands(pack) {
  const commands = await read('commands.json');
  for (const { id, conditions } of (await pathModelsRules(pack ?? await read('pack.yml')))) {
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

// Independent expectations; these do not read the generated rules. Paths are
// relative to the registry checkout, where the fixtures run.
export const reads = [
  ['nl-read', ['nl', '-ba', 'README.md']], ['comm-read', ['comm', '-12', 'README.md', 'LICENSE']],
  ['paste-read', ['paste', '-d,', 'README.md', 'LICENSE']], ['column-read', ['column', '-t', 'README.md']],
  ['less-file', ['less', '-N', 'README.md']], ['tee-stdout', ['tee']],
  ['command-v', ['command', '-p', '-v', 'rg']], ['ulimit-all', ['ulimit', '-a']],
];
// The fixture file holds at most 1,024 cases; Shield's unit tests cover the
// remaining option and operand shapes of these models.
export const writes = [
  ['tee-file', ['tee', '-a', 'shield-baseline-out.txt']],
  ['symlink', ['ln', '-s', 'README.md', 'shield-baseline-link']], ['hard-link', ['ln', 'README.md', 'shield-baseline-link']],
  ['symlink-force', ['ln', '-sf', 'README.md', 'shield-baseline-link']],
  ['chmod-plus', ['chmod', '+x', 'README.md']], ['chmod-minus', ['chmod', '-x', 'README.md']],
  ['chmod-recursive', ['chmod', '-R', 'u+w', 'scripts']], ['chown', ['chown', 'acme:staff', 'README.md']],
];
export const denied = [
  ['nl-credential', ['nl', '.aws/config']], ['less-outside', ['less', '/shield-baseline-unapproved/item']],
  ['comm-outside', ['comm', 'README.md', '/shield-baseline-unapproved/item']],
  ['tee-outside', ['tee', '/shield-baseline-unapproved/out']], ['tee-git', ['tee', '.git/config']],
  ['hard-link-outside', ['ln', '/shield-baseline-unapproved/item', 'shield-baseline-link']],
  ['hard-link-credential', ['ln', '.aws/credentials', 'shield-baseline-link']],
  ['link-into-git', ['ln', '-s', 'README.md', '.git/hooks/pre-commit']],
  ['chmod-outside', ['chmod', '-R', '777', '/shield-baseline-unapproved']], ['chmod-state', ['chmod', '600', '.shield/review']],
  ['chown-outside', ['chown', 'acme', '/shield-baseline-unapproved/item']],
];
export const reviewed = [
  ['less-log-file', ['less', '-o', 'log.txt', 'README.md']],
  ['ln-unknown', ['ln', '-F', 'a', 'b']], ['chmod-reference', ['chmod', '--reference=README.md', 'LICENSE']],
  ['chmod-follow', ['chmod', '-R', '-L', 'u+w', 'scripts']], ['command-run', ['command', 'rg', 'acme']],
  ['ulimit-set', ['ulimit', '-n', '4096']],
];

export async function pathModelsCases() {
  const cases = await read('cases.json');
  // The 0.5.0 review cases these forms now decide by path.
  const decided = new Set(['nl-file', 'column-file', 'comm-files', 'chmod', 'ln', 'tee', 'less']);
  cases.cases = cases.cases.filter(fixture => !decided.has(fixture.name.replace(/^usable-/, '').replace(/-(loose|recommended|strict)$/, '')));
  append(cases.cases, reads, ['allow', 'allow', 'allow']);
  append(cases.cases, writes, ['allow', 'allow', 'ask']);
  append(cases.cases, denied, ['deny', 'deny', 'deny']);
  append(cases.cases, reviewed, ['ask', 'ask', 'ask']);
  return cases;
}

export async function build(output = destination) {
  await mkdir(output, { recursive: true });
  const pack = await pathModelsPack();
  const cases = await pathModelsCases();
  await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', output), JSON.stringify(cases, null, 2) + '\n');
  await writeFile(new URL('commands.json', output), JSON.stringify(await pathModelsCommands(), null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', output));
  const replace = (text, from, to) => {
    if (!text.includes(from)) throw Error(`README text not found: ${from}`);
    return text.replace(from, () => to);
  };
  let guide = await readFile(new URL('README.md', previous), 'utf8');
  guide = replace(guide, 'permissions 0.5.0', 'permissions 0.6.0');
  guide = replace(guide, 'Shield 0.1.13 or later', 'Shield 0.2.0 or later');
  guide = replace(guide, 'within the 0.1 and 0.2 series.', 'within the 0.2 series.');
  guide = replace(guide, /The pack stores \d+ rules\./.exec(guide)[0], `The pack stores ${pack.rules.length} rules.`);
  guide = replace(guide, 'type rg; which node; whoami; id -u; hostname -s\n',
    'type rg; which node; command -v rg; whoami; id -u; hostname -s; ulimit -n\n');
  guide = replace(guide, 'cat data.csv | column -t -s,\ncat list.txt | paste -sd, -\n',
    'nl -ba README.md; column -t -s, data.csv; paste -d, a.txt b.txt; comm -12 a.txt b.txt\nless -N README.md; cat data.csv | column -t -s,\n');
  guide = replace(guide, `\`nl\`, \`column\`, \`paste\` and \`bc\` allow on standard input. With file
operands they, \`comm\` and the \`less\`/\`more\` pagers ask until Shield can check
their paths; read the file with \`cat\` and pipe it instead. \`tree\` options that`,
  `\`nl\`, \`comm\`, \`paste\`, \`column\` and the \`less\`/\`more\` pagers read files
like \`cat\`, within the read roots and outside credential folders; \`bc\` reads
standard input only. Pager options that write files, such as \`less -o\`, ask.
\`command -v\`/\`-V\` and \`ulimit\` queries allow; setting a limit asks. \`tree\` options that`);
  guide = replace(guide, `where containment cannot be established. \`chmod\`, \`chown\`, \`ln\` and \`tee\` ask
until Shield can check their targets. Network/cloud operations, \`open\`,`,
  `where containment cannot be established.

\`tee FILE\`, \`ln\`, \`chmod\` and \`chown\` follow the write rules: every file they
write, link or change, including everything below a \`-R\` folder, must be within
the approved write roots and outside \`.git\` and Shield's state. A hard link
shares its source's contents, so its source must also pass the read rules; a
symbolic link stores only a path, and reading through it is checked later.
Reference files and link-following \`-L\`/\`-H\` traversal ask.

Network/cloud operations, \`open\`,`);
  guide = replace(guide, '`node scripts/build-baseline-everyday.mjs` reproduces this release from 0.4.0.',
    '`node scripts/build-baseline-path-models.mjs` reproduces this release from 0.5.0.');
  guide = replace(guide, /All \d+ decision fixtures/.exec(guide)[0], `All ${cases.cases.length} decision fixtures`);
  await writeFile(new URL('README.md', output), guide);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
