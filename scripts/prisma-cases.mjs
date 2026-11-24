const review = ['ask', 'ask', 'deny'];
const destructive = ['ask', 'deny', 'deny'];
// These expectations and inventories are independent of the policy sources.
const operations = ['init', 'bootstrap', 'dev', 'generate', 'validate', 'format', 'studio', 'version', 'debug', 'complete',
  'db pull', 'db push', 'db seed', 'db execute', 'migrate dev', 'migrate deploy', 'migrate status', 'migrate diff', 'migrate resolve',
  'orm init', 'contract emit', 'contract infer', 'contract format', 'db init', 'db update', 'db migrate', 'db verify', 'db sign',
  'migration plan', 'migration status', 'migration list', 'migration log', 'migration graph', 'migration ref',
  'auth', 'project', 'branch', 'postgres', 'bucket', 'service', 'git', 'deploy', 'platform', 'mcp', 'lsp'];
const routes = [
  ['prisma'], ['prisma7'], ['npx', 'prisma'], ['npx', '-y', 'prisma@7.10.1'],
  ['npm', 'exec', '--', 'prisma'], ['npm', 'exec', 'prisma'],
  ['pnpm', 'prisma'], ['pnpm', 'exec', 'prisma'], ['pnpm', 'dlx', 'prisma@latest'],
  ['yarn', 'prisma'], ['yarn', 'exec', 'prisma'], ['yarn', 'dlx', 'prisma'],
  ['bunx', 'prisma'], ['bun', 'x', 'prisma'],
];
const extras = [
  [['prisma', 'migrate', 'dev', '--create-only'], review],
  [['prisma', 'db', 'execute', '--stdin'], review],
  [['prisma', 'db', 'execute', '--file=/outside/query.sql'], review],
  [['prisma', 'db', 'execute', '--url', 'postgresql://example.com/example', '--schema', '/outside/schema.prisma', '--stdin'], review],
  [['prisma', 'migrate', 'dev', '--skip-seed', '--skip-generate'], review],
  [['prisma', 'migrate', 'diff', '--from-url', 'postgresql://example.com/example', '--to-schema-datamodel', 'schema.prisma', '--script', '--output', '/outside/change.sql'], review],
  [['prisma', 'format', '--schema', '/outside/schema.prisma'], review],
  [['prisma', 'migrate', 'resolve', '--rolled-back', 'example'], review],
  [['npx', 'prisma-evil', 'migrate', 'reset'], ['ask', 'ask', 'ask']],
  [['prisma', 'generate', '--generator', 'custom', '--schema', '/outside/schema.prisma'], review],
  [['prisma', 'studio', '--browser', 'none'], review],
  [['prisma', '--config', '/outside/config.ts', 'migrate', 'reset', '--force'], destructive],
  [['prisma', 'migrate', '--schema=/outside/schema.prisma', 'reset'], destructive],
  [['prisma', 'db', 'push', '--accept-data-loss'], destructive],
  [['prisma', 'db', 'push', '--force-reset=true'], destructive],
  [['prisma', 'db', 'push', '--force-reset=false'], destructive],
  [['prisma', '--help'], review], [['prisma', '--version'], review], [['prisma', '-v'], review],
  [['prisma', 'migrate', 'reset', '--help'], destructive],
  [['prisma', '--config'], review], [['prisma', 'future-command'], review],
  [['pnpm', '--dir', '/outside', 'exec', 'prisma', 'migrate', 'reset'], destructive],
  [['npx', '--no-install', 'prisma7', 'migrate', 'reset'], destructive],
  [['npx', '@prisma/prisma7@7', 'migrate', 'reset'], destructive],
  [['prisma', 'db', 'reset'], destructive], [['prisma', 'postgres', 'delete', 'example'], destructive],
  [['prisma', 'project', 'delete', 'example'], destructive], [['prisma', 'branch', 'delete', 'example'], destructive],
  [['prisma', 'bucket', 'delete', 'example'], destructive], [['prisma', 'service', 'delete', 'example'], destructive],
];

export function prismaCases() {
  // Exercise every operation directly, and every runner at the execution and
  // destructive boundaries, keeping the artifact below 1,024 cases.
  return {schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap((profile, index) => [
    ...operations.map((command, n) => ({name: `operation-${n}-${profile}`, profile, argv: ['prisma', ...command.split(' ')], expected: review[index]})),
    ...routes.flatMap((route, n) => [
      {name: `route-${n}-generate-${profile}`, profile, argv: [...route, 'generate'], expected: review[index]},
      {name: `route-${n}-reset-${profile}`, profile, argv: [...route, 'migrate', 'reset', '--force'], expected: destructive[index]},
      {name: `route-${n}-data-loss-${profile}`, profile, argv: [...route, 'db', 'push', '--accept-data-loss'], expected: destructive[index]},
    ]),
    ...extras.map(([argv, expected], n) => ({name: `extra-${n}-${profile}`, profile, argv, expected: expected[index]})),
    {name: `absolute-${profile}`, profile, argv: ['/opt/homebrew/bin/prisma', 'migrate', 'reset'], expected: destructive[index]},
    {name: `foreign-${profile}`, profile, argv: ['/tmp/untrusted/prisma', 'migrate', 'reset'], expected: 'ask'},
    {name: `other-package-${profile}`, profile, argv: ['npx', 'other-package', 'migrate', 'reset'], expected: 'ask'},
    ...[['npx -y prisma migrate reset --force', destructive], ['prisma format --schema /outside/schema.prisma', review]].map(([source, expected], n) => ({
      name: `shell-${n}-${profile}`, profile, expected: expected[index],
      input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
    })),
  ])};
}
