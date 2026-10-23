// Immutable compatibility releases for Shield 0.4, with explicit pager review.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export const releases = [
  {name:'baseline', from:'0.7.0', version:'0.8.0', range:'>=0.2.0, <0.5.0'},
  {name:'git', from:'0.6.3', version:'0.6.4', range:'>=0.2.0, <0.5.0'},
  {name:'node', from:'0.1.0', version:'0.1.1', range:'>=0.2.0, <0.5.0'},
  {name:'rust', from:'0.1.0', version:'0.1.1', range:'>=0.3.0, <0.5.0'},
];
export const directory = (release, version = release.version) => new URL(`../packs/canonic/${release.name}/${version}/`, import.meta.url);
const read = async (release, name) => JSON.parse(await readFile(new URL(name, directory(release, release.from))));

export async function compatiblePack(release) {
  const pack = await read(release, 'pack.yml');
  pack.version = release.version;
  pack.engines = {shield:release.range};
  if (release.name === 'baseline') {
    for (const rule of pack.rules.filter(rule => ['read-less', 'read-more'].includes(rule.id))) {
      rule.conditions.arguments = {kind:'any'};
      rule.decision = {loose:'ask', recommended:'ask', strict:'ask'};
      rule.reason = 'Pagers require command review because helpers and interactive commands can run programs or access additional files.';
      delete rule.requirements;
      delete rule.on_unmet;
    }
  }
  return pack;
}

export async function compatibleCases(release) {
  const cases = await read(release, 'cases.json');
  if (release.name === 'baseline') for (const fixture of cases.cases) {
    if (['less', 'more'].includes(fixture.argv?.[0]?.split('/').at(-1))) fixture.expected = 'ask';
  }
  return cases;
}

export async function build() {
  for (const release of releases) {
    const destination = directory(release);
    await mkdir(destination, {recursive:true});
    // Rust's complete grammar needs compact encoding to fit acquisition's 1 MiB cap.
    await writeFile(new URL('pack.yml', destination), JSON.stringify(await compatiblePack(release), null, release.name === 'rust' ? undefined : 2) + '\n');
    if (release.name === 'baseline') await writeFile(new URL('cases.json', destination), JSON.stringify(await compatibleCases(release), null, 2) + '\n');
    else await copyFile(new URL('cases.json', directory(release, release.from)), new URL('cases.json', destination));
    for (const name of ['commands.json', 'LICENSE']) await copyFile(new URL(name, directory(release, release.from)), new URL(name, destination));
    await writeFile(new URL('README.md', destination), `# ${release.name === 'baseline' ? 'Baseline' : release.name === 'git' ? 'Git' : release.name === 'node' ? 'Node' : 'Rust'} permissions ${release.version}

Supports Shield \`${release.range}\`, including Shield 0.4. Policy format and
capabilities are unchanged. See the [profile and coverage guide](../${release.from}/README.md)
for the command inventory and permission boundaries.

${release.name === 'baseline' ? 'Pagers (`less` and `more`) require review in every profile, including commands with readable files, logging options or helper environment variables. They can start subprocesses and access files beyond their input operands. File-read permission does not authorize pager execution. Outside-file pager commands also require review; these rules do not claim a complete file footprint. Other rules and protected-path guards still apply. Other command decisions match Baseline 0.7.0.' : `Rules, profiles, cases and command inventory are identical to ${release.from}; only release identity and Shield compatibility change.`}

Generate with \`node scripts/build-shield-04-packs.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/shield-04-packs.test.mjs\`.
Node and Rust composition checks run in the complete policy suite. Published
previous releases retain their original bytes.

Licensed under MIT.
`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
