export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
const sensitive = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const metadata = {loose: 'allow', recommended: 'allow', strict: 'ask'};

export const nativeTools = [
  'elasticsearch', 'opensearch', 'elasticsearch-certgen', 'elasticsearch-certutil',
  'elasticsearch-create-enrollment-token', 'elasticsearch-croneval', 'elasticsearch-keystore',
  'elasticsearch-node', 'elasticsearch-plugin', 'elasticsearch-reconfigure-node',
  'elasticsearch-reset-password', 'elasticsearch-saml-metadata', 'elasticsearch-setup-passwords',
  'elasticsearch-shard', 'elasticsearch-syskeygen', 'elasticsearch-users',
  'elasticsearch-sql-cli', 'opensearch-keystore', 'opensearch-plugin', 'opensearch-node',
];
const identities = name => ({one_of: [name, `${name}.exe`, `/usr/bin/${name}`, `/usr/local/bin/${name}`, `/opt/homebrew/bin/${name}`]});
const argv = (id, executable, arguments_, decision, reason) => ({id, decision, reason,
  conditions: {domain: 'argv', executable: identities(executable), arguments: arguments_}});
const osLeading = {flags: ['--help', '-h'], values: ['--config', '-c', '--profile', '-p'], interleaved: true};
const elasticLeading = {flags: ['--json'], values: ['--config-file', '--use-context', '--command-profile',
  '--output-fields', '--output-template'], interleaved: true};
const local = {schemes: ['http', 'https'], hosts: ['localhost', '127.0.0.1'], ports: [9200]};
const enabled = [{var: 'local_http', equals: true}];
const metadataPath = {regex: '^/(?:_cluster/health|_cat/(?:health|indices|nodes|shards|count|aliases|plugins))/?$'};

export function searchPack() {
  const rules = [];
  for (const name of ['opensearch-cli', 'elastic', ...nativeTools]) {
    for (const [index, values] of [['--help'], ['-h']].entries()) {
      rules.push(argv(`${name}-help-${index}`, name, {kind: 'exact', values}, 'allow', 'Print built-in help.'));
    }
  }
  rules.push(
    argv('opensearch-cli-version', 'opensearch-cli', {kind: 'exact', values: ['--version']}, 'allow', 'Print the installed CLI version.'),
    argv('elastic-version', 'elastic', {kind: 'exact', values: ['version']}, 'allow', 'Print the installed CLI version.'),
    argv('opensearch-cli-operations', 'opensearch-cli', {kind: 'prefix', values: [{one_of: ['curl', 'ad', 'knn', 'profile']}], leading: osLeading},
      sensitive, 'Review cluster requests, data, detector changes, profile credentials and files.'),
    ...[['stack', 'es'], ['es'], ['elasticsearch']].map((values, index) => argv(`elastic-es-${index}`, 'elastic',
      {kind: 'prefix', values, leading: elasticLeading}, sensitive,
      'Review Elasticsearch queries, bulk requests, scripts, snapshots, settings, security and data changes.')),
    argv('elastic-config', 'elastic', {kind: 'prefix', values: ['config'], leading: elasticLeading}, sensitive,
      'Review connection configuration and credentials.'),
  );
  for (const name of nativeTools) {
    rules.push(argv(`${name}-operations`, name, {kind: 'any'}, sensitive,
      'Review server execution, plugins, local files, node repair, credentials and administrative operations.'));
  }
  for (const name of ['elastic', 'opensearch-cli']) {
    rules.push(argv(`${name}-unlisted`, name, {kind: 'any'}, 'ask', 'Review unclassified client commands and wrappers.'));
  }
  rules.push(
    {id: 'local-http-metadata', when: enabled, decision: metadata,
      reason: 'Inspect metadata from the explicitly selected local search service without following redirects.',
      conditions: {domain: 'web', action: 'fetch', url: {...local, path: metadataPath}, method: {one_of: ['GET', 'HEAD']}},
      requirements: {request_fields: {'/redirects': {exact: 'none'}}},
      on_unmet: {decision: 'ask', message: 'Establish that this metadata request cannot follow redirects.'}},
    {id: 'local-http-security', when: enabled, decision: sensitive,
      reason: 'Review security configuration, credentials, snapshot repositories and snapshot access.',
      conditions: {domain: 'web', action: 'fetch', url: {...local,
        path: {regex: '^/(?:_security|_snapshot|_plugins/_security|_opendistro/_security)(?:/.*)?$'}}}},
    {id: 'local-http-mutations', when: enabled, decision: sensitive,
      reason: 'Review mutations and request bodies, including searches submitted with POST.',
      conditions: {domain: 'web', action: 'fetch', url: local, method: {one_of: ['POST', 'PUT', 'PATCH', 'DELETE']}}},
    {id: 'local-http-other', when: enabled, decision: 'ask',
      reason: 'Review document content, queries, scripts, redirects and unclassified search-service requests.',
      conditions: {domain: 'web', action: 'fetch', url: {...local, path: {not: metadataPath}}}},
  );
  return {schema_version: 1, kind: 'pack', id: 'canonic/opensearch-elasticsearch', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'OpenSearch and Elasticsearch clients and administration, with optional local HTTP metadata inspection and review for data, scripts, mutations, security and snapshots.',
    capabilities: ['argument-rules-v1', 'interleaved-leading-v1', 'negated-selectors-v1', 'prefix-leading-v1', 'regex-v1', 'requirements-v1', 'structured-rules-v1', 'variables-v1'],
    variables: {local_http: {type: 'boolean', default: false,
      description: 'Apply search-service HTTP policy to localhost and 127.0.0.1 on port 9200. Enable only when these addresses serve your search cluster.',
      setup: {question: 'Apply HTTP permissions to your local search cluster on port 9200?'}}},
    rules};
}

export function searchInventory(pack = searchPack()) {
  return {schema_version: 1, commands: ['opensearch-cli', 'elastic', ...nativeTools].map(name => ({name,
    rule_ids: pack.rules.filter(row => row.conditions.domain === 'argv' && row.conditions.executable.one_of[0] === name).map(row => row.id)}))};
}
