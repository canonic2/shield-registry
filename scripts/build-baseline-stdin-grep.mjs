// Published releases are immutable. Prepare a new source release that allows
// grep as a filter of piped input, like the other stdin text filters, while
// file searches keep their location requirements and unknown forms stay denied.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/baseline/0.8.1/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.9.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const profiles = ['loose', 'recommended', 'strict'];
const every = decision => Object.fromEntries(profiles.map(profile => [profile, decision]));

export async function stdinGrepPack() {
  const pack = await read('pack.yml');
  pack.version = '0.9.0';
  const index = pack.rules.findIndex(rule => rule.id === 'read-grep');
  const files = structuredClone(pack.rules[index]);
  const grammar = files.requirements.arguments;
  const unmet = files.on_unmet;
  // One operand is the pattern alone: grep reads its input, not files.
  const filter = {
    id: 'stdin-grep',
    conditions: {
      domain: 'argv',
      executable: files.conditions.executable,
      arguments: {...structuredClone(grammar), operands: {...grammar.operands, min: 1, max: 1}},
    },
    decision: every('allow'),
  };
  // File searches name a pattern and at least one file; both rank alike, so
  // their argument conditions keep the two forms apart.
  files.conditions.arguments = structuredClone(grammar);
  // Any other grep form keeps the earlier Deny and its advice. Its plain
  // executable condition ranks below both grammars.
  const other = {
    id: 'grep-other',
    conditions: {domain: 'argv', executable: files.conditions.executable, arguments: {kind: 'any'}},
    decision: every('deny'),
    reason: unmet.message,
    guidance: {
      message: unmet.message,
      alternatives: [...unmet.alternatives, 'Pipe input into grep FLAGS PATTERN to filter it.'],
    },
  };
  pack.rules.splice(index, 1, filter, files, other);
  return pack;
}

// Fixtures hold at most 1024 cases. Every grep rule decides alike in all
// profiles, so grep cases run once, in the recommended profile.
const grepCase = fixture => fixture.argv[0] === 'grep' && fixture.argv[1] !== '--version';
export async function stdinGrepCases() {
  const cases = await read('cases.json');
  cases.cases = cases.cases.filter(fixture => !grepCase(fixture) || fixture.profile === 'recommended');
  const added = [
    ['stdin-grep', ['grep', '-i', 'ignore'], 'allow'],
    ['stdin-grep-flags', ['grep', '-nvF', 'Acme'], 'allow'],
    ['stdin-grep-dash-pattern', ['grep', '--', '-Acme'], 'allow'],
    ['stdin-grep-recursive', ['grep', '-r', 'Acme'], 'deny'],
    ['stdin-grep-pattern-file', ['grep', '-f', 'README.md'], 'deny'],
    ['grep-unknown-option', ['grep', '--include=*.md', 'Acme', 'README.md'], 'deny'],
  ];
  for (const [name, argv, expected] of added) {
    cases.cases.push({name: `${name}-recommended`, profile: 'recommended', argv, expected});
  }
  return cases;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await stdinGrepPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await stdinGrepCases(), null, 2) + '\n');
  const commands = await read('commands.json');
  for (const command of commands.commands) {
    command.rule_ids = pack.rules.filter(rule => rule.conditions.executable?.one_of?.some(name => name.split('/').at(-1) === command.name)).map(rule => rule.id);
    for (const id of command.rule_ids.filter(id => ['stdin-grep', 'grep-other'].includes(id))) command.source_rule_ids.push(id);
  }
  await writeFile(new URL('commands.json', destination), JSON.stringify(commands, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.9.0

Supports Shield \`${pack.engines.shield}\`.

\`grep\` filters piped input in every profile, like the other stdin text filters:
\`grep FLAGS PATTERN\` with the supported flags and no file operands, as in
\`ls -a | grep -i ignore\`. Searches of named files keep their approved-path
requirements. Recursive searches, pattern files, unknown options and other
\`grep\` forms remain denied with the same advice. Every \`grep\` rule decides
alike in all profiles, so the \`grep\` cases run in the recommended profile only,
keeping the fixtures within their 1024-case limit. Other rules, profiles and
cases match [0.8.0](../0.8.0/README.md).

Generate with \`node scripts/build-baseline-stdin-grep.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-stdin-grep.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
