// One-step maintainer release: update release.json, run every test against a
// real Shield, then sign and verify public/.
// Usage: npm run release -- ID@VERSION [--key PATH] [--shield PATH]
import { readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { build, checkPublication } from './registry-release.mjs';

const root = resolve(import.meta.dirname, '..');
// Remembers file paths only, never key material; ignored by Git.
const settingsPath = resolve(root, '.release.local.json');
// Accept pasted paths with surrounding quotes and a leading ~.
const expand = path => resolve(path.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^~(?=$|\/)/, homedir()));

/** Add the pack to the manifest and move the sequence one past the signed catalog. */
export function planRelease(release, publishedSequence, path) {
  const packs = release.packs.includes(path) ? release.packs : [...release.packs, path];
  return { ...release, sequence: publishedSequence + 1, packs };
}

async function ask(prompt, given, remembered) {
  if (given) return expand(given);
  if (!process.stdin.isTTY) return remembered ?? '';
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    // Prefill the last answer as editable input; Enter accepts it.
    const pending = readline.question(`${prompt}: `);
    if (remembered) readline.write(remembered);
    const answer = (await pending).trim();
    return answer ? expand(answer) : '';
  } finally { readline.close(); }
}

async function main(args) {
  const { values, positionals: [reference] } = parseArgs({ args, allowPositionals: true,
    options: { key: { type: 'string' }, shield: { type: 'string' } } });
  const match = /^(canonic\/[a-z0-9-]+)@(\d+\.\d+\.\d+)$/.exec(reference ?? '');
  if (!match) throw Error('Usage: npm run release -- canonic/PACK@VERSION [--key PATH] [--shield PATH]');
  const path = `packs/${match[1]}/${match[2]}/pack.yml`;
  await access(resolve(root, path)).catch(() => { throw Error(`Missing ${path}; generate the pack first`); });

  let settings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf8')); } catch {}
  const key = await ask('Private signing key path', values.key, settings.key);
  const shield = await ask('Shield binary path', values.shield, settings.shield);
  if (!key || !shield) throw Error('Pass --key PATH and --shield PATH once; later releases reuse them');
  await writeFile(settingsPath, JSON.stringify({ key, shield }, null, 2) + '\n');

  const published = JSON.parse(await readFile(resolve(root, 'public/catalog.json'), 'utf8'));
  const release = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
  const next = planRelease(release, published.sequence, path);
  await writeFile(resolve(root, 'release.json'), JSON.stringify(next, null, 2) + '\n');
  console.log(`Releasing ${reference} as catalog sequence ${next.sequence}.`);

  const rg = spawnSync('which', ['rg'], { encoding: 'utf8' }).stdout.trim();
  const tests = spawnSync(process.execPath, ['--test', 'scripts/*.test.mjs'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, SHIELD_BINARY: shield, ...(rg ? { RG_BINARY: rg } : {}) },
  });
  if (tests.status !== 0) throw Error('Tests failed; nothing was signed');

  const { catalog } = await build(root, key, shield);
  await checkPublication(resolve(root, 'public'), (await readFile(resolve(root, 'keys/main.pub'), 'utf8')).trim());
  const entry = catalog.packs.find(pack => pack.path === path);
  console.log(`Signed ${reference} (sha256 ${entry.sha256}) in public/. Review and commit the source and public/ together.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
