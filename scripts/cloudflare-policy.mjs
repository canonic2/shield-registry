import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const commands = ['wrangler', 'cloudflared', 'npx', 'npm', 'pnpm', 'yarn', 'bunx', 'bun'];
export const discoveryCommands = ['wrangler', 'cloudflared'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const destroy = {loose: 'ask', recommended: 'deny', strict: 'deny'};
const packageName = {regex: 'wrangler(?:@[A-Za-z0-9][A-Za-z0-9._~^+*-]*)?'};
const routes = [['wrangler', []], ['npx', [packageName]], ['npm', ['exec', packageName]],
  ['npm', ['exec', '--', packageName]], ['pnpm', [packageName]], ['pnpm', ['exec', packageName]],
  ['pnpm', ['dlx', packageName]], ['yarn', [packageName]], ['yarn', ['exec', packageName]],
  ['yarn', ['dlx', packageName]], ['bunx', [packageName]], ['bun', ['x', packageName]]];
const wranglerLeading = {flags: ['--help', '-h', '--version', '-v', '--experimental-new-config', '--yes', '-y',
  '--no-install', '--offline', '--silent'], values: ['--config', '-c', '--cwd', '--env', '-e', '--env-file',
  '--profile', '--experimental-config', '--prefix', '--dir', '-C', '--cache', '--registry'], interleaved: true};
const cloudflaredLeading = {flags: ['--no-autoupdate', '--no-prechecks', '--help', '-h', '--post-quantum', '--pq', '--overwrite-dns', '-f'],
  values: ['--config', '--origincert', '--credentials-file', '--cred-file', '--output', '--loglevel', '--logfile',
    '--log-directory', '--trace-output', '--metrics', '--pidfile', '--region', '--edge-ip-version', '--edge-bind-address',
    '--label', '--autoupdate-freq', '--transport-loglevel', '--proto-loglevel'], interleaved: true};

// Deliberate destructive boundaries, separate from the factual CLI inventory.
const destructiveWrangler = ['delete', 'preview delete', 'preview secret delete', 'preview base-config secret delete',
  'versions secret delete', 'secret delete', 'kv namespace delete', 'kv key delete', 'kv bulk delete',
  'artifacts repos delete', 'queues delete', 'queues purge', 'queues subscription delete', 'queues consumer remove',
  'queues consumer http remove', 'queues consumer worker remove', 'basin pipelines delete',
  'basin pipelines streams delete', 'basin pipelines sinks delete', 'r2 object delete', 'r2 bucket delete',
  'r2 bucket notification delete', 'r2 bucket domain remove', 'r2 bucket lifecycle remove', 'r2 bucket cors delete',
  'r2 bucket lock remove', 'd1 delete', 'd1 time-travel restore', 'vectorize delete', 'vectorize delete-vectors',
  'vectorize delete-metadata-index', 'hyperdrive delete', 'flagship apps delete', 'flagship apps rm',
  'flagship flags delete', 'flagship flags rm', 'flagship flags rules delete', 'turnstile widget delete',
  'tunnel delete', 'ai-search delete', 'ai-search namespace delete', 'cert delete', 'pages project delete',
  'pages deployment delete', 'pages secret delete', 'mtls-certificate delete', 'cloudchamber delete',
  'cloudchamber registries remove', 'cloudchamber images delete', 'containers delete', 'containers registries delete',
  'containers images delete', 'dispatch-namespace delete', 'agent-memory namespace delete', 'secrets-store store delete',
  'secrets-store secret delete', 'workflows delete', 'workflows instances terminate', 'workflows instances terminate-all',
  'workflows instances delete', 'pipelines delete', 'pipelines streams delete', 'pipelines sinks delete',
  'k2 streams delete', 'vpc service delete', 'email routing rules delete', 'email routing addresses delete',
  'auth delete', 'kv:namespace delete', 'kv:key delete', 'kv:bulk delete'];
const destructiveCloudflared = ['tunnel delete', 'tunnel cleanup', 'tunnel route ip delete', 'tunnel vnet delete', 'service uninstall'];

export function cloudflarePack() {
  const rules = [];
  const add = (id, name, arguments_, decision, reason) => rules.push({id,
    conditions: {domain: 'argv', executable: {one_of: executableForms(name)}, arguments: arguments_}, decision, reason});
  // Share final-verb alternatives only when their parent command is identical.
  const groups = new Map();
  for (const command of destructiveWrangler) {
    const words = command.split(' '), verb = words.pop(), parent = words.join(' ');
    groups.set(parent, [...(groups.get(parent) ?? []), verb]);
  }
  for (const [index, [name, prefix]] of routes.entries()) {
    add(`wrangler-route-${index}-review`, name, prefix.length ? {kind: 'prefix', values: prefix, leading: wranglerLeading} : {kind: 'any'},
      review, 'Review Worker/config/build execution, package acquisition, paths, listeners/tunnels, account/environment targets, data, secrets, uploads and remote changes.');
    for (const [parent, verbs] of groups) add(`wrangler-route-${index}-destroy-${parent.replaceAll(' ', '-') || 'worker'}`, name,
      {kind: 'prefix', leading: wranglerLeading, values: [...prefix, ...(parent ? parent.split(' ') : []), {one_of: verbs}]},
      destroy, 'Review explicit resource/data/secret deletion, restore, queue purge, consumer removal or workflow termination.');
  }
  for (const [index, flag] of ['--version', '-v', '--help', '-h'].entries())
    add(`wrangler-info-${index}`, 'wrangler', {kind: 'exact', values: [flag]}, 'allow', 'Print trusted installed Wrangler help/version without a project operation.');
  for (const root of ['deploy', 'dev', 'pages', 'kv', 'r2', 'd1', 'secret', 'secrets-store', 'tunnel', 'versions'])
    add(`wrangler-help-${root}`, 'wrangler', {kind: 'exact', values: [root, '--help']}, 'allow', 'Print built-in command help.');

  add('cloudflared-review', 'cloudflared', {kind: 'any'}, review,
    'Review credentials and account metadata, tunnel exposure, origins/routes, Access requests and subprocesses, DNS, logs, service installation and updates.');
  for (const operation of destructiveCloudflared) add(`cloudflared-${operation.replaceAll(' ', '-')}`, 'cloudflared',
    {kind: 'prefix', values: operation.split(' '), leading: cloudflaredLeading}, destroy,
    'Review deleting tunnels/routes/networks, disconnecting connectors or uninstalling a host service.');
  for (const [index, values] of [['--version'], ['-v'], ['-V'], ['version'], ['--help'], ['-h'], ['help'], ['h']].entries())
    add(`cloudflared-info-${index}`, 'cloudflared', {kind: 'exact', values}, 'allow', 'Print built-in installed-tool help/version.');
  for (const topic of ['tunnel', 'access', 'service', 'tunnel route', 'tunnel route ip', 'tunnel vnet', 'tunnel delete', 'tunnel cleanup', 'tunnel run'])
    for (const flag of ['--help', '-h']) add(`cloudflared-help-${topic.replaceAll(' ', '-')}-${flag.replaceAll('-', '')}`,
      'cloudflared', {kind: 'exact', values: [...topic.split(' '), flag]}, 'allow', 'Print built-in help without a connection or service change.');

  return {schema_version: 1, kind: 'pack', id: 'canonic/cloudflare', version, license: 'MIT', maintainers: ['Canonic'],
    engines: {shield: '>=0.53.0, <1.0.0'},
    description: 'Wrangler and cloudflared permissions for Workers/Pages, storage, secrets, deployments, tunnels, Access and host services, with reviewed execution/account access and stricter destructive operations.',
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'prefix-leading-v1', 'interleaved-leading-v1', 'regex-v1'], rules};
}
export function cloudflareInventory(pack = cloudflarePack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(row => row.conditions.executable.one_of.includes(name)).map(row => row.id)}))};
}
