// Republish the immutable Git 0.6.0 rules for Shield 0.1.13, which reads the
// `engines` field. Rules, fixtures and the command inventory are unchanged.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { currentFormat } from './pack-formats.mjs';

export const previous = new URL('../packs/canonic/git/0.6.0/', import.meta.url);
export const destination = new URL('../packs/canonic/git/0.6.1/', import.meta.url);

export async function gitEnginesPack() {
  const pack = currentFormat(JSON.parse(await readFile(new URL('pack.yml', previous))));
  pack.version = '0.6.1';
  pack.engines = { shield: '>=0.1.13, <0.2.0' };
  return pack;
}

export async function build(output = destination) {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('pack.yml', output), JSON.stringify(await gitEnginesPack(), null, 2) + '\n');
  for (const name of ['cases.json', 'commands.json', 'LICENSE']) await copyFile(new URL(name, previous), new URL(name, output));
  const replace = (text, from, to) => {
    if (!text.includes(from)) throw Error(`README text not found: ${from}`);
    return text.replace(from, () => to);
  };
  let guide = await readFile(new URL('README.md', previous), 'utf8');
  guide = replace(guide, '# Git permissions 0.6.0', '# Git permissions 0.6.1');
  guide = replace(guide, 'Requires Shield 0.1.8 or later', 'Requires Shield 0.1.13 or later');
  guide = replace(guide, '`node scripts/build-usable-packs.mjs` reproduces the compact source.',
    '`node scripts/build-git-engines.mjs` reproduces this release from 0.6.0, whose rules\nand fixtures it keeps unchanged; it declares its Shield versions with `engines`.');
  await writeFile(new URL('README.md', output), guide);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
