import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const destructive = {loose: 'ask', recommended: 'deny', strict: 'deny'};
const packageSelector = {regex: '(?:prisma|prisma7|@prisma/prisma7)(?:@[A-Za-z0-9][A-Za-z0-9._~^+*-]*)?'};
export const commands = ['prisma', 'prisma7', 'npx', 'npm', 'pnpm', 'yarn', 'bunx', 'bun'];
const routes = [
  ['prisma', []], ['prisma7', []], ['npx', [packageSelector]],
  ['npm', ['exec', packageSelector]], ['npm', ['exec', '--', packageSelector]],
  ['pnpm', [packageSelector]], ['pnpm', ['exec', packageSelector]], ['pnpm', ['dlx', packageSelector]],
  ['yarn', [packageSelector]], ['yarn', ['exec', packageSelector]], ['yarn', ['dlx', packageSelector]],
  ['bunx', [packageSelector]], ['bun', ['x', packageSelector]],
];
const leading = {flags: ['--help', '-h', '--version', '-v', '--json', '--experimental', '--preview-feature', '--early-access',
  '--yes', '-y', '--no-install', '--offline', '--silent'],
values: ['--schema', '--config', '--url', '--telemetry-information', '--cwd', '--dir', '-C', '--prefix', '--cache'], interleaved: true};
export const operationInventory = ['init', 'bootstrap', 'dev', 'generate', 'validate', 'format', 'studio', 'version', 'debug', 'complete',
  'db pull', 'db push', 'db seed', 'db execute', 'migrate dev', 'migrate deploy', 'migrate status', 'migrate diff', 'migrate resolve', 'migrate reset',
  'orm init', 'contract emit', 'contract infer', 'contract format', 'db init', 'db update', 'db migrate', 'db verify', 'db sign',
  'migration plan', 'migration status', 'migration list', 'migration log', 'migration graph', 'migration ref',
  'auth', 'project', 'branch', 'postgres', 'bucket', 'service', 'git', 'deploy', 'platform', 'mcp', 'lsp'];

export function prismaPack() {
  const rules = [];
  for (const [index, [name, prefix]] of routes.entries()) {
    const executable = {one_of: executableForms(name)};
    const rule = (id, args, decision, reason, extra = {}) => ({id: `route-${index}-${id}`,
      conditions: {domain: 'argv', executable, arguments: args}, decision, reason, ...extra});
    rules.push(rule('review', prefix.length ? {kind: 'prefix', values: prefix, leading} : {kind: 'any'}, review,
      'Review executable Prisma configuration, generators, package acquisition, local files, listeners, credentials and database effects.', {fallback: true}));
    for (const command of ['migrate reset', 'db reset', 'postgres delete', 'project delete', 'branch delete', 'bucket delete', 'service delete'])
      rules.push(rule(command.replaceAll(' ', '-'), {kind: 'prefix', values: [...prefix, ...command.split(' ')], leading}, destructive,
        'Review database resets and remote resource deletion.'));
    // A conservative risk scan tightens explicit destructive push flags. It
    // cannot grant an allowance and need not parse the surrounding SQL/config.
    rules.push(rule('destructive-switch', {kind: 'options', prefix, leading, flags: [], values: [],
      optional_values: ['--force-reset', '--accept-data-loss'], operands: true, unknown_options: 'skip',
      require_any: ['--force-reset', '--accept-data-loss']}, destructive,
    'Review explicit consent to data loss or forced database reset.'));
  }
  return {schema_version: 1, kind: 'pack', id: 'canonic/prisma', version,
    description: 'Prisma ORM and package-runner permissions with review for executable configuration, generation, migrations and destructive database operations.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'prefix-leading-v1', 'interleaved-leading-v1', 'regex-v1', 'fallback-rules-v1', 'unknown-options-v1'], rules};
}
