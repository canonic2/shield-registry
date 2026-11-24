// Vendor command names are facts. Expected effects below are independent of
// cloudflare-policy.mjs and are never obtained from the evaluator.
import {wranglerOperations, wranglerCompatibilityOperations, cloudflaredOperations, cloudflaredCompatibilityOperations} from './cloudflare-inventory.mjs';
const allow = ['allow', 'allow', 'allow'];
const review = ['ask', 'ask', 'deny'];
const destroy = ['ask', 'deny', 'deny'];
const unknown = ['ask', 'ask', 'ask'];
const rows = [];

function expectedWrangler(operation) {
  const words = operation.split(' ');
  return words.some(word => /^(?:delete(?:-vectors|-metadata-index)?|remove|rm|purge|terminate(?:-all)?)$/.test(word))
    || operation === 'd1 time-travel restore' ? destroy : review;
}
for (const operation of [...wranglerOperations, ...wranglerCompatibilityOperations]) {
  const expected = expectedWrangler(operation);
  rows.push([['wrangler', ...operation.split(' ')], expected]);
  rows.push([['npx', 'wrangler', ...operation.split(' ')], expected]);
}
for (const operation of [...cloudflaredOperations, ...cloudflaredCompatibilityOperations])
  rows.push([['cloudflared', ...operation.split(' ')], operation === 'version' ? allow
    : /(?:^| )(?:delete|cleanup|uninstall)$/.test(operation) ? destroy : review]);

for (const flag of ['--version', '-v', '--help', '-h']) rows.push([['wrangler', flag], allow]);
for (const root of ['deploy', 'dev', 'pages', 'kv', 'r2', 'd1', 'secret', 'secrets-store', 'tunnel', 'versions'])
  rows.push([['wrangler', root, '--help'], allow]);
for (const args of [['--version'], ['-v'], ['-V'], ['version'], ['--help'], ['-h'], ['help'], ['h']])
  rows.push([['cloudflared', ...args], allow]);
for (const topic of ['tunnel', 'access', 'service', 'tunnel route', 'tunnel route ip', 'tunnel vnet', 'tunnel delete', 'tunnel cleanup', 'tunnel run'])
  for (const flag of ['--help', '-h']) rows.push([['cloudflared', ...topic.split(' '), flag], allow]);

const meaningful = [
  [['deploy', 'src/index.ts', '--env', 'production'], review],
  [['deploy', '--dry-run', '--outdir', '/outside/build'], review],
  [['deploy', '--temporary'], review], [['dev', '--local', '--ip', '0.0.0.0'], review],
  [['dev', '--remote', '--tunnel', '--tunnel-name', 'acme'], review],
  [['pages', 'deploy', 'dist', '--project-name', 'acme'], review],
  [['pages', 'dev', 'dist', '--', 'node', 'server.js'], review],
  [['types', 'worker-configuration.d.ts'], review],
  [['secret', 'put', 'API_TOKEN'], review], [['secret', 'bulk', '/outside/secrets.json'], review],
  [['secret', 'list'], review], [['secrets-store', 'secret', 'get', 'ExampleStore', 'ExampleSecret'], review],
  [['kv', 'key', 'get', 'example-key', '--namespace-id', 'ExampleNamespace'], review],
  [['kv', 'key', 'put', 'example-key', 'example-value', '--local'], review],
  [['r2', 'object', 'get', 'acme/file', '--file', '/outside/download'], review],
  [['r2', 'object', 'put', 'acme/file', '--file', '/outside/private.txt'], review],
  [['d1', 'execute', 'acme', '--local', '--command', 'SELECT 1'], review],
  [['d1', 'execute', 'acme', '--remote', '--file', '/outside/query.sql'], review],
  [['d1', 'export', 'acme', '--remote', '--output', '/outside/data.sql'], review],
  [['d1', 'migrations', 'apply', 'acme', '--local'], review],
  [['auth', 'token'], review], [['whoami'], review],
  [['tunnel', 'run', 'acme', '--url', 'http://127.0.0.1:8787'], review],
  [['delete', '--name', 'acme', '--dry-run'], destroy],
  [['r2', 'bucket', 'delete', 'acme'], destroy], [['kv', 'bulk', 'delete', 'keys.json'], destroy],
  [['secret', 'delete', 'API_TOKEN'], destroy], [['d1', 'time-travel', 'restore', 'acme'], destroy],
  [['queues', 'purge', 'acme'], destroy], [['pages', 'project', 'delete', 'acme'], destroy],
  [['pipelines', 'streams', 'delete', 'acme'], destroy],
];
const runnerForms = [
  ['npx', 'wrangler'], ['npm', 'exec', 'wrangler'], ['npm', 'exec', '--', 'wrangler'],
  ['pnpm', 'wrangler'], ['pnpm', 'exec', 'wrangler'], ['pnpm', 'dlx', 'wrangler'],
  ['yarn', 'wrangler'], ['yarn', 'exec', 'wrangler'], ['yarn', 'dlx', 'wrangler'],
  ['bunx', 'wrangler'], ['bun', 'x', 'wrangler'],
];
for (const [args, expected] of meaningful) {
  rows.push([['wrangler', ...args], expected]);
  for (const prefix of runnerForms) rows.push([[...prefix, ...args], expected]);
}
for (const prefix of runnerForms) {
  rows.push([[...prefix, '--version'], review], [[...prefix, '--help'], review]);
  rows.push([[...prefix.slice(0, -1), 'wrangler@4.167.0', 'd1', 'delete', 'acme'], destroy]);
  rows.push([[...prefix, '--config=/outside/wrangler.jsonc', 'r2', 'bucket', 'delete', 'acme'], destroy]);
}
rows.push(
  [['wrangler', '--env', 'production', 'kv', '--config', 'wrangler.toml', 'namespace', 'delete', 'ExampleNamespace'], destroy],
  [['wrangler', '-cwrangler.toml', '-eproduction', 'd1', 'delete', 'acme'], destroy],
  [['npx', '-y', 'wrangler@latest', 'delete', '--name', 'acme'], destroy],
  [['pnpm', '--dir', '/outside', 'exec', 'wrangler', 'd1', 'delete', 'acme'], destroy],
  [['wrangler', '--version', 'deploy'], review], [['wrangler', '--help', 'delete', 'acme'], destroy],
  [['wrangler', '--config'], review], [['wrangler', '--cwd', '/outside', 'dev'], review],
  [['wrangler'], review], [['wrangler', 'future-command'], review],
  [['cloudflared'], review], [['cloudflared', 'future-command'], review],
  [['cloudflared', 'tunnel', '--url', 'http://localhost:8080'], review],
  [['cloudflared', 'tunnel', 'run', '--token', 'example-placeholder'], review],
  [['cloudflared', 'tunnel', '--config', '/outside/config.yml', 'run', 'acme'], review],
  [['cloudflared', 'tunnel', '--logfile', '/outside/tunnel.log', 'list'], review],
  [['cloudflared', 'tunnel', 'route', 'dns', 'acme', 'app.example.com'], review],
  [['cloudflared', 'tunnel', 'route', 'ip', 'add', '192.0.2.0/24', 'acme'], review],
  [['cloudflared', 'access', 'curl', 'https://example.com', '-X', 'POST', '--data', '@payload.json'], review],
  [['cloudflared', 'access', 'ssh', '--hostname', 'ssh.example.com'], review],
  [['cloudflared', 'access', 'token', '--app', 'https://example.com'], review],
  [['cloudflared', 'service', 'install', 'example-placeholder'], review],
  [['cloudflared', 'tunnel', '--config', 'tunnel.yml', 'delete', 'acme', '--force'], destroy],
  [['cloudflared', '--region', 'us', 'tunnel', 'route', '--origincert', '/outside/cert.pem', 'ip', 'delete', '192.0.2.0/24'], destroy],
  [['cloudflared', 'tunnel', 'cleanup', '--connector-id', 'ExampleConnector', 'acme'], destroy],
  [['cloudflared', 'tunnel', 'vnet', 'delete', 'acme'], destroy],
  [['cloudflared', 'service', 'uninstall'], destroy],
  [['cloudflared', 'tunnel', 'delete'], destroy], [['cloudflared', 'tunnel', '--config'], review],
);
for (const [name, args, expected] of [['wrangler', ['deploy', 'src/index.ts'], review],
  ['wrangler', ['d1', 'delete', 'acme'], destroy], ['cloudflared', ['tunnel', 'run', 'acme'], review],
  ['cloudflared', ['tunnel', 'delete', 'acme'], destroy]]) {
  for (const path of ['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/']) rows.push([[path + name, ...args], expected]);
  rows.push([[`/outside/bin/${name}`, ...args], unknown], [[`${name}-unrelated`, ...args], unknown]);
}

export function cloudflareCases() {
  return {schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap((profile, index) =>
    rows.map(([argv, expected], row) => ({name: `cloudflare-${row}-${profile}`, profile, argv, expected: expected[index]})))
    .concat(['loose', 'recommended', 'strict'].map(profile => ({name: `cloudflare-unmatched-mcp-${profile}`, profile,
      input: {kind: 'mcp', server: 'cloudflare', tool: 'delete_worker', arguments: {}, original_input: {}}, expected: 'ask'})))};
}
