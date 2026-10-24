// Immutable compatibility releases for Shield's 0.x policy contract.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const releases = [
  {name:'baseline', from:'0.8.0', version:'0.8.1', range:'>=0.2.0, <1.0.0'},
  {name:'git', from:'0.6.4', version:'0.6.5', range:'>=0.2.0, <1.0.0'},
  {name:'node', from:'0.1.1', version:'0.1.2', range:'>=0.2.0, <1.0.0'},
  {name:'rust', from:'0.1.1', version:'0.1.2', range:'>=0.3.0, <1.0.0'},
];
export const directory = (release, version = release.version) => new URL(`../packs/canonic/${release.name}/${version}/`, import.meta.url);

export async function compatiblePack(release) {
  const pack = JSON.parse(await readFile(new URL('pack.yml', directory(release, release.from))));
  return {...pack, version:release.version, engines:{shield:release.range}};
}

export async function build() {
  for (const release of releases) {
    const destination = directory(release);
    await mkdir(destination, {recursive:true});
    await writeFile(new URL('pack.yml', destination), JSON.stringify(await compatiblePack(release), null, release.name === 'rust' ? undefined : 2) + '\n');
    for (const name of ['cases.json', 'commands.json', 'LICENSE']) {
      await copyFile(new URL(name, directory(release, release.from)), new URL(name, destination));
    }
    await writeFile(new URL('README.md', destination), `# ${release.name === 'baseline' ? 'Baseline' : release.name === 'git' ? 'Git' : release.name === 'node' ? 'Node' : 'Rust'} permissions ${release.version}

Supports Shield \`${release.range}\`. Shield 0.x releases preserve the supported
pack contract; a breaking change requires Shield 1.0.0. Required capabilities
and schema validation still apply. Compatible Shield minor releases do not
require a new pack release.

Rules, profiles, cases and command inventory are identical to ${release.from};
only release identity and Shield compatibility change. See the
[profile and coverage guide](../${release.from}/README.md) for permission boundaries.

Generate with \`node scripts/build-shield-0x-packs.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/shield-0x-packs.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
