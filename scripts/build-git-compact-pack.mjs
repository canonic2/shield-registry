import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildGitPack } from './build-git-pack.mjs';

const root = new URL('../packs/canonic/git/0.5.0/', import.meta.url);
const inventory = JSON.parse(await readFile(new URL('commands.json', root)));
const pack = buildGitPack(inventory, { version: '0.5.0', compact: true });
const output = process.argv[2] ? pathToFileURL(resolve(process.argv[2]) + '/') : root;
await writeFile(new URL('pack.yml', output), JSON.stringify(pack, null, 2) + '\n');
const members = Object.values(pack.command_sets).reduce((count, set) => count + Object.keys(set).length, 0);
console.log(`${pack.rules.length} rule bodies; ${members} command members; one shared invocation group`);
