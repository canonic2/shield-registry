import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {interfaceAddressCases} from './baseline-interface-address-cases.mjs';

export const previous = new URL('../packs/canonic/baseline/0.21.1/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.21.2/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));
const ruleId = 'ipconfig-interface-address';

export async function interfaceAddressRelease() {
  const pack = await read('pack.yml');
  pack.version = '0.21.2';
  pack.rules.push({
    id: ruleId,
    conditions: {
      domain: 'argv',
      executable: {one_of: ['ipconfig', '/usr/sbin/ipconfig']},
      arguments: {
        kind: 'sequence',
        prefix: [{exact: 'getifaddr'}, {regex: '[A-Za-z][A-Za-z0-9_.-]{0,14}'}],
        rest: {kind: 'none'},
      },
    },
    decision: {loose: 'allow', recommended: 'allow', strict: 'allow'},
    reason: 'Read the IPv4 address of one local interface.',
  });
  const commands = await read('commands.json');
  const afterId = commands.commands.findIndex(command => command.name === 'id') + 1;
  commands.commands.splice(afterId, 0, {name: 'ipconfig', rule_ids: [ruleId], source_rule_ids: [ruleId]});
  const cases = await read('cases-2.json');
  cases.cases.push(...interfaceAddressCases());
  return {'pack.yml': pack, 'commands.json': commands, 'cases-2.json': cases};
}

export const guide = `# Baseline permissions 0.21.2

All profiles allow the macOS command \`ipconfig getifaddr en0\` and its
\`/usr/sbin/ipconfig\` form. The rule accepts one literal interface name and
reads its local IPv4 address. Other \`ipconfig\` forms, including \`set\` and
DHCP packet inspection, require review.

The pack supports Shield \`>=0.57.0, <1.0.0\`. Shield 0.62.0 recognizes this
pack for checked \`find -exec wc\` on Unix. With the Docker 0.2.0 permission
pack, it also recognizes checked Docker \`grep\` in Loose and Recommended.
Docker grep requires one reviewed \`--context\`, no exec options, and a
nonrecursive search of explicit absolute file paths without auxiliary files.
Explicit policy restrictions still apply.

See [Apple's implementation](https://github.com/apple-oss-distributions/bootp/blob/main/ipconfig.tproj/client.c)
and [Baseline 0.21.1](../0.21.1/README.md) for the other rules and requirements.

Generate with \`node scripts/build-baseline-interface-address.mjs\`. Validate
with \`npm test -- --shield /absolute/path/to/shield scripts/baseline-interface-address.test.mjs\`.

Licensed under MIT.
`;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await mkdir(destination, {recursive: true});
  for (const name of ['cases.json', 'LICENSE']) await copyFile(new URL(name, previous), new URL(name, destination));
  for (const [name, document] of Object.entries(await interfaceAddressRelease())) {
    await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  }
  await writeFile(new URL('README.md', destination), guide);
}
