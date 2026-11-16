// Published releases are immutable. Prepare a source release that decides grep
// by the files it reads, as 0.14.0 does for ripgrep: Shield's grep model parses
// GNU and BSD grep's complete option table, so options that only shape matching
// or output need no listing, piped searches read only their input, and the path
// check alone decides. The stdin grammar, the recursive grammar and the review
// catch-all, each a closed option list, collapse into one path-checked rule.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/baseline/0.14.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.15.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const profiles = ['loose', 'recommended', 'strict'];
const every = decision => Object.fromEntries(profiles.map(profile => [profile, decision]));

// Shield 0.36.0 is the first release whose grep model reads the full option
// table and lets a search of standard input meet a read requirement. Earlier
// builds would refuse ordinary piped searches under the single rule.
export const engine = '>=0.36.0, <1.0.0';
export const removedRules = ['stdin-grep', 'read-grep-recursive', 'grep-other'];
export const changedRules = ['read-grep'];

export async function grepEffectsPack() {
  const pack = await read('pack.yml');
  pack.version = '0.15.0';
  pack.engines = {shield: engine};
  const grep = pack.rules.find(rule => rule.id === 'read-grep');
  grep.conditions = {domain: 'argv', executable: grep.conditions.executable};
  grep.requirements = {arguments: {kind: 'any'}, targets: grep.requirements.targets};
  grep.on_unmet = {
    decision: every('deny'),
    message: 'Search approved paths. Protected files and folders stay blocked; -R, a bare -C or --context, ambiguous abbreviations and options grep does not define are refused. Use -r, -C3 or --context=3, or narrow the path, then retry.',
    alternatives: [
      'grep [OPTIONS] PATTERN FILE...',
      'grep -r [OPTIONS] PATTERN PATH...',
      'COMMAND | grep [OPTIONS] PATTERN',
    ],
  };
  pack.rules = pack.rules.filter(rule => !removedRules.includes(rule.id));
  return pack;
}

export async function grepEffectsCommands() {
  const commands = await read('commands.json');
  for (const command of commands.commands.filter(item => item.name === 'grep')) {
    command.rule_ids = command.rule_ids.filter(id => !removedRules.includes(id));
    command.source_rule_ids = command.source_rule_ids.filter(id => !removedRules.includes(id));
  }
  return commands;
}

// Fixtures run from the registry root. The earlier grep cases keep their
// commands; the decisions this release changes are listed with the reason.
export const changedCases = {
  // Options grep does not define are refused with guidance, as for rg.
  'grep-unsupported': 'deny',
  'grep-recursive-outside': 'deny',
  // Without a path, the working directory's walk is checked.
  'grep-recursive-without-path': 'allow',
  'grep-recursive-missing': 'deny',
  // POSIXLY_CORRECT could make a trailing option's value an operand.
  'grep-recursive-trailing-value': 'deny',
  // Pattern files are read like explicit files.
  'grep-recursive-pattern-file': 'allow',
  'grep-dereference-recursive': 'deny',
};

export async function grepEffectsCases() {
  const cases = await read('cases.json');
  for (const fixture of cases.cases) {
    const name = fixture.name.slice(0, fixture.name.lastIndexOf('-'));
    if (name in changedCases) fixture.expected = changedCases[name];
  }
  const added = [
    // Options that shape matching or output need no listing.
    ['grep-context-after', ['grep', '-n', '-A1', 'Acme', 'README.md'], 'allow', profiles],
    ['grep-context-cluster', ['grep', '-nA1', 'Acme', 'README.md'], 'allow'],
    ['grep-context-separate', ['grep', '-B', '2', 'Acme', 'README.md'], 'allow'],
    ['grep-only-matching-count', ['grep', '-o', '-m', '3', '--color=always', 'Acme', 'README.md'], 'allow'],
    ['grep-perl-context-number', ['grep', '-P', '-5', 'Acme', 'README.md'], 'allow'],
    ['grep-long-abbreviation', ['grep', '--after', '2', 'Acme', 'README.md'], 'allow'],
    ['grep-context-attached', ['grep', '-C3', '--context=3', 'Acme', 'README.md'], 'allow'],
    ['grep-directories-recurse', ['grep', '-d', 'recurse', 'Acme', 'docs'], 'allow'],
    // A search of piped input reads no file.
    ['grep-piped-context', ['grep', '-n', '-A1', '^"acme@'], 'allow', profiles],
    ['grep-piped-only-matching', ['grep', '-oE', '[0-9]+'], 'allow'],
    ['grep-piped-pattern-option', ['grep', '-e', 'Acme', '-'], 'allow'],
    ['grep-pattern-file', ['grep', '-f', 'LICENSE', 'README.md'], 'allow'],
    // Files named by operands or options are still checked.
    ['grep-context-outside', ['grep', '-A1', 'Acme', '../outside'], 'deny', profiles],
    ['grep-outside-pattern-file', ['grep', '-f', '../outside-patterns', 'README.md'], 'deny'],
    ['grep-piped-outside-pattern-file', ['grep', '--file=../outside-patterns'], 'deny'],
    ['grep-outside-exclude-file', ['grep', '-r', '--exclude-from=../outside', 'Acme', 'docs'], 'deny'],
    // GNU and BSD grep parse a bare context option differently.
    ['grep-bare-context', ['grep', '-C', '3', 'Acme', 'README.md'], 'deny'],
    ['grep-bare-long-context', ['grep', '--context', '3', 'Acme', 'README.md'], 'deny'],
    ['grep-ambiguous-abbreviation', ['grep', '--re', 'Acme', 'README.md'], 'deny'],
    ['grep-following-links', ['grep', '-S', 'Acme', 'README.md'], 'deny'],
  ];
  for (const [name, argv, expected, selected = ['recommended']] of added) {
    for (const profile of selected) cases.cases.push({name: `${name}-${profile}`, profile, argv, expected});
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await grepEffectsPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await grepEffectsCases(), null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify(await grepEffectsCommands(), null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.15.0

Supports Shield \`${pack.engines.shield}\`.

\`grep\` searches are decided by the files they read rather than a list of
options. Shield reads grep options the way GNU and BSD grep do, so options that
only shape matching or output, such as \`-A1\`, \`-o\`, \`-m 3\`, \`-P\` or
\`--color=always\`, are allowed. The checked paths are file operands, \`-r\`
folders and their existing entries, \`-f\` pattern files and \`--exclude-from\`
files. A search of piped input, such as \`git show HEAD:yarn.lock | grep -n -A1
PATTERN\`, reads no file and is allowed. A recursive search without a path checks
the working directory.

Outside or protected paths, \`-R\`, a bare \`-C\` or \`--context\` (write \`-C3\` or
\`--context=3\`), ambiguous option abbreviations and options grep does not
define are refused with guidance, as for \`rg\`; earlier releases asked for
review instead. Shield builds before 0.36.0 cannot read these forms and do not
accept this release.

Other rules, profiles and cases match [0.14.0](../0.14.0/README.md).

Generate with \`node scripts/build-baseline-grep-effects.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-grep-effects.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
