import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { schemaValidator } from './schema-validation.mjs';
import { registryPage } from './registry-page.mjs';
import {buildHistory,checkReference,historyEntries} from './catalog-history.mjs';
import {caseFileNames} from './fixture-files.mjs';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const document = bytes => JSON.parse(bytes.toString('utf8'));
const encoded = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
// Matches the current Registry Kit client contract; do not raise server-only.
export const MAX_CATALOG_RELEASES = 64;

export function checkReleaseInventory(paths, format = 2) {
  if(![1,2,3].includes(format)) throw Error('Unsupported catalog publication format');
  if (!Array.isArray(paths) || paths.length < 1) throw Error('Release manifest must list pack paths');
  if (format !== 3 && paths.length > MAX_CATALOG_RELEASES)
    throw Error(`Release manifest has ${paths.length} releases; current clients support at most ${MAX_CATALOG_RELEASES}. Coordinate client/catalog capacity before publishing; do not drop retained releases.`);
  if (new Set(paths).size !== paths.length) throw Error('Release manifest contains duplicate pack paths');
}
const safePath = path => typeof path === 'string' && /^[a-zA-Z0-9._~/-]+$/.test(path)
  && path.split('/').every(part => part && part !== '.' && part !== '..');

// Catalog-owned hints, authenticated with the catalog, never permission rules.
export function checkCommands(commands, entries) {
  if (!commands || typeof commands !== 'object' || Array.isArray(commands)) throw Error('Invalid command associations');
  for (const [id, names] of Object.entries(commands)) {
    if (!entries.some(entry => entry.id === id && /^\d+\.\d+\.\d+$/.test(entry.version))
      || !Array.isArray(names) || names.length < 1 || names.length > 16
      || new Set(names).size !== names.length
      || names.some(name => typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(name))) {
      throw Error('Invalid command associations');
    }
  }
  return commands;
}

export function checkCatalog(bytes, signature, key, now = new Date()) {
  if(bytes.length>1_048_576) throw Error('Catalog exceeds byte limit');
  if (!/^[a-f0-9]{64}$/.test(key) || !/^[a-f0-9]{128}$/.test(signature)) throw Error('Invalid signature encoding');
  const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(key, 'hex').toString('base64url') }, format: 'jwk' });
  if (!verify(null, bytes, publicKey, Buffer.from(signature, 'hex'))) throw Error('Invalid catalog signature');
  const catalog = document(bytes);
  const fields = ['schema_version', 'registry_id', 'sequence', 'expires_at', 'packs', 'commands', 'histories'];
  if (Object.keys(catalog).some(field => !fields.includes(field))) throw Error('Unknown catalog field');
  if (![1, 2, 3].includes(catalog.schema_version) || catalog.registry_id !== 'canonic-shield-main'
    || !Number.isSafeInteger(catalog.sequence) || catalog.sequence < 1
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(catalog.expires_at)
    || !(new Date(catalog.expires_at) > now)
    || new Date(catalog.expires_at).toISOString().replace('.000Z', 'Z') !== catalog.expires_at
    || !Array.isArray(catalog.packs) || catalog.packs.length < 1
    || catalog.schema_version!==3 && catalog.packs.length > MAX_CATALOG_RELEASES
    || catalog.schema_version===3 && catalog.packs.length > 4096) throw Error('Invalid or expired catalog');
  const seen = new Set();
  for (const entry of catalog.packs) {
    if (Object.keys(entry).some(field => !['id', 'version', 'path', 'sha256'].includes(field))
      || !safePath(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || !/^canonic\/[a-z0-9-]+$/.test(entry.id) || !/^\d+\.\d+\.\d+$/.test(entry.version)
      || seen.has(`${entry.id}@${entry.version}`)) throw Error('Invalid or duplicate release');
    seen.add(`${entry.id}@${entry.version}`);
  }
  if (Object.hasOwn(catalog, 'commands')) {
    if (catalog.schema_version === 1) throw Error('Command associations require catalog v2 or v3');
    if(catalog.schema_version===2 && Object.keys(catalog.commands??{}).length>64) throw Error('Invalid command associations');
    checkCommands(catalog.commands, catalog.packs);
  }
  if(catalog.schema_version===3) {
    if(!catalog.histories || typeof catalog.histories!=='object' || Array.isArray(catalog.histories)
      ||Object.keys(catalog.histories).length!==catalog.packs.length
      ||new Set(catalog.packs.map(pack=>pack.id)).size!==catalog.packs.length) throw Error('Invalid history directory');
    for(const head of catalog.packs) {
      const reference=catalog.histories[head.id]; checkReference(reference);
      if(reference.last!==head.version) throw Error('History head mismatch');
    }
  } else if(Object.hasOwn(catalog,'histories')) throw Error('History requires catalog v3');
  return catalog;
}

export function checkPrevious(previous, next) {
  if (next.sequence <= previous.sequence) throw Error('Catalog sequence must increase');
  const indexed=new Map((next.releases??next.packs).map(entry=>[`${entry.id}@${entry.version}`,entry]));
  for (const entry of previous.releases??previous.packs) {
    const retained = indexed.get(`${entry.id}@${entry.version}`);
    if (!retained || retained.sha256 !== entry.sha256 || retained.path !== entry.path) throw Error('Published releases are immutable');
  }
}

async function regular(root, path) {
  if (!safePath(path)) throw Error('Unsafe artifact path');
  const owner = await lstat(root);
  if (owner.isSymbolicLink() || !owner.isDirectory()) throw Error('Publication root must be an owned directory');
  let current = root;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw Error('Linked publication path');
  }
  if (!(await lstat(current)).isFile()) throw Error('Publication artifact is not a regular file');
  const bytes = await readFile(current);
  if (bytes.length > 1_048_576) throw Error('Artifact exceeds Shield limit');
  return bytes;
}

export async function checkPublication(root, expectedKey, now = new Date()) {
  const key = (await regular(root, 'catalog-key.pub')).toString().trim();
  if (expectedKey !== undefined && expectedKey !== key) throw Error('Publication key does not match the reviewed root');
  const bytes = await regular(root, 'catalog.json');
  const signature = (await regular(root, 'catalog.sig')).toString().trim();
  const catalog = checkCatalog(bytes, signature, key, now);
  const releases = await historyEntries(catalog,path=>regular(root,path));
  for (const entry of releases) {
    const artifact = await regular(root, entry.path);
    if (digest(artifact) !== entry.sha256) throw Error('Artifact digest mismatch');
    const pack = document(artifact);
    if (pack.id !== entry.id || pack.version !== entry.version) throw Error('Artifact identity mismatch');
  }
  return catalog.schema_version===3 ? {...catalog,releases} : catalog;
}

async function validateRelease(shield, bytes, fixtures) {
  const owner = await mkdtemp(resolve(tmpdir(), 'shield-release-'));
  try {
    await writeFile(resolve(owner, 'pack.json'), bytes);
    const commands = [['__internal', 'validate', '--pack', resolve(owner, 'pack.json')]];
    for (const [name, cases] of fixtures) {
      await writeFile(resolve(owner, name), cases);
      commands.push(['__internal', 'test-pack', '--pack', resolve(owner, 'pack.json'), '--cases', resolve(owner, name)]);
    }
    for (const args of commands) {
      const result = spawnSync(shield, args, { encoding: 'utf8', timeout: 120_000 });
      if (result.error || result.status !== 0) throw Error('Shield validation failed');
      const value = JSON.parse(result.stdout);
      if (!(value.valid === true || value.passed === true)) throw Error('Shield validation did not pass');
    }
  } finally { await rm(owner, { recursive: true, force: true }); }
}

export async function build(root, keyPath, shield) {
  if (!keyPath || !shield) throw Error('Build requires a private key path and Shield binary');
  const release = document(await regular(root, 'release.json'));
  checkReleaseInventory(release.packs, release.catalog_version);
  const privateKey = createPrivateKey(await readFile(keyPath));
  if (privateKey.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 key required');
  const key = Buffer.from(createPublicKey(privateKey).export({ format: 'jwk' }).x, 'base64url').toString('hex');
  if ((await regular(root, 'keys/main.pub')).toString().trim() !== key) throw Error('Private key does not match the reviewed public root');
  const artifacts = [];
  const entries = [];
  const output = resolve(root, 'public');
  let previous;
  let previousExists = true;
  try { await lstat(output); }
  catch (error) { if (error.code !== 'ENOENT') throw error; previousExists = false; }
  // Authenticate retained bytes before admitting new releases. Historical
  // fixtures can encode an older engine's modeling limits; never rewrite them.
  if (previousExists) previous = await checkPublication(output, key, new Date(0));
  const validate = schemaValidator(document(await regular(root, 'schemas/policy.schema.json')));
  artifacts.push(['schemas/policy.schema.json', await regular(root, 'schemas/policy.schema.json')],
    ['schemas/policy-legacy.schema.json', await regular(root, 'schemas/policy-legacy.schema.json')],
    ['schemas/policy-shield-0.1.12.schema.json', await regular(root, 'schemas/policy-shield-0.1.12.schema.json')],
    ['LICENSE', await regular(root, 'LICENSE')]);
  for (const path of release.packs) {
    const bytes = await regular(root, path);
    const pack = document(bytes);
    if (pack.license === 'UNLICENSED') throw Error('Publication license required');
    const retained = (previous?.releases??previous?.packs)?.some(entry => entry.path === path && entry.id === pack.id
      && entry.version === pack.version && entry.sha256 === digest(bytes));
    if (pack.kind !== 'pack' && !retained) {
      throw Error('Historical format requires an unchanged authenticated published release');
    }
    const fixtureNames = await caseFileNames(resolve(root, dirname(path)));
    const fixtures = await Promise.all(fixtureNames.map(async name =>
      [name, await regular(root, `${dirname(path)}/${name}`)]));
    if (retained && JSON.stringify(fixtureNames) !== JSON.stringify(await caseFileNames(resolve(output, dirname(path)))))
      throw Error('Historical release assets changed');
    if (!retained) {
      if (!validate(pack) || fixtures.some(([, cases]) => !validate(document(cases))))
        throw Error('Structured schema validation failed');
      await validateRelease(shield, bytes, fixtures);
    }
    entries.push({ id: pack.id, version: pack.version, path, sha256: digest(bytes) });
    artifacts.push([path, bytes]);
    for (const name of [...fixtureNames, 'README.md', 'LICENSE', ...(pack.capabilities.includes('argv-options-v1') || pack.capabilities.includes('argument-rules-v1') ? ['commands.json'] : [])]) {
      const relative = `${dirname(path)}/${name}`;
      const content = fixtures.find(([file]) => file === name)?.[1] ?? await regular(root, relative);
      if (retained && !content.equals(await regular(output, relative))) throw Error('Historical release assets changed');
      artifacts.push([relative, content]);
    }
  }
  const commands = release.commands === undefined ? undefined : checkCommands(release.commands, entries);
  const history=release.catalog_version===3 ? buildHistory(entries) : undefined;
  if(history) artifacts.push(...history.artifacts);
  const catalog = { schema_version: history ? 3 : commands ? 2 : 1, registry_id: 'canonic-shield-main', sequence: release.sequence,
    expires_at: release.expires_at, packs: history?.packs??entries, ...(commands ? {commands} : {}),
    ...(history?{histories:history.histories}:{}) };
  const bytes = encoded(catalog);
  const signature = sign(null, bytes, privateKey).toString('hex');
  checkCatalog(bytes, signature, key);
  if (previous) {
    checkPrevious(previous, {...catalog,releases:entries});
  }
  const index = registryPage(catalog.packs);
  artifacts.push(['catalog.json', bytes], ['catalog.sig', Buffer.from(signature + '\n')],
    ['catalog-key.pub', Buffer.from(key + '\n')], ['index.html', Buffer.from(index)]);
  for (const [path, content] of artifacts) {
    await mkdir(resolve(output, dirname(path)), { recursive: true });
    await writeFile(resolve(output, path), content);
  }
  await checkPublication(output, key);
  return { key, catalog };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [command, root = '.', key, shield] = process.argv.slice(2);
    if (command === 'check') {
      const expected = (await regular(resolve(root, '..'), 'keys/main.pub')).toString().trim();
      console.log(JSON.stringify(await checkPublication(resolve(root), expected)));
    }
    else if (command === 'build') console.log(JSON.stringify(await build(resolve(root), key, shield)));
    else throw Error('Usage: registry-release.mjs check PUBLIC | build ROOT PRIVATE_KEY SHIELD');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
