// Layer filename-listing support over the immutable 0.3.0 release.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { append } from './usable-cases.mjs';

const previous = new URL('../packs/canonic/baseline/0.3.0/', import.meta.url);
export const destination = new URL('../packs/canonic/baseline/0.3.1/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

export async function hiddenListingsPack() {
  const pack = await read('pack.yml');
  pack.version = '0.3.1';
  pack.engine = '>=0.1.9, <0.2.0';
  const rule = pack.rules.find(rule => rule.id === 'read-rg');
  // The engine supplies complete targets for --hidden only with --files.
  // Retain the same root/exclusion requirements for every listing.
  rule.requirements.arguments.flags.push('--hidden');
  rule.on_unmet.message = 'Use supported search options and approved paths. Filename listings accept --hidden and globs; content searches retain their protected-file checks.';
  rule.on_unmet.alternatives = ['rg --files [--hidden] [-g GLOB] [DIR...]', 'rg [-g GLOB] -n PATTERN DIR...', 'rg -n PATTERN FILE...'];
  return pack;
}

export async function hiddenListingCases() {
  const cases = await read('cases.json');
  append(cases.cases, [
    ['hidden-listing', ['rg','--files','--hidden']],
    ['hidden-listing-reordered', ['rg','--hidden','--files','.']],
    ['hidden-listing-no-ignore', ['rg','--no-ignore','--files','--hidden','.']],
    ['hidden-listing-glob', ['rg','--files','--hidden','-g','!.git','.']],
    ['hidden-listing-attached-glob', ['rg','--hidden','--files','--glob=*.rs']],
    ['hidden-listing-agent-files', ['rg','--hidden','--files','-g','AGENTS.md','-g','.gitignore']],
    ['hidden-listing-no-config', ['rg','--no-config','--files','--hidden','.']],
    ['hidden-listing-bin', ['/usr/bin/rg','--files','--hidden','.']],
  ], ['allow','allow','allow']);
  append(cases.cases, [
    ['hidden-content', ['rg','--hidden','Acme','.']],
    ['hidden-content-names', ['rg','--hidden','--files-with-matches','Acme','.']],
    ['hidden-content-no-ignore', ['rg','--no-ignore','--hidden','Acme','.']],
    ['hidden-listing-outside', ['rg','--files','--hidden','/shield-baseline-unapproved']],
    ['hidden-listing-credential', ['rg','--files','--hidden','.aws']],
    ['hidden-listing-follow', ['rg','--files','--hidden','--follow','.']],
    ['hidden-listing-helper', ['rg','--files','--hidden','--pre','sh','.']],
    ['hidden-listing-late-option', ['rg','--files','.','--hidden']],
    ['hidden-listing-no-mode', ['rg','--hidden','.']],
    ['hidden-listing-mode-as-value', ['rg','--hidden','-g','--files','.']],
    ['hidden-listing-mode-as-operand', ['rg','--hidden','--','--files']],
  ], ['deny','deny','deny']);
  return cases;
}

export async function build(output = destination) {
  await mkdir(output, {recursive:true});
  await writeFile(new URL('pack.yml', output), JSON.stringify(await hiddenListingsPack(), null, 2) + '\n');
  await writeFile(new URL('cases.json', output), JSON.stringify(await hiddenListingCases(), null, 2) + '\n');
  for (const name of ['commands.json','LICENSE']) await copyFile(new URL(name, previous), new URL(name, output));
  const guide = (await readFile(new URL('README.md', previous), 'utf8'))
    .replace('permissions 0.3.0', 'permissions 0.3.1')
    .replace('Shield 0.1.8', 'Shield 0.1.9')
    .replace("rg --files -g '*.rs'", "rg --files --hidden -g '!.git'")
    .replace('Filename listings skip that content check.', 'Filename listings accept `--hidden` and skip that content check. Explicit `--hidden` content searches remain outside the supported model.');
  await writeFile(new URL('README.md', output), guide);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
