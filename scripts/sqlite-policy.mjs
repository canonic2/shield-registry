import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
export const commands = ['sqlite3', 'sqldiff', 'sqlite3_analyzer', 'sqlite3_rsync'];
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};

// Exact information-only forms exit before database, script or remote operands
// are processed. Database operations require review regardless of their flags.
const information = {
  sqlite3: ['-help', '--help', '-version', '--version'],
  sqldiff: ['-help', '--help'],
  sqlite3_analyzer: ['-version', '--version'],
  sqlite3_rsync: ['--help', '--version'],
};

export function sqlitePack() {
  const rules = commands.flatMap(name => {
    const executable = {one_of: [...executableForms(name), `${name}.exe`]};
    return [
      ...information[name].map(flag => ({id: `${name}-info-${flag.slice(1).replaceAll('-', 'long-')}`,
        conditions: {domain: 'argv', executable, arguments: {kind: 'exact', values: [flag]}},
        decision: 'allow', reason: 'Print installed version or built-in usage without opening a database.'})),
      {id: `${name}-operation`, conditions: {domain: 'argv', executable, arguments: {kind: 'any'}},
        decision: review,
        reason: name === 'sqlite3'
          ? 'Review database paths, startup files, stdin, SQL, dot-commands, extensions and file or process effects.'
          : name === 'sqlite3_rsync'
            ? 'Review source and replica databases, SSH execution, remote paths and replica overwrites.'
            : 'Review database contents, local files, extension loading and generated SQL or reports.'},
    ];
  });
  return {schema_version: 1, kind: 'pack', id: 'canonic/sqlite', version,
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    description: 'SQLite shell, database comparison, analysis and synchronization with review for SQL, dot-commands, files, extensions, backups, exports and replication.',
    capabilities: ['argument-rules-v1', 'structured-rules-v1'], rules};
}

export function sqliteInventory(pack = sqlitePack()) {
  return {schema_version: 1, commands: commands.map(name => ({name,
    rule_ids: pack.rules.filter(rule => rule.conditions.executable.one_of[0] === name).map(rule => rule.id)}))};
}
