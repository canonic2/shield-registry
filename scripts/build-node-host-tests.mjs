import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { caseFileNames } from './fixture-files.mjs';
import { nodeHostTestsCases } from './node-host-tests-cases.mjs';

export const previous = new URL('../packs/canonic/node/0.6.0/', import.meta.url);
export const candidate = new URL('../packs/canonic/node/0.6.1/', import.meta.url);
export const ruleId = 'node-host-project-tests';
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

export async function nodeHostTestsRelease() {
  const pack = await read('pack.yml');
  pack.version = '0.6.1';
  pack.capabilities.push('agent-outputs-v1', 'project-node-tests-v1');
  pack.variables.host_node_tests = {
    type: 'choice', values: ['enabled'],
    description: 'Allow reviewed project Node test code outside the Codex sandbox.',
    setup: { question: 'Run trusted project Node tests outside the Codex sandbox?', unset: 'Keep sandbox approval' },
  };
  pack.rules.push({
    id: ruleId,
    when: [{var: 'host_node_tests', equals: 'enabled'}],
    decision: {loose: 'allow', recommended: 'allow', strict: 'ask'},
    reason: 'Run trusted project Node tests outside the Codex sandbox, including their imports and child processes.',
    conditions: {
      domain: 'argv', executable: 'node',
      cwd: {within: {root: 'project'}},
      arguments: {kind: 'options', prefix: ['--test'],
        flags: ['--test-only', '--test-force-exit', '--experimental-test-coverage'],
        values: ['--test-concurrency', '--test-name-pattern', '--test-skip-pattern', '--test-isolation'], operands: true},
    },
    agents: {codex: {prefixes: [['node', '--test']], trust_project_node_tests: true}},
  });
  const commands = await read('commands.json');
  commands.commands.find(row => row.name === 'node').rule_ids.push(ruleId);
  const inherited = await readFile(new URL('README.md', previous), 'utf8');
  const readme = `# JavaScript ecosystem permissions 0.6.1

## Codex host access for trusted Node tests

The optional project setting \`host_node_tests: enabled\` exports a Codex
prefix for \`node --test\` in Loose and Recommended. After the operator reviews
the setting, restart Codex in the trusted project to load its rule. Node test
files, imports and child processes run with the host's permissions. Use this
setting in projects whose test code you trust. Strict continues to ask.

The allowance covers a standalone literal test command from inside the project.
Explicit files must resolve inside it. Shield still reviews shell chains,
environment overrides, preloads, arbitrary Node scripts and unknown options.
This release requires Shield with the \`project-node-tests-v1\` capability.

${inherited.slice(inherited.indexOf('\n') + 1).trimStart().replace('Unpublished successor to Node 0.5.1. One pack,', 'One pack,')}`;
  return {pack, commands, readme};
}

async function build() {
  const {pack, commands, readme} = await nodeHostTestsRelease();
  await mkdir(candidate, {recursive: true});
  await writeFile(new URL('pack.yml', candidate), JSON.stringify(pack) + '\n');
  await writeFile(new URL('commands.json', candidate), JSON.stringify(commands, null, 2) + '\n');
  await writeFile(new URL('README.md', candidate), readme);
  const cases = await caseFileNames(previous);
  for (const name of ['LICENSE', ...cases]) await copyFile(new URL(name, previous), new URL(name, candidate));
  await writeFile(new URL(`cases-${cases.length + 1}.json`, candidate),
    JSON.stringify({schema_version: 1, cases: nodeHostTestsCases}, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
