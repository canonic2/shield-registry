import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { caseFileNames } from './fixture-files.mjs';
import { nodeProjectTestsCases } from './node-project-tests-cases.mjs';

export const previous = new URL('../packs/canonic/node/0.6.1/', import.meta.url);
export const candidate = new URL('../packs/canonic/node/0.6.2/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, previous)));

export async function nodeProjectTestsRelease() {
  const pack = await read('pack.yml');
  pack.version = '0.6.2';
  pack.engines.shield = '>=0.57.0, <1.0.0';
  pack.capabilities.push('trust-execution-v1', 'argument-path-file-kind-v1', 'environment-unset-or-empty-v1');
  // Keep the previous binding and rule for selections that already reviewed both effects.
  delete pack.variables.host_node_tests.setup;
  pack.variables.project_node_tests = {
    type: 'choice', values: ['enabled'],
    description: 'Run trusted project Node tests, including their imports and child processes.',
    setup: { question: 'Run trusted project Node tests?', unset: 'Keep Shield review' },
  };
  pack.variables.codex_host_node_tests = {
    type: 'choice', values: ['enabled'],
    description: 'Grant Codex host access outside the sandbox for Node tests that Shield allows.',
    setup: { question: 'Let Codex run allowed Node tests outside its sandbox?', unset: 'Keep Codex sandbox approval' },
  };
  const grammar = {
    kind: 'options', prefix: ['--test'],
    flags: ['--test-only', '--test-force-exit', '--experimental-test-coverage'],
    values: [
      {name: '--test-concurrency', match: {regex: '^[1-9][0-9]*$'}},
      {name: '--test-name-pattern', match: {regex: '^[^-].*$'}},
      {name: '--test-skip-pattern', match: {regex: '^[^-].*$'}},
      {name: '--test-isolation', match: {one_of: ['process', 'none']}},
    ],
    operands: {match: {regex: String.raw`^[^!\-*?\[\]{}()][^*?\[\]{}()]*$`}, min: 0, max: 256},
  };
  const scope = {
    domain: 'argv', executable: 'node', cwd: {within: {root: 'project'}},
    arguments: grammar,
  };
  const decision = {loose: 'allow', recommended: 'allow', strict: 'ask'};
  const rules = [
    {
      id: 'node-trusted-project-tests',
      when: [{var: 'project_node_tests', equals: 'enabled'}],
      decision, trust_execution: true, conditions: scope,
      reason: 'Trust project Node test code, including imports, configuration and child processes.',
      requirements: {
        environment: {unset_or_empty: ['NODE_OPTIONS']},
        argument_paths: {grammar, operands: {kind: 'file', path: {within: {root: 'project'}}}},
      },
      on_unmet: {decision: 'ask', message: 'Trust requires project test files and an empty or unset NODE_OPTIONS.'},
    },
    {
      id: 'node-codex-test-prefix',
      when: [{var: 'codex_host_node_tests', equals: 'enabled'}],
      decision, conditions: scope,
      reason: 'Grant Codex host access when Shield allows a Node test request.',
      agents: {codex: {prefixes: [['node', '--test']]}},
    },
  ];
  pack.rules.push(...rules);
  const commands = await read('commands.json');
  commands.commands.find(row => row.name === 'node').rule_ids.push(...rules.map(rule => rule.id));
  const inherited = await readFile(new URL('README.md', previous), 'utf8');
  const readme = `# JavaScript ecosystem permissions 0.6.2

## Trusted project tests

Set \`project_node_tests: enabled\` to trust standalone \`node --test\` commands in
this project in Loose and Recommended. This covers test discovery and literal
test files that resolve to existing files within the project. The review
includes the tests' imports and child processes, including later changes to
that code. Startup overrides, test patterns with unverified paths and shell
compounds retain review. Strict keeps asking.

Set \`codex_host_node_tests: enabled\` separately to let Codex run allowed tests
outside its sandbox. Restart Codex in the trusted project to load that prefix.
Existing \`host_node_tests: enabled\` bindings retain their previously approved
combined execution and host access. This release requires Shield with
\`trust-execution-v1\`, \`argument-path-file-kind-v1\` and
\`environment-unset-or-empty-v1\`.

${inherited.slice(inherited.indexOf('One pack,')).trimStart().replace('>=0.53.0, <1.0.0', pack.engines.shield)}`;
  return {pack, commands, readme};
}

async function build() {
  const {pack, commands, readme} = await nodeProjectTestsRelease();
  const cases = await caseFileNames(previous);
  await mkdir(candidate, {recursive: true});
  for (const name of ['LICENSE', ...cases]) {
    await copyFile(new URL(name, previous), new URL(name, candidate));
  }
  await writeFile(new URL('pack.yml', candidate), JSON.stringify(pack) + '\n');
  await writeFile(new URL('commands.json', candidate), JSON.stringify(commands, null, 2) + '\n');
  await writeFile(new URL('README.md', candidate), readme);
  await writeFile(new URL(`cases-${cases.length + 1}.json`, candidate),
    JSON.stringify({schema_version: 1, cases: nodeProjectTestsCases}, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
