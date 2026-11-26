const command = 'node --test --test-concurrency=1 scripts/node-host-tests.test.mjs';
const variants = [
  ['without opt-in', 'recommended', false, command, 'ask'],
  ['recommended opted-in project test', 'recommended', true, command, 'allow'],
  ['loose opted-in project discovery', 'loose', true, 'node --test', 'allow'],
  ['strict project tests', 'strict', true, command, 'ask'],
  ['preload', 'recommended', true, 'node --test --import=./scripts/test-loader.mjs', 'ask'],
  ['external test path', 'recommended', true, 'node --test ../outside.test.mjs', 'ask'],
  ['unknown option', 'recommended', true, 'node --test --not-a-test-option', 'ask'],
  ['shell chain', 'recommended', true, `${command} && node --version`, 'ask'],
];

export const nodeHostTestsCases = variants.map(([name, profile, enabled, source, expected]) => ({
  name: `host-node-tests: ${name}`, profile,
  ...(enabled ? { variables: { host_node_tests: 'enabled' } } : {}),
  input: { kind: 'shell', dialect: 'posix', dialect_version: null, source, original_input: {} },
  expected,
}));
