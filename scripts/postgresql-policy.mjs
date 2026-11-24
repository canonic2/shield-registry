import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const commands = ['psql', 'pg_dump', 'pg_dumpall', 'pg_restore', 'pg_isready', 'createdb', 'dropdb',
  'createuser', 'dropuser', 'vacuumdb', 'reindexdb', 'clusterdb', 'pg_amcheck', 'pg_basebackup', 'pg_config', 'pgbench'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const remove = {loose: 'ask', recommended: 'deny', strict: 'deny'};

export function postgresqlPack() {
  const rules = [];
  for (const name of commands) {
    const executable = {one_of: executableForms(name)};
    const rule = (id, args, decision, reason, extra = {}) => ({id: `${name}-${id}`,
      conditions: {domain: 'argv', executable, arguments: args}, decision, reason, ...extra});
    const info = name === 'pg_config' ? ['--version', '--help'] : ['--version', '-V', '--help', '-?'];
    for (const flag of info) rules.push(rule(`info-${flag.replaceAll('-', '').replace('?', 'question')}`,
      {kind: 'exact', values: [flag]}, 'allow', 'Print version or built-in help from the trusted installation.'));
    if (name === 'pg_restore') rules.push(rule('clean', {kind: 'risk_tokens', prefix: [],
      any_of: ['--clean', {regex: '--clean=.*'}, {regex: '-[A-Za-z]*c[A-Za-z]*'}]}, remove,
    'Review dropping existing database objects before restoring.'));
    rules.push(rule('operation', {kind: 'any'}, name === 'pg_config' ? 'allow'
      : name === 'pg_isready' ? 'ask' : ['dropdb', 'dropuser'].includes(name) ? remove : review,
    name === 'pg_config' ? 'Print installation configuration; pg_config has no database, file-output or execution mode.'
      : name === 'pg_isready' ? 'Review the resolved connection target and libpq settings before probing server readiness.'
        : 'Review SQL, client meta-commands, connection identity, credentials, files and database changes.',
    {fallback: true}));
  }
  return {schema_version: 1, kind: 'pack', id: 'canonic/postgresql', version,
    description: 'PostgreSQL client, backup, restore and administration permissions with review for SQL, connections, exports and lifecycle changes.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'regex-v1', 'fallback-rules-v1'], rules};
}
