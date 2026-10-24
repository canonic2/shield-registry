// Releases that declare their tools' directory options, so Shield matches
// `npm --prefix DIR start` or `git -C DIR status` as the plain command run from
// DIR. Node drops its rules that repeated npm, pnpm and Yarn rules for those
// options; Corepack forms keep theirs, since the option follows the manager name.
import {readFile, writeFile, copyFile, mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const range = '>=0.7.0, <1.0.0';
const names = command => ['', '/bin/', '/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/'].map(prefix => prefix + command);

export const releases = [
  {name:'git', title:'Git', from:'0.6.5', version:'0.7.0',
    directoryOptions:[{executable:'git', option:'-C', forms:['separate'], repeat:'chain', paths:'follow'}],
    replaced:() => false,
    cases:[
      ...['loose', 'recommended', 'strict'].map(profile => ({name:`directory-option-status-${profile}`, profile, argv:['git', '-C', '.', 'status', '-u'], expected:'allow'})),
      ...[['loose', 'ask'], ['recommended', 'deny'], ['strict', 'deny']].map(([profile, expected]) => ({name:`directory-option-reset-hard-${profile}`, profile, argv:['git', '-C', '.', 'reset', '--hard', 'HEAD'], expected})),
    ]},
  {name:'node', title:'Node', from:'0.1.2', version:'0.2.0',
    directoryOptions:[
      {executable:{one_of:names('npm')}, option:'--prefix', position:'anywhere', paths:'follow'},
      {executable:{one_of:[...names('pnpm'), ...names('pn')]}, option:'--dir', paths:'follow'},
      {executable:{one_of:[...names('pnpm'), ...names('pn')]}, option:'-C', forms:['separate'], paths:'follow'},
      {executable:{one_of:[...names('yarn'), ...names('yarnpkg')]}, option:'--cwd', paths:'follow'},
    ],
    replaced:rule => /^(npm-prefix|pnpm-dir|yarn-cwd)-/.test(rule.id),
    cases:[
      ...[['loose', 'allow'], ['recommended', 'allow'], ['strict', 'deny']].map(([profile, expected]) => ({name:`directory-option-install-here-${profile}`, profile, argv:['npm', '--prefix', '.', 'install'], expected})),
      ...['loose', 'recommended', 'strict'].map(profile => ({name:`directory-option-install-outside-${profile}`, profile, argv:['npm', '--prefix', '../acme-other', 'install'], expected:'ask'})),
    ]},
];
export const directory = (release, version = release.version) => new URL(`../packs/canonic/${release.name}/${version}/`, import.meta.url);

export async function declaredPack(release) {
  const pack = JSON.parse(await readFile(new URL('pack.yml', directory(release, release.from))));
  return {...pack, version:release.version, engines:{shield:range},
    capabilities:[...pack.capabilities, 'directory-options-v1'].sort(),
    rules:pack.rules.filter(rule => !release.replaced(rule)), directory_options:release.directoryOptions};
}

// Shield checks a folder rule only on a folder that exists. The previous
// installs into `packages/web`, absent where fixtures run, now ask.
export const absentFolderInstall = fixture => /^(npm-prefix|npm-prefix-attached|pnpm-dir|pnpm-dir-attached|yarn-cwd)-install-/.test(fixture.name);
export const previousCases = (release, cases) => cases.map(fixture =>
  release.name === 'node' && absentFolderInstall(fixture) ? {...fixture, expected:'ask'} : fixture);

export async function build() {
  for (const release of releases) {
    const destination = directory(release);
    await mkdir(destination, {recursive:true});
    await writeFile(new URL('pack.yml', destination), JSON.stringify(await declaredPack(release), null, 2) + '\n');
    for (const name of ['commands.json', 'LICENSE']) {
      await copyFile(new URL(name, directory(release, release.from)), new URL(name, destination));
    }
    const cases = JSON.parse(await readFile(new URL('cases.json', directory(release, release.from))));
    await writeFile(new URL('cases.json', destination), JSON.stringify({...cases, cases:[...previousCases(release, cases.cases), ...release.cases]}, null, 2) + '\n');
    await writeFile(new URL('README.md', destination), `# ${release.title} permissions ${release.version}

Supports Shield \`${range}\`, which implements \`directory-options-v1\`.

This release declares the options that only choose the folder a tool works in:
${release.directoryOptions.map(d => `\`${d.option}\``).filter((v, i, all) => all.indexOf(v) === i).join(', ')}.
When no rule decides a command as written, Shield matches it as the same command
run from the chosen folder, so one project rule such as \`npm start\` with
\`cwd within project\` covers \`npm --prefix /path/to/project start\` too, and a
folder outside the project still needs review.
${release.name === 'node' ? `
The rules that repeated npm, pnpm and Yarn rules for \`--prefix\`, \`--dir\`,
\`-C\` and \`--cwd\` are removed; the plain rules decide those commands in the
chosen folder. Corepack forms keep their rules, because the option follows the
package manager's name there.

Shield checks a project-folder rule only on a folder that exists, so an install
into a folder that does not exist yet asks; the earlier cases that install into
an absent \`packages/web\` now expect Ask.
` : ''}
Other rules, profiles and the command inventory are unchanged from
${release.from}; see its [profile and coverage guide](../${release.from}/README.md).
The cases add the declared forms.

Generate with \`node scripts/build-directory-options.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/directory-options.test.mjs\`.
Published previous releases retain their original bytes.

Licensed under MIT.
`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
