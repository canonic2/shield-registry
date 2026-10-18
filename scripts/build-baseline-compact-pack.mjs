import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildBaselinePack, baselineCommands } from './build-baseline-pack.mjs';
import { compactBaselinePack } from './baseline-compact.mjs';

const root = new URL('../packs/canonic/baseline/0.2.0/', import.meta.url);
const output = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : root;
await mkdir(output, { recursive: true });
const pack = buildBaselinePack({ version: '0.2.0', compact: true });
const source = buildBaselinePack();
const { families } = compactBaselinePack(source);
const sourceRules = new Map(source.rules.map(rule => [rule.id, rule]));
const commands = baselineCommands(pack);
for (const command of commands.commands) {
  command.source_rule_ids = command.rule_ids.flatMap(id => families[id])
    .filter(id => sourceRules.get(id).conditions.executable.one_of.includes(command.name));
}
await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
await writeFile(new URL('commands.json', output), JSON.stringify(commands, null, 2) + '\n');
for (const name of ['cases.json', 'LICENSE']) {
  await copyFile(new URL(`../packs/canonic/baseline/0.1.5/${name}`, import.meta.url), new URL(name, output));
}
const original = JSON.parse(await readFile(new URL('../packs/canonic/baseline/0.1.5/pack.yml', import.meta.url)));
console.log(`${original.rules.length} source rules; ${pack.rules.length} shared rule bodies`);
