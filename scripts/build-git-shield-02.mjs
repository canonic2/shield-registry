// Preserve Git 0.6.1 policy and assets in a release admitted by Shield 0.2.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export const previous = new URL('../packs/canonic/git/0.6.1/', import.meta.url);
export const destination = new URL('../packs/canonic/git/0.6.2/', import.meta.url);
export async function gitShield02Pack() {
  const pack = JSON.parse(await readFile(new URL('pack.yml', previous)));
  return { ...pack, version: '0.6.2', engines: { shield: '>=0.2.0, <0.3.0' } };
}
export async function build(output = destination) {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('pack.yml', output), JSON.stringify(await gitShield02Pack(), null, 2) + '\n');
  for (const name of ['cases.json', 'commands.json', 'LICENSE']) await copyFile(new URL(name, previous), new URL(name, output));
  const guide = (await readFile(new URL('README.md', previous), 'utf8'))
    .replace('permissions 0.6.1', 'permissions 0.6.2')
    .replace('Shield 0.1.13 or later', 'Shield 0.2.0 or later')
    .replace('within the 0.1 series.', 'within the 0.2 series.')
    .replace(`Native Codex approval also needs actual execution cwd or the proven explicit
\`git -C /absolute/session/project\` form on every invocation; session cwd alone
does not establish the selected execution directory.`,
      `Codex PermissionRequest uses explicit workdir when supplied and otherwise the
reported cwd. Missing workdir or tool IDs do not add an approval requirement.
Policy Allow approves, Ask keeps the host prompt and Deny blocks.`)
    .replace('`node scripts/build-git-engines.mjs` reproduces this release from 0.6.0, whose rules\nand fixtures it keeps unchanged; it declares its Shield versions with `engines`.',
      '`node scripts/build-git-shield-02.mjs` reproduces this release from 0.6.1, whose rules\nand fixtures it keeps unchanged, for Shield 0.2.');
  await writeFile(new URL('README.md', output), guide);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
