# PostgreSQL permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed against the PostgreSQL 19 client
reference on 2026-11-23. The source candidate covers the client, export,
restore and database-administration commands listed below.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact version and built-in help requests | Allow | Allow | Allow |
| pg_config installation metadata | Allow | Allow | Allow |
| pg_isready connection probes, including unknown syntax | Ask | Ask | Ask |
| psql SQL, meta-commands, files, stdin and interactive sessions | Ask | Ask | Deny |
| Database exports, backups, archive inspection and restores | Ask | Ask | Deny |
| Database/user creation, maintenance, integrity checks and benchmarks | Ask | Ask | Deny |
| dropdb, dropuser and pg_restore clean forms | Ask | Deny | Deny |

## Connection and execution effects

Every database connection requires review. Review covers the effective host,
port, database, role and credentials, including Unix sockets, libpq service
files, environment variables, connection strings and TLS settings. A connection
string can override separately supplied host options. Localhost and a database
name do not establish that data is disposable. pg_isready contacts the server
and can cause failed authentication attempts to appear in server logs.

psql can execute SQL from arguments, scripts, stdin or an interactive terminal.
Meta-commands can invoke a shell, read/write client files and copy data through
programs. Startup files, pagers and environment settings can execute local code.
`-X` disables startup files but retains the selected SQL and meta-command effects.
A SELECT can invoke functions with side effects or privileged file access.
All these forms retain review, including `--single-transaction` and read-only
transaction settings. The pack performs no SQL classification.

pg_dump, pg_dumpall and pg_basebackup can export sensitive database content,
roles or cluster files and write explicit or implicit destinations. Restores
can execute arbitrary code chosen by the source database's superusers.
`pg_restore --list` and SQL-file output require review for archive input and
output access. Clean restores can drop existing objects. Database and role
deletion are restricted across every option ordering and separator spelling.
Maintenance can lock or rewrite tables, and benchmarks can run scripts or
initialize data. pg_amcheck can install its required checking extension.

The pack automatically allows no database connection, export or file operation.
Ask leaves the complete request for host review, including every explicit path
and network target. Paths embedded in SQL, archives and connection settings
remain part of that review. Host enforcement governs inherited credentials,
configuration and process execution. Ask follows host approval or fallback behavior.

## Command inventory

- `psql`
- `pg_dump`
- `pg_dumpall`
- `pg_restore`
- `pg_isready`
- `createdb`
- `dropdb`
- `createuser`
- `dropuser`
- `vacuumdb`
- `reindexdb`
- `clusterdb`
- `pg_amcheck`
- `pg_basebackup`
- `pg_config`
- `pgbench`

The policy matches command basenames and standard Unix executable paths supplied
by the registry's shared executable forms. Installations in versioned package
directories can use their normal PATH command name. Other executable spellings,
server process tools such as pg_ctl/initdb/postgres, replication clients,
third-party wrappers and MCP servers use ordinary host fallback. Matching an
executable path trusts its installed bytes. Shell redirections use shell policy.

Known harmful families retain their decisions for unknown options. Exact help
allowances contain only one help/version argument; `-h` remains a host option.
All interfaces are retained in this first release. Future retirement requires
the first verified absence and three subsequent published feature releases.

## Evidence and reproduction

- [Client utility inventory](https://www.postgresql.org/docs/19/reference-client.html)
- [psql execution and connection options](https://www.postgresql.org/docs/19/app-psql.html)
- [Dump effects](https://www.postgresql.org/docs/19/app-pgdump.html)
- [Restore effects](https://www.postgresql.org/docs/19/app-pgrestore.html)
- [Readiness probes](https://www.postgresql.org/docs/19/app-pg-isready.html)
- [Installation metadata](https://www.postgresql.org/docs/19/app-pgconfig.html)

Generate with `node scripts/build-postgresql-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/postgresql-pack.test.mjs`.
Fixtures evaluate policy without running PostgreSQL tools or contacting a
database. Installed-tool and live database acceptance require separate scope.
