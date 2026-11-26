import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {updatePgrepCases} from './baseline-pgrep-cases.mjs';
import {shieldRestoreCases} from './baseline-shield-cases.mjs';

export const previous = new URL('../packs/canonic/baseline/0.19.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.20.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const ruleId = 'process-full-match-listing';

export async function baselinePgrepPack() {
  const pack = await read('pack.yml');
  const lookup = pack.rules.find(rule => rule.id === 'process-lookup');
  const lookupOptions = lookup.conditions.arguments;
  pack.version = '0.20.0';
  pack.rules.push({
    id: ruleId,
    conditions: {
      ...lookup.conditions,
      arguments: {
        ...lookupOptions,
        flags: [...lookupOptions.flags, '-l'],
        require_all: ['-f', '-l'],
        forbid: ['-c', '--count'],
        parse: 'stop_at_operand',
      },
    },
    decision: 'deny',
    reason: 'Listing matches with pgrep -fl prints full process arguments on macOS.',
    guidance: {
      message: 'For a process or build liveness check, drop -l and retry with pgrep -f and the same pattern to print only PIDs. Request one-time approval if the task needs the listing.',
    },
  });
  pack.rules.push({
    id: 'shield-mcp-pack-restore',
    conditions: {
      domain: 'mcp',
      server: pack.rules.find(rule => rule.id === 'shield-mcp-inspection').conditions.server,
      tool: 'pack_restore',
      fields: {'': {exact: {}}},
    },
    decision: 'allow',
    reason: 'Restore verified artifacts at versions and digests already selected by this project’s pack locks.',
  });
  return pack;
}

export async function baselinePgrepCommands() {
  const inventory = await read('commands.json');
  const command = inventory.commands.find(row => row.name === 'pgrep');
  command.rule_ids.push(ruleId);
  command.source_rule_ids.push(ruleId);
  return inventory;
}

export async function baselinePgrepCases() {
  const fixtures = await read('cases.json');
  fixtures.cases = [...updatePgrepCases(fixtures.cases), ...shieldRestoreCases()];
  return fixtures;
}

export const guide = `# Baseline permissions 0.20.0

This release updates process lookups and Shield MCP recovery from
[Baseline 0.19.0](../0.19.0/README.md). The engine range and policy capabilities
are unchanged.

## Process lookups

Use \`pgrep -f 'build-worker|compiler'\` to match against full process arguments
and print only matching PIDs. All profiles block \`pgrep -fl\`, \`pgrep -lf\` and
\`pgrep -f -l\` on ordinary process searches and direct the agent to drop \`-l\`.
On macOS, combining these flags prints the full arguments of each match. procps
on Linux lists the process name with \`-l\`. An agent can request exact one-time
approval for the full listing when the task needs it.

## Restore locked Shield packs

On Shield 0.56.0 and later, all profiles allow the argument-free MCP call
\`pack_restore\` on a [matching Shield connection](../0.19.0/README.md#shield-mcp).
Use it when \`status\` or \`doctor\` reports missing locked artifacts. It fetches
only the versions and digests already selected in the project's locks into
the local artifact store. Project policy, pack selections and locks stay
intact. Extra arguments and unverified connections retain the Ask fallback.
\`shield pack restore --help\` is covered by the normal help rule. Use MCP
for agent recovery and \`shield pack restore\` for terminal operation.

Generate with \`node scripts/build-baseline-pgrep.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-pgrep.test.mjs\`.

Licensed under MIT.
`;

async function build() {
  await mkdir(destination, {recursive: true});
  for (const [name, document] of [['pack.yml', await baselinePgrepPack()],
    ['commands.json', await baselinePgrepCommands()], ['cases.json', await baselinePgrepCases()]])
    await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), guide);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
