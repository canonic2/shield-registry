// Independently reviewed requests. Do not derive decisions from policy tables.
const review = ['ask', 'ask', 'deny'];
const remove = ['ask', 'deny', 'deny'];
const ask = ['ask', 'ask', 'ask'];
const allow = ['allow', 'allow', 'allow'];
const tools = ['psql', 'pg_dump', 'pg_dumpall', 'pg_restore', 'pg_isready', 'createdb', 'dropdb',
  'createuser', 'dropuser', 'vacuumdb', 'reindexdb', 'clusterdb', 'pg_amcheck', 'pg_basebackup', 'pg_config', 'pgbench'];
const rows = [
  ['psql', ['-X', '-c', 'SELECT 1'], review],
  ['psql', ['-cSELECT 1'], review],
  ['psql', ['--command=SELECT pg_read_file(\'/etc/passwd\')'], review],
  ['psql', ['-c', 'DROP DATABASE example'], review],
  ['psql', ['-c', '\\! echo example'], review],
  ['psql', ['-c', '\\copy example TO PROGRAM \'cat\''], review],
  ['psql', ['-f', '/outside/query.sql'], review],
  ['psql', ['--file=-', '--single-transaction'], review],
  ['psql', ['-o', '/outside/export.txt', '-c', 'SELECT 1'], review],
  ['psql', ['--csv', '-c', 'SELECT side_effect()'], review],
  ['psql', ['-h', 'localhost'], review],
  ['psql', ['postgresql://example.com/example'], review],
  ['psql', ['service=example'], review],
  ['psql', ['--help', '-c', 'DELETE FROM example'], review],
  ['psql', ['--version', '-f', 'script.sql'], review],
  ['psql', [], review],
  ['pg_dump', ['--schema-only', '--file=/outside/schema.sql', 'example'], review],
  ['pg_dump', ['-Fc', '-f', 'backup.dump', 'example'], review],
  ['pg_dump', ['-Fd', '-f', '/outside/dump', 'example'], review],
  ['pg_dump', ['--dbname', 'host=example.com dbname=example sslmode=verify-full'], review],
  ['pg_dumpall', ['--globals-only', '--file', '/outside/roles.sql'], review],
  ['pg_restore', ['--list', '/outside/backup.dump'], review],
  ['pg_restore', ['--file', '/outside/restore.sql', 'backup.dump'], review],
  ['pg_restore', ['-d', 'example', 'backup.dump'], review],
  ['pg_restore', ['--clean', '--if-exists', '-d', 'example', 'backup.dump'], remove],
  ['pg_restore', ['-cv', '-dexample', 'backup.dump'], remove],
  ['pg_restore', ['--dbname=example', '--clean', '--create', 'backup.dump'], remove],
  ['pg_restore', ['-c', '--list', 'backup.dump'], remove],
  ['pg_isready', [], ask], ['pg_isready', ['-h', 'localhost', '-p', '5432'], ask],
  ['pg_isready', ['--dbname=host=example.com dbname=example'], ask],
  ['pg_isready', ['-h', '/outside/socket', '-t', '1'], ask],
  ['pg_isready', ['-h'], ask],
  ['createdb', ['--owner', 'example', 'example'], review],
  ['dropdb', ['--if-exists', '--force', 'example'], remove],
  ['dropdb', ['--host=example.com', '--', 'example'], remove],
  ['createuser', ['--superuser', 'example'], review], ['createuser', ['--pwprompt', 'example'], review],
  ['dropuser', ['--if-exists', 'example'], remove],
  ['vacuumdb', ['--full', '--all'], review], ['reindexdb', ['--system', 'example'], review],
  ['clusterdb', ['--all'], review], ['pg_amcheck', ['--all', '--install-missing'], review],
  ['pg_basebackup', ['-D', '/outside/backup', '--write-recovery-conf'], review],
  ['pgbench', ['--initialize', 'example'], review], ['pgbench', ['--select-only', 'example'], review],
  ['pgbench', ['-f', '/outside/workload.sql', 'example'], review],
  ['pg_config', [], allow], ['pg_config', ['--bindir', '--libdir', '--pgxs'], allow],
  ['pg_config', ['--configure', '--cc', '--cflags'], allow],
  ['psql', ['--future-option'], review], ['dropdb', ['--future-option'], remove],
];

export function postgresqlCases() {
  return {schema_version: 1, cases: ['loose', 'recommended', 'strict'].flatMap((profile, index) => [
    ...rows.map(([name, args, expected], n) => ({name: `${name}-${n}-${profile}`, profile, argv: [name, ...args], expected: expected[index]})),
    ...tools.flatMap(name => (name === 'pg_config' ? ['--version', '--help'] : ['--version', '-V', '--help', '-?']).map((flag, n) => ({
      name: `${name}-info-${n}-${profile}`, profile, argv: [name, flag], expected: 'allow',
    }))),
    ...tools.map(name => ({name: `${name}-absolute-${profile}`, profile, argv: [`/opt/homebrew/bin/${name}`, '--version'], expected: 'allow'})),
    ...tools.map(name => ({name: `${name}-foreign-${profile}`, profile, argv: [`/tmp/untrusted/${name}`, '--version'], expected: 'ask'})),
    ...[['psql -X -c "SELECT 1"', review], ['pg_restore --clean -d example backup.dump', remove],
      ['dropdb --if-exists example', remove], ['pg_isready -h localhost -p 5432', ask]].map(([source, expected], n) => ({
      name: `shell-${n}-${profile}`, profile, expected: expected[index],
      input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
    })),
  ])};
}
