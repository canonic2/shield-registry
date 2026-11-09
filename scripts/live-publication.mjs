import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {checkCatalog, checkPublication, digest} from './registry-release.mjs';

const registryUrl = 'https://canonic2.github.io/shield-registry/';

async function download(path, fetcher) {
  const response = await fetcher(new URL(path, registryUrl), {
    signal:AbortSignal.timeout(15000), cache:'no-store', redirect:'error',
  });
  if (!response.ok) throw Error(`Live registry ${path}: HTTP ${response.status}`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1_048_576) throw Error(`Live registry ${path}: artifact exceeds byte limit`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** Verify the deployed signature, exact release bytes and every current pack. */
export async function checkLivePublication(root, fetcher = fetch) {
  const key = (await readFile(resolve(root,'keys/main.pub'),'utf8')).trim();
  const local = await checkPublication(resolve(root,'public'),key);
  const bytes = await download('catalog.json',fetcher);
  const signature = await download('catalog.sig',fetcher);
  const catalog = checkCatalog(bytes,signature.toString().trim(),key);
  if (!bytes.equals(await readFile(resolve(root,'public/catalog.json')))
    || !signature.equals(await readFile(resolve(root,'public/catalog.sig'))))
    throw Error(`Live registry sequence ${catalog.sequence} does not match local sequence ${local.sequence}; finish or reconcile the existing deployment before releasing`);
  for (const entry of catalog.packs) {
    if (digest(await download(entry.path,fetcher)) !== entry.sha256)
      throw Error(`Live registry digest mismatch: ${entry.id}@${entry.version}`);
  }
  return catalog;
}
