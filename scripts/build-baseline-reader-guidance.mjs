import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const previous = new URL('../packs/canonic/baseline/0.21.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.21.1/', import.meta.url);
export const companions = ['commands.json', 'cases.json', 'cases-2.json', 'LICENSE'];

export async function baselineReaderGuidancePack() {
  const pack = JSON.parse(await readFile(new URL('pack.yml', previous)));
  pack.version = '0.21.1';
  const fallback = pack.rules.find(rule => rule.id === 'shared-unsupported-cat');
  fallback.reason = 'Shield could not verify the reader arguments.';
  fallback.guidance.message = 'Use explicit filenames and supported reader options. If a shell wildcard could not be checked, list the intended files first.';
  return pack;
}

export const guide = `# Baseline permissions 0.21.1

The fallback for \`cat\`, \`head\`, \`tail\` and \`wc\` explains how to retry with
explicit filenames when Shield cannot verify a shell wildcard. This pack
requires Shield \`>=0.57.0, <1.0.0\`.

On Unix, Shield 0.59.0 and later can check simple Bash reader globs such as
\`wc -l src/*.txt\` against the pack's ordinary file rules. If no files match
or Shield cannot verify the expansion, list the intended files and use
explicit filenames. For a standalone \`find src -type f -exec wc -l {} +\`,
Shield checks the directory walk and the files passed to \`wc\`. Shield blocks
command-running \`find\` forms it cannot verify. Run the listing first and then
pass the explicit files to the reader.

On a matching Shield MCP connection, all profiles allow \`docs_read\`,
including a line \`offset\` on Shield 0.59.0. Connections targeting another
project require approval. See [Baseline 0.21.0](../0.21.0/README.md) for
supported reader options and the Shield connection and review rules.

Generate with \`node scripts/build-baseline-reader-guidance.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/baseline-reader-guidance.test.mjs scripts/baseline-shield.test.mjs\`
using Shield 0.59.0 or later.

Licensed under MIT.
`;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await mkdir(destination, {recursive: true});
  for (const name of companions) await copyFile(new URL(name, previous), new URL(name, destination));
  await writeFile(new URL('pack.yml', destination), JSON.stringify(await baselineReaderGuidancePack(), null, 2) + '\n');
  await writeFile(new URL('README.md', destination), guide);
}
