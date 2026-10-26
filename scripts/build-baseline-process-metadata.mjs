// Published releases are immutable. Add generic process metadata inspection
// without allowing the default command line, argument columns or environments.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

export const previous = new URL('../packs/canonic/baseline/0.9.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.10.0/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const every = decision => ({loose: decision, recommended: decision, strict: decision});
const executable = {one_of: ['ps', '/bin/ps', '/usr/bin/ps']};
const fields = '(?:pid|ppid|pgid|uid|gid|comm|stat|state|etime|time|pcpu|pmem|rss|vsz)=?';

export async function processMetadataPack() {
  const pack = await read('pack.yml');
  pack.version = '0.10.0';
  pack.rules.push({
    id: 'process-metadata',
    conditions: {
      domain: 'argv', executable,
      arguments: {
        kind: 'options', prefix: [], flags: [],
        values: [
          {name: '-p', match: {regex: '^[1-9][0-9]*(?:,[1-9][0-9]*)*$'}},
          {name: '-o', match: {regex: `^${fields}(?:[, \\t]+${fields})*$`}},
        ],
        require_all: ['-p', '-o'], operands: false,
        short_clusters: false,
      },
    },
    decision: every('allow'),
    reason: 'Inspect selected process IDs and explicit metadata fields without command arguments or environments.',
  }, {
    id: 'process-review',
    conditions: {domain: 'argv', executable, arguments: {kind: 'any'}},
    decision: every('ask'),
    reason: 'Unlisted process inspection can expose command arguments or environments containing credentials.',
    guidance: {
      message: 'Process command arguments and environments may contain credentials.',
      alternatives: ['For metadata, select numeric PIDs with -p and explicit fields with -o, such as pid,ppid,comm; omit command arguments and environment output.'],
    },
  });
  return pack;
}

export async function processMetadataCases() {
  const cases = await read('cases.json');
  // The previous release has 1017 cases; retain every one within the 1024
  // case limit. The focused test also runs a larger adversarial fixture set.
  for (const profile of ['loose', 'recommended', 'strict']) {
    cases.cases.push({name: `ps-metadata-${profile}`, profile,
      argv: ['ps', '-p', '123', '-o', 'pid,ppid,comm'], expected: 'allow'});
  }
  for (const [name, argv, expected] of [
    ['ps-reordered', ['ps', '-o', 'comm,pid', '-p', '7,89'], 'allow'],
    ['ps-command', ['ps', '-p', '123', '-o', 'pid,ppid,command'], 'ask'],
    ['ps-environment', ['ps', '-E', '-p', '123', '-o', 'comm'], 'ask'],
    ['ps-default-output', ['ps', '-p', '123'], 'ask'],
  ]) cases.cases.push({name, profile: 'recommended', argv, expected});
  return cases;
}

export async function processMetadataCommands() {
  const commands = await read('commands.json');
  commands.commands.push({name: 'ps', rule_ids: ['process-metadata', 'process-review'],
    source_rule_ids: ['process-metadata', 'process-review']});
  commands.commands.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return commands;
}

export async function build() {
  await mkdir(destination, {recursive: true});
  const pack = await processMetadataPack();
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack, null, 2) + '\n');
  await writeFile(new URL('cases.json', destination), JSON.stringify(await processMetadataCases(), null, 2) + '\n');
  await writeFile(new URL('commands.json', destination), JSON.stringify(await processMetadataCommands(), null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), `# Baseline permissions 0.10.0

Supports Shield \`${pack.engines.shield}\`.

## Process metadata

Every profile allows \`ps\` (also \`/bin/ps\` and \`/usr/bin/ps\`) with both
\`-p\` and \`-o\`. PID selectors accept any positive decimal PID or comma-separated
list of positive PIDs. Output accepts any order and combination of \`pid\`,
\`ppid\`, \`pgid\`, \`uid\`, \`gid\`, \`comm\`, \`stat\`, \`state\`, \`etime\`,
\`time\`, \`pcpu\`, \`pmem\`, \`rss\` and \`vsz\`, separated by commas, spaces
or tabs. An empty heading (\`pid=\`) is supported. Both options may repeat;
every PID and output field must satisfy the same grammar. Attached short-option
values are supported, and the options may appear in either order.

For example, \`ps -p 123 -o pid,ppid,comm\` and
\`ps -o 'comm pid etime' -p 7,89\` inspect metadata. These PIDs are examples;
the rule contains no project paths or fixed process IDs. \`comm\` displays the
executable name (or path, depending on the host), without its arguments. Process
metadata can describe processes outside the current project; PID selection does
not prove project ownership. The host still controls which processes are visible.

Full command lines (\`command\`, \`args\`), environment output, default output
without \`-o\`, additional default columns through \`-O\`, unrestricted process
selection and unknown options or fields ask for approval. Command arguments and
environments can contain credentials. The rule uses the shared short options on
macOS/BSD and Linux; each host decides which listed metadata fields it supports.

Other permissions and fixtures match [0.9.0](../0.9.0/README.md).

Generate with \`node scripts/build-baseline-process-metadata.mjs\`.
Requested validation uses
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-process-metadata.test.mjs\`.
The focused suite includes additional adversarial process fixtures across all
three profiles. Published previous releases retain their original bytes.

Licensed under MIT.
`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
