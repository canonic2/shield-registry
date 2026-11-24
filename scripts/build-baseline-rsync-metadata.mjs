import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {rsyncMetadataCases} from './rsync-metadata-cases.mjs';

export const previous = new URL('../packs/canonic/baseline/0.17.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.18.0/', import.meta.url);
export const ruleId = 'rsync-metadata';
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

export function metadataRule() {
  return {id: ruleId, decision: 'allow', conditions: {domain: 'argv',
    executable: {one_of: ['rsync', '/bin/rsync', '/usr/bin/rsync', '/usr/local/bin/rsync', '/opt/homebrew/bin/rsync', 'rsync.exe']},
    arguments: {kind: 'options', prefix: [], flags: ['--help', '--version'], values: [], operands: false,
      require_any: ['--help', '--version']}},
  reason: 'Print built-in rsync help or version metadata without transfer operands, helpers, daemon mode or file-output options.'};
}

export async function metadataPack() {
  const pack = await read('pack.yml');
  pack.version = '0.18.0';
  pack.rules.push(metadataRule());
  return pack;
}
export async function metadataCommands() {
  const commands = await read('commands.json');
  const rsync = commands.commands.find(row => row.name === 'rsync');
  rsync.rule_ids.unshift(ruleId);
  rsync.source_rule_ids.unshift(ruleId);
  return commands;
}
export async function metadataReleaseCases() {
  const cases = await read('cases.json');
  cases.cases.push(...rsyncMetadataCases());
  return cases;
}
export function guide() {
  return `# Baseline permissions 0.18.0

Supports the same Shield engine and capabilities as [0.17.0](../0.17.0/README.md).

Rsync help and version queries are allowed in every profile. This includes
\`rsync --version\`, \`rsync --help\` and repeated \`--version\` for metadata
output supported by newer rsync releases. The command may contain only those
metadata flags, with at least one present. No transfer operands, helper commands,
daemon settings, file-output options or other options are included.

All transfer, deletion, overwrite, configuration and helper forms retain the
previous Baseline decision. Listings and dry runs can contact remote hosts or
run transport helpers, so they retain review. No special SSH pack is needed for
these built-in metadata queries.

Reviewed against the [upstream rsync manual](https://rsync.samba.org/ftp/rsync/rsync.1)
and installed macOS openrsync reporting rsync 2.6.9 protocol compatibility.
The local version query completed without a remote connection. Transfer
execution and native Windows behavior are not part of this validation.

Other rules, profiles and existing fixtures match [0.17.0](../0.17.0/README.md).
Published artifacts are immutable. This release does not activate policy in
existing projects; installed pack updates require review.

Generate with \`node scripts/build-baseline-rsync-metadata.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-rsync-metadata.test.mjs\`.

Licensed under MIT.
`;
}
export async function build() {
  await mkdir(destination, {recursive: true});
  for (const [name, document] of [['pack.yml', await metadataPack()], ['cases.json', await metadataReleaseCases()],
    ['commands.json', await metadataCommands()]])
    await writeFile(new URL(name, destination), JSON.stringify(document, null, 2) + '\n');
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', destination));
  await writeFile(new URL('README.md', destination), guide());
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
