// Current search guidance, retaining the compact baseline's rule identities.
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBaselinePack } from './build-baseline-pack.mjs';

export function buildSearchPack() {
  const pack = buildBaselinePack({ version: '0.2.1', compact: true });
  pack.engine = '>=0.1.6, <0.2.0';
  const rule = pack.rules.find(rule => rule.conditions.executable?.one_of.includes('rg'));
  rule.on_unmet.message = 'Add --no-config. Filename listings accept globs. Content searches can honor ignore files and globs in bounded, approved directories; narrow any search that could reach protected files.';
  rule.on_unmet.alternatives = [
    'rg --no-config [-g GLOB] -n PATTERN DIR...',
    'rg --no-config --files [-g GLOB] [DIR...]',
    'rg --no-config -n PATTERN FILE...',
  ];
  return pack;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : new URL('../packs/canonic/baseline/0.2.1/', import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(new URL('pack.yml', output), JSON.stringify(buildSearchPack(), null, 2) + '\n');
  const cases = JSON.parse(await readFile(new URL('../packs/canonic/baseline/0.2.0/cases.json', import.meta.url)));
  const supported = new Set(['rg-ignore-loading', 'rg-cwd-ignore-loading', 'rg-glob-tree', 'rg-glob-override']);
  for (const fixture of cases.cases) {
    if (supported.has(fixture.name.replace(/-(loose|recommended|strict)$/, ''))) fixture.expected = 'allow';
  }
  await writeFile(new URL('cases.json', output), JSON.stringify(cases, null, 2) + '\n');
  for (const name of ['commands.json', 'LICENSE']) {
    await copyFile(new URL(`../packs/canonic/baseline/0.2.0/${name}`, import.meta.url), new URL(name, output));
  }
}
