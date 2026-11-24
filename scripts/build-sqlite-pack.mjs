import {copyFile, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {engine, version, sqlitePack, sqliteInventory} from './sqlite-policy.mjs';
import {sqliteCases} from './sqlite-cases.mjs';
import {splitCaseFiles} from './fixture-files.mjs';

export const directory = new URL(`../packs/canonic/sqlite/${version}/`, import.meta.url);

export function guide() {
  return `# SQLite permissions ${version}

Requires Shield \`${engine}\`. Reviewed against the installed macOS SQLite
3.44.3 CLI and the official SQLite 3.54.0 shell and utility sources.
See the [CLI reference](https://sqlite.org/cli.html),
[SQL reference](https://sqlite.org/lang.html) and
[3.54.0 sources](https://github.com/sqlite/sqlite/tree/version-3.54.0).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact \`sqlite3 -help\`, \`--help\`, \`-version\`, \`--version\` | Allow | Allow | Allow |
| Exact \`sqldiff -help\`/\`--help\`, \`sqlite3_analyzer -version\`/\`--version\`, \`sqlite3_rsync --help\`/\`--version\` | Allow | Allow | Allow |
| Schema/table/index inspection, SELECT, PRAGMA and database analysis | Ask | Ask | Deny |
| SQL writes, schema changes, transactions, deletion and VACUUM | Ask | Ask | Deny |
| Backup, restore, dumps, recovery, imports, exports and archives | Ask | Ask | Deny |
| Startup scripts, stdin, dot-commands, extensions, file functions and shell execution | Ask | Ask | Deny |
| Database diffs, analyzer Tcl mode and local/remote synchronization | Ask | Ask | Deny |
| MCP requests | Ask | Ask | Ask |

## Database and script review

Review the full invocation, selected database, startup configuration and input
before approving it. This includes \`:memory:\`, relative and absolute paths,
URI filenames, stdin, \`-cmd\` and \`-init\`. Opening a missing filename can create
a database. The default invocation can load the user's \`.sqliterc\`. Executable
identity and the inherited environment remain host responsibilities.

SQL and dot-commands can access files and processes. \`SELECT\` can call
\`readfile()\`, \`writefile()\` or \`load_extension()\`. \`ATTACH\`, \`VACUUM INTO\`,
\`.backup\`, \`.save\`, \`.restore\`, \`.import\`, \`.read\`, \`.once\` and \`.output\`
can introduce additional paths, including pipes. \`.shell\`, \`.system\` and
the analyzer's \`--tclsh\` can execute code.

\`-readonly\` controls the primary database connection. Review its other host
effects as well. SQLite's \`-safe\` mode restricts file, extension and subprocess
features, while \`-nonce\` permits selected commands to bypass those restrictions.
Both flags keep the same pack decision. Shield currently has no SQLite SQL or
dot-command effect parser. Automatic schema/query permissions would require
that parser and checks for all resolved database, startup and output paths.

Help and version allowances match complete argument lists. Additional arguments
return the invocation to review. All other options use the database-operation
decision, including future switches. These are regular pack restrictions, so
another community pack's broad allowance cannot override them. Project custom
policy retains Shield's normal authority.

## Utilities and synchronization

\`sqldiff\` reads two databases and emits SQL, with an extension-loading option.
\`sqlite3_analyzer\` reads database contents and can run its embedded Tcl shell.
\`sqlite3_rsync\` writes a replica and can launch SSH and a remote executable.
Review both endpoints, the overwritten replica, remote paths and any explicit
\`--ssh\` or \`--exe\` command.

The inventory includes bare names, \`.exe\` names and standard Unix bin paths.
Other installation paths, interpreter wrappers and MCP servers follow other
installed policy or unknown-request fallback. Validation uses policy fixtures.
Live database operations and remote synchronization have separate acceptance scope.

Generate with \`node scripts/build-sqlite-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/sqlite-pack.test.mjs\`.
`;
}

export async function buildSqlitePack() {
  await mkdir(directory, {recursive: true});
  const pack = sqlitePack();
  for (const [file, document] of [['pack.yml', pack], ['commands.json', sqliteInventory(pack)], ...splitCaseFiles(sqliteCases())]) {
    await writeFile(new URL(file, directory), JSON.stringify(document, null, 2) + '\n');
  }
  await writeFile(new URL('README.md', directory), guide());
  await copyFile(new URL('../LICENSE', import.meta.url), new URL('LICENSE', directory));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildSqlitePack();
