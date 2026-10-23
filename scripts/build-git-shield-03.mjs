// Extend engine compatibility without changing published Git policy bytes.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const previous = new URL('../packs/canonic/git/0.6.2/', import.meta.url);
export const destination = new URL('../packs/canonic/git/0.6.3/', import.meta.url);
export async function gitShield03Pack() {
  const pack = JSON.parse(await readFile(new URL('pack.yml', previous)));
  return {...pack, version: '0.6.3', engines: {shield: '>=0.2.0, <0.4.0'}};
}
export async function build() {
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(await gitShield03Pack(), null, 2) + '\n');
  for (const name of ['cases.json', 'commands.json', 'LICENSE']) await copyFile(new URL(name, previous), new URL(name, destination));
  await writeFile(new URL('README.md', destination), `# Git permissions 0.6.3

Git inspection, staging, local changes, remote activity and destructive-operation
policy for Shield 0.2 and 0.3. Rules, profiles, executable inventory and fixtures
are identical to [Git 0.6.2](../0.6.2/README.md); only release identity and engine
compatibility differ. Published previous releases retain their original bytes.

Generate with \`node scripts/build-git-shield-03.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/git-shield-03.test.mjs\`.

Licensed under MIT.
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
