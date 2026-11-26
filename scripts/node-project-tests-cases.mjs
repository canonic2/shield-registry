const trust = {project_node_tests: 'enabled'};
const host = {codex_host_node_tests: 'enabled'};
const first = 'scripts/node-host-tests.test.mjs';
const second = 'scripts/node-project-tests.test.mjs';
const variants = [
  ['defaults ask', 'recommended', {}, 'node --test', 'ask'],
  ['trust discovery', 'loose', trust, 'node --test', 'allow'],
  ['trust first test', 'recommended', trust, `node --test ${first}`, 'allow'],
  ['trust second test', 'recommended', trust, `node --test --test-concurrency=2 ${second}`, 'allow'],
  ['strict asks', 'strict', trust, `node --test ${first}`, 'ask'],
  ['host access alone asks', 'recommended', host, `node --test ${first}`, 'ask'],
  ['both permissions', 'recommended', {...trust, ...host}, `node --test ${first}`, 'allow'],
  ['legacy binding', 'recommended', {host_node_tests: 'enabled'}, `node --test ${first}`, 'allow'],
  ['missing file', 'recommended', trust, 'node --test missing.test.mjs', 'ask'],
  ['directory', 'recommended', trust, 'node --test scripts', 'ask'],
  ['outside project', 'recommended', trust, 'node --test ../external.test.mjs', 'ask'],
  ['unresolved test glob', 'recommended', trust, "node --test 'scripts/*.test.mjs'", 'ask'],
  ['startup preload', 'recommended', trust, `node --test --import ${first}`, 'ask'],
  ['startup environment assignment', 'recommended', trust, `NODE_OPTIONS=--require=${first} node --test`, 'ask'],
  ['shell chain', 'recommended', trust, `node --test ${first} && node --version`, 'ask'],
];

export const nodeProjectTestsCases = variants.map(([name, profile, variables, source, expected]) => ({
  name: `project-node-tests: ${name}`, profile, variables,
  input: {kind: 'shell', dialect: 'posix', dialect_version: null, source, original_input: {}},
  expected,
}));
