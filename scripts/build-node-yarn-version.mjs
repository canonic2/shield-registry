import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {nodeYarnVersionCases} from './node-yarn-version-cases.mjs';

export const previous = new URL('../packs/canonic/node/0.5.0/', import.meta.url);
export const candidate = new URL('../packs/canonic/node/0.5.1/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

export async function nodeYarnVersionRelease() {
  const pack = await read('pack.yml');
  pack.version = '0.5.1';
  pack.capabilities.push('argument-paths-v1');
  const executable = pack.directory_options.find(option => option.option === '--cwd').executable;
  const version = {one_of: ['--version', '-v']};
  const routes = [
    ['yarn-cwd-node-version', ['--cwd', {regex: '.+'}]],
    ['yarn-cwd-equals-node-version', [{regex: '--cwd=.+'}]],
  ];
  for (const [id, prefix] of routes) pack.rules.push({
    id,
    conditions: {
      domain: 'argv', executable,
      cwd: {within: {root: 'project'}},
      arguments: {kind: 'sequence', prefix: [...prefix, 'node', version], rest: {kind: 'none'}},
    },
    requirements: {argument_paths: {
      grammar: {kind: 'options', prefix: [], flags: [], values: ['--cwd'], require_all: ['--cwd'],
        operands: true, parse: 'stop_at_operand'},
      options: {'--cwd': {path: {within: {root: 'project'}}}},
    }},
    decision: {loose: 'allow', recommended: 'allow', strict: 'ask'},
    on_unmet: {decision: 'ask', message: 'The Yarn working directory must resolve inside the project.'},
    reason: 'Print the Node version using the project-configured Yarn runtime. Strict reviews project code execution.',
  });

  const cases = await read('cases.json');
  cases.cases.push(...nodeYarnVersionCases);
  const commands = await read('commands.json');
  for (const command of commands.commands.filter(command => executable.one_of.includes(command.name))) {
    command.rule_ids.push(...routes.map(([id]) => id));
  }
  const guide = await readFile(new URL('README.md', previous), 'utf8');
  const readme = guide.replace('# Node permissions 0.5.0', '# Node permissions 0.5.1')
    .replace('| Project scripts,', '| Node version through Yarn with `--cwd` inside the project | Allow | Allow | Ask |\n| Project scripts,')
    .replace('## Read-only listings', `## Node version through Yarn

Use \`yarn --cwd packages/web node --version\` (or \`-v\`) to print the Node
version used by Yarn. Both the launch directory and the directory selected by
\`--cwd\` must be inside the project. No other Node arguments are covered by
this permission. Strict asks because Yarn can load project configuration and
runtime hooks.

## Read-only listings`)
    .replaceAll('node-everyday', 'node-yarn-version');
  return {pack, cases, commands, readme};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {pack, cases, commands, readme} = await nodeYarnVersionRelease();
  await mkdir(candidate, {recursive: true});
  for (const [name, document] of [['pack.yml', pack], ['cases.json', cases], ['commands.json', commands]]) {
    await writeFile(new URL(name, candidate), JSON.stringify(document, null, 2) + '\n');
  }
  await copyFile(new URL('LICENSE', previous), new URL('LICENSE', candidate));
  await writeFile(new URL('README.md', candidate), readme);
}
