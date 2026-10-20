// Layer sed edits, sed script file targets and narrower write exclusions over
// the immutable 0.3.1 release.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { append } from './usable-cases.mjs';
import { currentFormat } from './pack-formats.mjs';

const previous = new URL('../packs/canonic/baseline/0.3.1/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.4.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

const executable = { one_of: ['sed', '/bin/sed', '/usr/bin/sed'] };
const flags = ['-n', '-E', '-r', '-u'];
const operands = { match: { regex: '.+' }, min: 1, max: 256 };
const profiles = (loose, recommended, strict) => ({ loose, recommended, strict });

// Sed script grammar, matching the forms Shield models: commands with an
// optional line address, separated by `;` or newlines. A file name runs to the
// end of its line. Three common delimiters keep each pattern within the
// 4,096-byte regex bound; other delimiters, regex addresses, blocks and `e`
// remain reviewed.
const address = String.raw`(?:(?:[0-9]+|\$)(?:,(?:[0-9]+|\$))?)?`;
const delimiters = ['/', String.raw`\|`, '#'];
const part = d => String.raw`(?:[^${d.replace('\\', '')}\\\n]|\\[^\n])*`;
const substitute = `(?:${delimiters.map(d => `s${d}${part(d)}${d}${part(d)}${d}[0-9gpiImM]*`).join('|')})`;
const translate = `(?:${delimiters.map(d => `y${d}${part(d)}${d}${part(d)}${d}`).join('|')})`;
const file = String.raw`[ \t]*[^ \t\n][^\n]*`;
const end = String.raw`(?:[;\n][ \t\n;]*|$)`;
const line = commands => String.raw`${address}${commands}[ \t]*`;
const named = commands => `${address}${commands}`;
const print = line(`(?:[pd]|${substitute}|${translate})`);
const reads = named(`[rR]${file}`);
const writes = named(`(?:[wW]${file}|${substitute}w${file})`);
const script = units => String.raw`[ \t\n;]*(?:(?:${units.join('|')})${end})+`;

/** Scripts that print only: standard input carries no file target to check. */
export const printScript = script([print]);
/** Scripts that read named files but write none. */
export const readScript = script([print, reads]);
/** Any modeled script, for in-place edits. */
export const editScript = script([print, reads, writes]);
/** Scripts that write at least one named file. */
const any = `(?:${[print, reads, writes].join('|')})`;
export const writeScript = String.raw`[ \t\n;]*(?:${any}${end})*${writes}${end}(?:${any}${end})*`;

const writeTarget = {
  action: 'write',
  all: {
    within: { root: 'write' },
    exclude: [
      { root: 'write', path: '.git' },
      { root: 'write', path: '.shield/review' },
      { root: 'write', path: '.shield/cache' },
    ],
    match: { regex: '.+' },
  },
};
const message = 'Use sed with approved paths: reads within approved read paths and edits or written files within approved write paths; credential files and protected metadata are blocked.';
const alternatives = [
  "sed -n '1,200p' FILE or sed 's/OLD/NEW/' FILE to read",
  "sed -i '' 's/OLD/NEW/' FILE (or GNU sed -i 's/OLD/NEW/' FILE) to edit in place",
  "sed -n 's/OLD/NEW/w OUT' FILE to write matches to a file",
];

function editRule(id, leading, main, readTarget) {
  return {
    id,
    conditions: {
      domain: 'argv',
      executable,
      arguments: {
        kind: 'options',
        prefix: [{ regex: main.script }],
        flags: main.flags ?? [],
        values: main.values ?? [],
        ...(main.optional ? { optional_values: main.optional } : {}),
        operands,
        ...(main.require ? { require_any: main.require } : {}),
        parse: 'stop_at_operand',
        short_clusters: false,
        leading: { flags, values: [], ...leading, short_clusters: false },
      },
    },
    decision: profiles('allow', 'allow', 'ask'),
    requirements: { targets: [readTarget, writeTarget] },
    on_unmet: { decision: profiles('deny', 'deny', 'deny'), message, alternatives },
  };
}

/** Writes are decided by location; only state and Git metadata stay excluded. */
function narrowExclusions(rule) {
  const visit = value => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      if (Array.isArray(value.exclude) && value.exclude.some(e => e.root === 'write')) {
        value.exclude = writeTarget.all.exclude.map(e => ({ ...e }));
      }
      Object.values(value).forEach(visit);
    }
  };
  visit(rule);
}

export const narrowed = ['remove-rm', 'remove-rmdir', 'copy-cp', 'move-mv', 'write-mkdir', 'write-touch',
  'file-write', 'file-remove', 'file-copy', 'file-move'];

export async function sedEditsPack() {
  const pack = currentFormat(await read('pack.yml'));
  pack.version = '0.4.0';
  // Shield 0.1.12 first models sed edits and script files; older versions
  // would deny in-project edits instead of reviewing them. Shield 0.1.13 reads
  // the engines field.
  pack.engines = { shield: '>=0.1.13, <0.2.0' };
  const rule = id => pack.rules.find(rule => rule.id === id);
  const readSed = rule('read-sed');
  readSed.conditions.arguments.prefix = [{ regex: readScript }];
  readSed.on_unmet.message = message;
  readSed.on_unmet.alternatives = alternatives;
  rule('stdin-sed-read').conditions.arguments.prefix = [{ regex: printScript }];
  const review = rule('review-sed');
  review.guidance.message = 'Supported sed reads, in-place edits and file writes are decided by path. Other delimiters, regex addresses, blocks, backup suffixes and e need review.';
  review.guidance.alternatives = alternatives;
  const readTarget = readSed.requirements.targets;
  const edits = [
    // BSD `-i ''` and GNU `--in-place`; a backup suffix stays reviewed.
    editRule('edit-sed', { values: [{ name: '-i', match: { regex: '' } }], optional_values: [{ name: '--in-place' }] },
      { script: editScript, values: [{ name: '-i', match: { regex: '' } }], optional: [{ name: '--in-place' }],
        require: ['-i', '--in-place'] }, readTarget),
    // GNU `-i` without a suffix.
    editRule('edit-sed-gnu', { flags: [...flags, '-i'] },
      { script: editScript, flags: ['-i'], require: ['-i'] }, readTarget),
    // Scripts writing named files without editing their input.
    editRule('write-sed', {}, { script: writeScript }, readTarget),
  ];
  pack.rules.splice(pack.rules.indexOf(readSed) + 1, 0, ...edits);
  for (const id of narrowed) narrowExclusions(rule(id));
  return pack;
}

export async function sedEditsCommands() {
  const commands = await read('commands.json');
  const sed = commands.commands.find(command => command.name === 'sed');
  for (const id of ['edit-sed', 'edit-sed-gnu', 'write-sed']) {
    sed.rule_ids.push(id);
    sed.source_rule_ids.push(id);
  }
  return commands;
}

export async function sedEditsCases() {
  const cases = await read('cases.json');
  const [loose, recommended, strict] = ['allow', 'allow', 'ask'];
  for (const fixture of cases.cases) {
    const index = ['loose', 'recommended', 'strict'].indexOf(fixture.profile);
    // In-place edits within the project are decided like other writes.
    if (fixture.name.startsWith('usable-sed-in-place-')) fixture.expected = [loose, recommended, strict][index];
    // A script reading a named project file is a read.
    if (fixture.name.startsWith('usable-sed-read-file-')) fixture.expected = 'allow';
  }
  append(cases.cases, [
    ['sed-substitute', ['sed', 's/acme/example/', 'README.md']],
    ['sed-redact', ['sed', '-E', 's/(token": ")[^"]+/\\1<redacted>/Ig', 'README.md']],
    ['sed-pipe-delimiter', ['sed', '-n', 's|/acme|/example|gp', 'README.md']],
    ['sed-translate-delete', ['sed', 'y/abc/xyz/; 3d', 'README.md']],
    ['sed-read-named', ['sed', '1r README.md', 'README.md']],
    ['sed-stdin-substitute', ['sed', 's/acme/example/g']],
  ], ['allow', 'allow', 'allow']);
  append(cases.cases, [
    ['sed-edit-bsd', ['sed', '-i', '', 's/acme/example/', 'README.md']],
    ['sed-edit-gnu', ['sed', '-i', 's/acme/example/g', 'README.md']],
    ['sed-edit-long', ['sed', '--in-place', 's/acme/example/', 'README.md']],
    ['sed-edit-extended', ['sed', '-E', '-i', '', 's/(acme)/\\1-example/', 'README.md']],
    ['sed-write-flag', ['sed', '-n', 's/acme/example/w out.txt', 'README.md']],
    ['sed-write-command', ['sed', '-n', '$w out.txt', 'README.md']],
    ['agent-command-write', ['touch', '.claude/commands/acme.md']],
  ], [loose, recommended, strict]);
  append(cases.cases, [
    ['sed-edit-outside', ['sed', '-i', '', 's/a/b/', '/shield-baseline-unapproved/acme.txt']],
    ['sed-write-outside', ['sed', '-n', 'w /shield-baseline-unapproved/out', 'README.md']],
    ['sed-write-git', ['sed', '-n', 'w .git/config', 'README.md']],
    ['sed-edit-credential', ['sed', '-i', '', 's/a/b/', '.aws/config']],
    ['sed-read-credential', ['sed', '1r .aws/credentials', 'README.md']],
    ['state-write', ['touch', '.shield/review/acme']],
  ], ['deny', 'deny', 'deny']);
  append(cases.cases, [
    ['sed-execute', ['sed', '1e id', 'README.md']],
    ['sed-stdin-read-file', ['sed', 'r README.md']],
    ['sed-edit-backup', ['sed', '-i.bak', 's/a/b/', 'README.md']],
    ['sed-edit-clustered', ['sed', '-ni', '1p', 'README.md']],
    ['sed-regex-address', ['sed', '-n', '/acme/p', 'README.md']],
    ['sed-other-delimiter', ['sed', 's,a,b,', 'README.md']],
    ['sed-stdin-edit', ['sed', '-i', '', 's/a/b/']],
  ], ['ask', 'ask', 'ask']);
  return cases;
}

export async function build(output = destination) {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('pack.yml', output), JSON.stringify(await sedEditsPack(), null, 2) + '\n');
  await writeFile(new URL('cases.json', output), JSON.stringify(await sedEditsCases(), null, 2) + '\n');
  await writeFile(new URL('commands.json', output), JSON.stringify(await sedEditsCommands(), null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', output));
  const replace = (text, from, to) => {
    if (!text.includes(from)) throw Error(`README text not found: ${from}`);
    // A function replacement keeps `$` sequences in the text literal.
    return text.replace(from, () => to);
  };
  let guide = await readFile(new URL('README.md', previous), 'utf8');
  guide = replace(guide, 'permissions 0.3.1', 'permissions 0.4.0');
  guide = replace(guide, 'Shield 0.1.9 or later', 'Shield 0.1.13 or later');
  guide = replace(guide, 'The pack stores 84 shared bodies.', 'The pack stores 87 shared bodies.');
  guide = replace(guide, "sed -n '1,200p' README.md\n", "sed -n '1,200p' README.md\nsed 's/token/<redacted>/g' config.json\n");
  guide = replace(guide, 'Sed supports print addresses/ranges, including `$`.',
    'Sed supports `p`, `d`, `y` and `s` scripts with line addresses/ranges, including `$`, using `/`, `|` or `#` delimiters, and `r` reads of named files within the read roots.');
  guide = replace(guide, 'extra file loading,\nsed edits and output-file options need review.',
    'other file loading\nand output-file options need review.');
  guide = replace(guide, '## Other operations\n',
    "## Edits and other operations\n\nSed edits files in place with `sed -i '' SCRIPT FILE`, GNU `sed -i SCRIPT FILE`\nor `--in-place`, and writes named files with `w`, `W` or the `w` flag. Edited and\nwritten files must be within the approved write roots and outside `.git` and\nShield's review state; inputs follow the read rules. These allow in\nLoose/Recommended and ask in Strict. Backup suffixes, other delimiters, regex\naddresses, blocks and `e` need review.\n");
  guide = replace(guide, 'Read/write roots and protected metadata exclusions remain enforced.',
    "Read/write roots, `.git` and Shield's review state and cache remain excluded.\nAgent settings and Shield policy files are left to Shield's own protected-path\nguard and the operator's `shield protection` choice, so other files under\n`.claude/` and similar folders follow these rules.");
  const validation = guide.slice(guide.indexOf('## Validation'));
  guide = replace(guide, validation, `## Validation

\`node scripts/build-baseline-sed-edits.mjs\` reproduces this release from 0.3.1.
All ${(await sedEditsCases()).cases.length} decision fixtures run through production Shield.
Historical releases remain immutable. Licensed under MIT.
`);
  await writeFile(new URL('README.md', output), guide);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
