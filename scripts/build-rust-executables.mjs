// Add reviewed machine-local rustup discovery without changing published bytes.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const destination = new URL('../packs/canonic/rust/0.2.1/', import.meta.url);
export async function rustPack() {
  const pack = JSON.parse(await readFile(new URL('../packs/canonic/rust/0.2.0/pack.yml', import.meta.url)));
  pack.version = '0.2.1';
  pack.engines.shield = '>=0.53.0, <1.0.0';
  pack.capabilities.push('executable-discovery-v1');
  pack.capabilities.sort();
  for (const tool of ['cargo', 'rustc', 'rustdoc', 'rustfmt', 'rustup']) {
    pack.variables[`${tool}_executable`].discover = [
      {env: 'CARGO_HOME', path: `bin/${tool}`}, {home: `.cargo/bin/${tool}`},
    ];
    pack.variables[`${tool}_executable`].description = `Additional ${tool} executable. Setup discovers the installed rustup proxy and records its exact path locally for review.`;
  }
  return pack;
}
export async function build() {
  const pack = await rustPack();
  await mkdir(destination, {recursive: true});
  await writeFile(new URL('pack.yml', destination), JSON.stringify(pack) + '\n');
  for (const name of ['commands.json', 'LICENSE', 'cases.json'])
    await copyFile(new URL(`../packs/canonic/rust/0.2.0/${name}`, import.meta.url), new URL(name, destination));
  const previousGuide = await readFile(new URL('../packs/canonic/rust/0.2.0/README.md', import.meta.url), 'utf8');
  const guide = previousGuide.replace('# Rust permissions 0.2.0', '# Rust permissions 0.2.1')
    .replace('>=0.20.0, <1.0.0', '>=0.53.0, <1.0.0')
    .replace('`node scripts/build-reviewed-profiles.mjs` and\n`node scripts/build-reviewed-profile-cases.mjs`', '`node scripts/build-rust-executables.mjs`')
    .replace('scripts/reviewed-profiles.test.mjs', 'scripts/rust-executables.test.mjs');
  await writeFile(new URL('README.md', destination), guide + `\n## Installed rustup executables\n\nShield 0.53.0 or later with executable-discovery-v1 discovers executable proxies\nunder CARGO_HOME/bin or ~/.cargo/bin during pack add and update. The ordinary\npack review includes the exact discovered paths, saved only in local settings.\nExisting explicit bindings and local opt-outs are preserved. No tool is executed\nduring discovery. Run pack configure to review discovery for an existing\nselection; through MCP, call pack_configure with its reference and no assignments.\nThe same operation, credential, output-path and Strict-profile rules apply to\ndiscovered paths. A different executable merely named cargo gains no permission.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
