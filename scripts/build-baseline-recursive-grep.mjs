// Published releases are immutable. Prepare a new source release that allows
// recursive grep searches whose every existing descendant stays inside approved
// readable paths. Unverified recursive forms ask, as every other unsupported grep
// form already does, so Shield builds without the recursive grep model keep
// today's review instead of a refusal.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/baseline/0.11.1/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.12.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const profiles = ['loose', 'recommended', 'strict'];
const every = decision => Object.fromEntries(profiles.map(profile => [profile, decision]));
const any = {regex: '.+'};

export async function recursiveGrepPack() {
  const pack = await read('pack.yml');
  pack.version = '0.12.0';
  const index = pack.rules.findIndex(rule => rule.id === 'read-grep');
  const files = pack.rules[index];
  files.on_unmet.message = 'Search explicit regular files in approved readable paths; add -r to search a folder. Pattern files and unknown options are blocked.';
  // The grammar requires -r or -e, so it never overlaps the file and stdin
  // grammars, which refuse both. Filters only narrow the checked walk.
  const grammar = {
    ...structuredClone(files.requirements.arguments),
    flags: [...files.requirements.arguments.flags, '-r', '--recursive'],
    values: ['-e', '--regexp', '--include', '--exclude', '--exclude-dir'].map(name => ({name, match: any})),
    operands: {match: any, min: 1, max: 256},
    require_any: ['-r', '--recursive', '-e', '--regexp'],
  };
  const recursive = {
    id: 'read-grep-recursive',
    conditions: {domain: 'argv', executable: files.conditions.executable, arguments: grammar},
    decision: every('allow'),
    requirements: {arguments: structuredClone(grammar), targets: structuredClone(files.requirements.targets)},
    on_unmet: {
      decision: every('ask'),
      message: 'Recursive grep needs an existing folder or file in approved readable paths, with no excluded or unverifiable entries below it; review is required otherwise.',
      alternatives: [
        'Search a narrower folder: grep -r FLAGS PATTERN PATH, with options as single words such as --include=*.md.',
        'Use rg FLAGS PATTERN PATH for a search that honors ignore files.',
      ],
    },
  };
  pack.rules.splice(index + 1, 0, recursive);
  const other = pack.rules.find(rule => rule.id === 'grep-other');
  other.reason = 'Unsupported grep syntax requires review; supported forms retain their path checks.';
  other.guidance = {
    message: other.reason,
    alternatives: [
      'Search a folder with grep -r FLAGS PATTERN PATH, or with rg FLAGS PATTERN PATH.',
      'Search files with grep FLAGS -- PATTERN FILE... using supported flags.',
    ],
  };
  return pack;
}

// Fixtures run from the registry root. Every grep rule decides alike in all
// profiles; the central allowance and review cases cover each profile.
export async function recursiveGrepCases() {
  const cases = await read('cases.json');
  const added = [
    ['grep-recursive', ['grep', '-rn', '-i', 'Acme', 'docs'], 'allow', profiles],
    ['grep-recursive-trailing-include', ['grep', '-rn', 'Acme', 'docs', '--include=*.md'], 'allow', profiles],
    ['grep-recursive-long', ['grep', '--recursive', '-l', 'Acme', 'docs', 'README.md'], 'allow'],
    ['grep-recursive-filters', ['grep', '-r', '--include', '*.md', '--exclude-dir', 'agents', 'Acme', 'docs'], 'allow'],
    ['grep-recursive-patterns', ['grep', '-r', '-e', 'Acme', '--regexp=Shield', 'docs'], 'allow'],
    ['grep-pattern-option', ['grep', '-n', '-e', 'Acme', 'README.md'], 'allow'],
    ['grep-recursive-outside', ['grep', '-r', 'Acme', '..'], 'ask', profiles],
    ['grep-recursive-without-path', ['grep', '-r', 'Acme'], 'ask'],
    ['grep-recursive-missing', ['grep', '-r', 'Acme', 'missing-folder'], 'ask'],
    ['grep-recursive-trailing-value', ['grep', '-r', 'Acme', 'docs', '--include', '*.md'], 'ask'],
    ['grep-recursive-pattern-file', ['grep', '-r', '-f', 'README.md', 'docs'], 'ask'],
    ['grep-dereference-recursive', ['grep', '-R', 'Acme', 'docs'], 'ask'],
    ['grep-folder-without-recursion', ['grep', 'Acme', 'docs'], 'deny'],
  ];
  for (const [name, argv, expected, selected = ['recommended']] of added) {
    for (const profile of selected) cases.cases.push({name: `${name}-${profile}`, profile, argv, expected});
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await recursiveGrepPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await recursiveGrepCases(), null, 2) + '\n');
  const commands = await read('commands.json');
  for (const command of commands.commands.filter(command => command.name === 'grep')) {
    command.rule_ids.splice(command.rule_ids.indexOf('read-grep') + 1, 0, 'read-grep-recursive');
    command.source_rule_ids.push('read-grep-recursive');
  }
  await writeFile(new URL('commands.json', destination), JSON.stringify(commands, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.12.0

Supports Shield \`${pack.engines.shield}\`.

Recursive \`grep\` searches are allowed in every profile when each operand is an
existing file or folder in approved readable paths and no existing entry below a
folder, hidden ones included, is excluded: \`grep -rn -i PATTERN PATH\`, with
\`--recursive\`, \`--include\`, \`--exclude\`, \`--exclude-dir\` and patterns given
with \`-e\` or \`--regexp\`. Filters do not narrow the checked footprint. Options may
follow the operands as single words, such as \`--include=*.md\`. A recursive
search without a path, outside or unverifiable paths, \`-R\` and pattern files ask
for review, like other unsupported \`grep\` forms. Shield builds without the
recursive \`grep\` model also ask. \`grep\` review guidance names the supported
folder searches and \`rg\`. Other rules, profiles and cases match
[0.11.1](../0.11.1/README.md).

Generate with \`node scripts/build-baseline-recursive-grep.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-recursive-grep.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
