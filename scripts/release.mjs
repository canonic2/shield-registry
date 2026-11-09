// One-step maintainer release: update release.json, run every test against a
// real Shield, then sign and verify public/.
// Usage: npm run release -- ID@VERSION [--key PATH] [--shield PATH]
import { readFile, writeFile, access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {createPrivateKey, createPublicKey} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import { build, checkPublication, checkReleaseInventory } from './registry-release.mjs';
import {checkLivePublication} from './live-publication.mjs';
import { runTests } from './test.mjs';

const root = resolve(import.meta.dirname, '..');
// Remembers file paths only, never key material; ignored by Git.
const settingsPath = resolve(root, '.release.local.json');
// Accept pasted paths with surrounding quotes and a leading ~.
const expand = path => resolve(path.trim().replace(/^(['"])(.*)\1$/, '$2').replace(/^~(?=$|\/)/, homedir()));

/** Add the pack to the manifest and move the sequence one past the signed catalog. */
export function planRelease(release, publishedSequence, path) {
  const packs = release.packs.includes(path) ? release.packs : [...release.packs, path];
  const catalog_version=release.catalog_version??2;
  checkReleaseInventory(packs, catalog_version);
  return { ...release, catalog_version, sequence: publishedSequence + 1, packs };
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
    options: { key: { type: 'string' }, shield: { type: 'string' },
      preflight:{type:'boolean'}, 'check-live':{type:'boolean'} } });
  if (values['check-live']) {
    if (reference || values.preflight) throw Error('--check-live takes no release reference or --preflight');
    const catalog = await checkLivePublication(root);
    console.log(`Verified live catalog sequence ${catalog.sequence} and all ${catalog.packs.length} current pack digests.`);
    return;
  }
  const match = /^(canonic\/[a-z0-9-]+)@(\d+\.\d+\.\d+)$/.exec(reference ?? '');
  if (!match) throw Error('Usage: npm run release -- canonic/PACK@VERSION [--key PATH] [--shield PATH]');
  const path = `packs/${match[1]}/${match[2]}/pack.yml`;
  await access(resolve(root, path)).catch(() => { throw Error(`Missing ${path}; generate the pack first`); });

  let settings = {};
  try { settings = JSON.parse(await readFile(settingsPath, 'utf8')); } catch {}
  const key = await ask('Private signing key path', values.key, settings.key);
  const shield = await ask('Shield binary path', values.shield, settings.shield);
  if (!key || !shield) throw Error('Pass --key PATH and --shield PATH once; later releases reuse them');
  const privateKey = createPrivateKey(await readFile(key));
  const publicKey = Buffer.from(createPublicKey(privateKey).export({format:'jwk'}).x,'base64url').toString('hex');
  if (privateKey.asymmetricKeyType !== 'ed25519'
    || publicKey !== (await readFile(resolve(root,'keys/main.pub'),'utf8')).trim())
    throw Error('Private key does not match the reviewed Ed25519 public root');
  const version = spawnSync(shield,['--version'],{encoding:'utf8',timeout:10000});
  if (version.error || version.status !== 0) throw Error(`Shield executable unavailable: ${version.error?.message ?? version.stderr}`);
  const published = await checkLivePublication(root);
  const release = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
  const next = planRelease(release, published.sequence, path);
  const local = await checkPublication(resolve(root,'public'),publicKey);
  const retained = new Set((local.releases??local.packs).map(entry=>entry.path));
  const pending = next.packs.filter(entry=>!retained.has(entry));
  console.log(`Preflight passed: ${version.stdout.trim()}, live sequence ${published.sequence}, pending ${pending.join(', ') || 'none'}.`);
  if (values.preflight || pending.length === 0) return;
  await writeFile(settingsPath, JSON.stringify({ key, shield }, null, 2) + '\n');
  await writeFile(resolve(root, 'release.json'), JSON.stringify(next, null, 2) + '\n');
  console.log(`Releasing ${reference} as catalog sequence ${next.sequence}.`);

  if (runTests(shield) !== 0) throw Error('Tests failed; nothing was signed');

  const { catalog } = await build(root, key, shield);
  const verified = await checkPublication(resolve(root, 'public'), (await readFile(resolve(root, 'keys/main.pub'), 'utf8')).trim());
  const entry = (verified.releases??catalog.packs).find(pack => pack.path === path);
  console.log(`Signed ${reference} (sha256 ${entry.sha256}) in public/. Review and commit the source and public/ together.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
