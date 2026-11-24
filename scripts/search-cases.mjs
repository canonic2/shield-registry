const allow = ['allow', 'allow', 'allow'];
const metadata = ['allow', 'allow', 'ask'];
const review = ['ask', 'ask', 'ask'];
const sensitive = ['ask', 'ask', 'deny'];

// Expectations are reviewed from the published client interfaces and REST APIs.
const cli = [
  ['os-version', ['opensearch-cli', '--version'], allow],
  ['elastic-version', ['elastic', 'version'], allow],
  ['os-help', ['opensearch-cli', '--help'], allow],
  ['elastic-help', ['elastic', '--help'], allow],
  ['os-health', ['opensearch-cli', 'curl', 'get', '--path', '_cluster/health', '--profile', 'example'], sensitive],
  ['os-leading-profile', ['opensearch-cli', '-p', 'example', 'curl', 'get', '-P', '_cat/indices'], sensitive],
  ['os-interleaved-profile', ['opensearch-cli', 'curl', '--profile=example', 'delete', '--path=example-index'], sensitive],
  ['os-search-body', ['opensearch-cli', 'curl', 'get', '--path', 'example/_search', '--data=@query.json'], sensitive],
  ['os-bulk', ['opensearch-cli', 'curl', 'post', '--path=_bulk', '--data=@bulk.ndjson'], sensitive],
  ['os-security', ['opensearch-cli', 'curl', 'put', '--path=_plugins/_security/api/internalusers/example'], sensitive],
  ['os-snapshot', ['opensearch-cli', 'curl', 'post', '--path=_snapshot/example/backup/_restore'], sensitive],
  ['os-profile-create', ['opensearch-cli', 'profile', 'create', '--name=example', '--endpoint=https://search.example.org'], sensitive],
  ['os-ad-create', ['opensearch-cli', 'ad', 'create', 'example'], sensitive],
  ['os-ad-start', ['opensearch-cli', 'ad', 'start', 'example'], sensitive],
  ['os-ad-delete', ['opensearch-cli', 'ad', 'delete', 'example'], sensitive],
  ['os-knn', ['opensearch-cli', 'knn', 'warmup', 'example'], sensitive],
  ['es-search', ['elastic', 'stack', 'es', 'search', '--index=example'], sensitive],
  ['es-alias-search', ['elastic', 'es', 'search', '--input-file=./query.json'], sensitive],
  ['es-long-alias', ['elastic', 'elasticsearch', 'bulk', '--input-file=./bulk.json'], sensitive],
  ['es-leading-context', ['elastic', '--use-context=example', 'es', 'search'], sensitive],
  ['es-interleaved-config', ['elastic', 'stack', '--config-file', '/outside/config.yml', 'es', 'delete', '--index=example', '--id=1'], sensitive],
  ['es-script', ['elastic', 'es', 'scripts-painless-execute', '--input-file=./script.json'], sensitive],
  ['es-index-delete', ['elastic', 'es', 'indices', 'delete', '--index=example'], sensitive],
  ['es-snapshot', ['elastic', 'es', 'snapshot', 'restore', '--repository=example', '--snapshot=example'], sensitive],
  ['es-security', ['elastic', 'es', 'security', 'create-api-key', '--name=example'], sensitive],
  ['es-config', ['elastic', 'config', 'show'], sensitive],
  ['es-node', ['elasticsearch-node', 'unsafe-bootstrap'], sensitive],
  ['es-shard', ['elasticsearch-shard', 'remove-corrupted-data'], sensitive],
  ['es-users', ['elasticsearch-users', 'useradd', 'example'], sensitive],
  ['es-keystore', ['elasticsearch-keystore', 'show', 'example'], sensitive],
  ['os-keystore', ['opensearch-keystore', 'add', 'example'], sensitive],
  ['os-plugin', ['opensearch-plugin', 'install', 'example'], sensitive],
  ['es-server', ['elasticsearch', '-Epath.data=/outside/data'], sensitive],
  ['os-server', ['opensearch', '-Epath.data=/outside/data'], sensitive],
  ['native-help', ['elasticsearch-keystore', '--help'], allow],
  ['os-future', ['opensearch-cli', 'future', 'list'], review],
  ['elastic-future', ['elastic', 'future', 'list'], review],
  ['npm-launch', ['npx', '-y', '@elastic/cli@0.7.0', 'es', 'search'], review],
];

function web(url, method = 'GET', conditions = {redirects: 'none'}) {
  return {kind: 'web', action: 'fetch', url, method, query: null, conditions, original_input: {}};
}

const http = [
  ['health', 'http://localhost:9200/_cluster/health', 'GET', metadata],
  ['cat-indices', 'http://127.0.0.1:9200/_cat/indices?v=true', 'GET', metadata],
  ['https-health', 'https://localhost:9200/_cluster/health', 'HEAD', metadata],
  ['search', 'http://localhost:9200/example/_search', 'GET', review],
  ['document', 'http://localhost:9200/example/_doc/1', 'GET', review],
  ['cluster-settings', 'http://localhost:9200/_cluster/settings', 'GET', review],
  ['security', 'http://localhost:9200/_security/api_key', 'GET', sensitive],
  ['os-security', 'http://localhost:9200/_plugins/_security/api/internalusers', 'GET', sensitive],
  ['legacy-security', 'http://localhost:9200/_opendistro/_security/api/internalusers', 'GET', sensitive],
  ['snapshot-read', 'http://localhost:9200/_snapshot/example', 'GET', sensitive],
  ['search-post', 'http://localhost:9200/example/_search', 'POST', sensitive],
  ['index-document', 'http://localhost:9200/example/_doc/1', 'PUT', sensitive],
  ['bulk', 'http://localhost:9200/_bulk', 'POST', sensitive],
  ['delete-query', 'http://localhost:9200/example/_delete_by_query', 'POST', sensitive],
  ['delete-index', 'http://localhost:9200/example', 'DELETE', sensitive],
  ['snapshot-restore', 'http://localhost:9200/_snapshot/example/backup/_restore', 'POST', sensitive],
  ['snapshot-delete', 'http://localhost:9200/_snapshot/example/backup', 'DELETE', sensitive],
  ['settings-write', 'http://localhost:9200/_cluster/settings', 'PUT', sensitive],
  ['remote', 'https://search.example.org:9200/_cluster/health', 'GET', review],
  ['wrong-port', 'http://localhost:9201/_cluster/health', 'GET', review],
  ['lookalike', 'http://localhost.example.org:9200/_cluster/health', 'GET', review],
  ['subdomain', 'http://search.localhost:9200/_cluster/health', 'GET', review],
  ['encoded-path', 'http://localhost:9200/_cluster%2fhealth', 'GET', review],
  ['traversal', 'http://localhost:9200/_cluster/health/../../example/_search', 'GET', review],
  ['unknown-method', 'http://localhost:9200/_cluster/health', 'OPTIONS', review],
];

export function searchCases() {
  return {schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap((profile, index) => [
    ...cli.map(([name, argv, expected]) => ({name: `cli-${name}-${profile}`, profile, argv, expected: expected[index]})),
    ...http.map(([name, url, method, expected]) => ({name: `http-${name}-${profile}`, profile,
      variables: {local_http: true}, input: web(url, method), expected: expected[index]})),
    ...[{}, {local_http: false}].map((variables, variant) => ({name: `http-no-opt-in-${variant}-${profile}`, profile, variables,
      input: web('http://localhost:9200/_cluster/health'), expected: 'ask'})),
    {name: `redirect-${profile}`, profile, variables: {local_http: true},
      input: web('http://localhost:9200/_cluster/health', 'GET', {redirects: 'follow'}), expected: 'ask'},
    {name: `missing-redirect-evidence-${profile}`, profile, variables: {local_http: true},
      input: web('http://localhost:9200/_cluster/health', 'GET', {}), expected: 'ask'},
    {name: `shell-health-${profile}`, profile, variables: {local_http: true}, input: {kind: 'shell', dialect: 'posix',
      dialect_version: null, source: 'curl -fsS http://localhost:9200/_cluster/health', original_input: {}}, expected: metadata[index]},
    {name: `shell-query-${profile}`, profile, variables: {local_http: true}, input: {kind: 'shell', dialect: 'posix',
      dialect_version: null, source: 'curl -s http://localhost:9200/example/_search', original_input: {}}, expected: 'ask'},
    {name: `shell-write-${profile}`, profile, variables: {local_http: true}, input: {kind: 'shell', dialect: 'posix',
      dialect_version: null, source: 'curl -X DELETE http://localhost:9200/example', original_input: {}}, expected: 'ask'},
    {name: `mcp-unclassified-${profile}`, profile, input: {kind: 'mcp', server: 'search', tool: 'search',
      arguments: {query: 'example'}, original_input: {}}, expected: 'ask'},
  ])};
}
