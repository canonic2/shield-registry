import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {destinationOf, writePack} from './tool-pack.mjs';
import {engine, supabasePack, version} from './supabase-policy.mjs';
import {supabaseCases} from './supabase-cases.mjs';

export const directory = destinationOf(supabasePack());

export function guide() {
  return `# Supabase permissions ${version}

Reviewed against [Supabase CLI v3.3.0](https://github.com/supabase/cli/tree/v3.3.0/apps/cli/src)
and the [hosted MCP tool catalog](https://supabase.com/docs/guides/ai-tools/mcp#available-tools)
in November 2026. The [MCP tool definitions](https://github.com/supabase/mcp/tree/03afe8e7a021b13d1611c8b7dc77e1144fa044da/packages/mcp-server-supabase/src/tools)
also cover the legacy \`get_logs\` operation. Requires Shield \`${engine}\`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| CLI version and top-level help, MCP documentation search and project API URL | Allow | Allow | Allow |
| CLI \`projects list\` and \`orgs list\` from approved readable roots with ordinary display options | Allow | Allow | Ask |
| MCP table, extension, migration, advisor, branch, function, storage and notebook metadata, type generation and publishable keys | Allow | Allow | Ask |
| CLI credential commands, project and function deletion, branch deletion, disabling or pausing branches | Ask | Deny | Deny |
| Explicit hosted database reset/push and migration rollback/history changes, security administration, backups, stack destroy/prune | Ask | Deny | Deny |
| Recognized CLI database queries, resets, pushes, dumps, migration changes, function serving and deployments, and other reviewed write operations | Ask | Ask | Deny |
| Local stack lifecycle, status, migration/function/test creation, type generation and project inspection | Ask | Ask | Ask |
| Project linking/pulling, config conversion/pull, test execution, generated keys/JWTs, reports, snippets and experimental compute | Ask | Ask | Deny |
| Unlisted CLI forms and explicit workdirs on account listings | Ask | Ask | Ask |
| MCP SQL execution, migration application, function deployment, notebook execution, billing confirmations and remote changes | Ask | Ask | Deny |
| MCP secret collection, branch deletion or reset, project pausing and notebook deletion | Ask | Deny | Deny |
| MCP logs, stored function or notebook contents, account requests and unknown tools | Ask | Ask | Ask |

## Connect MCP

Use Supabase's [connection setup](https://supabase.com/docs/guides/ai-tools/mcp)
to configure a hosted server and complete OAuth. For example:

\`https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst&read_only=true\`

Use your project's 20-letter ref for project scoping. Shield matches the official
HTTPS endpoint with an optional \`project_ref\`, \`read_only\` and \`features\`
parameter, each appearing at most once,
in any order. When using features, provide a comma-separated list of group
names. Adding the pack enables policy for matching connections regardless of
their alias. The account-wide endpoint uses the same tool decisions, including
review for account tools and arbitrary SQL. Local connections match
\`http://localhost:54321/mcp\` or \`http://127.0.0.1:54321/mcp\` and use the
same decisions. The local service and port ownership are trusted host inputs.
Custom local ports, self-hosted servers, stdio wrappers and URLs with
\`skip_elicitations\` fall back to the host's permissions.
Supabase's server controls the exposed tools and inserts the configured project
ref into scoped metadata calls. Use \`read_only=true\` to enable Supabase's own
read-only mode. Shield applies the same profile decisions to arbitrary SQL in
either mode.

## CLI effect coverage

The policy inventories local stack start/stop/status and experimental stack
operations, initialization, migration creation and history, type generation,
database inspection and queries, schema changes, hosted projects and branches,
functions, storage, configuration, tests, account operations, credentials and
security administration. Fixtures cover both current \`--remote\` selection
and retained \`--linked\`, \`--db-url\` and \`--project-ref\` spellings.

Local lifecycle and file-generation commands ask because their configuration
can select implicit files, containers and ports. An explicitly local reset or
push retains Ask in Loose and Recommended and Deny in Strict. An explicit
hosted target on reset/push or rollback/history-changing migration commands
uses Ask in Loose and Deny in Recommended and Strict. A linked project can
contain production data, and local data also requires review before deletion.
Commands whose targets come from configuration retain review. The pack does
not infer disposability from the word local.

The retained compatibility forms have no removal date. Their absence and three
subsequent published feature releases must be established before retirement.
New operations receive fallback review until their effects are inventoried.

CLI review covers commands that select a project or database through local
configuration, write implicit paths, export data, or expose credentials.
The CLI's selected account and API origin also depend on trusted installation
and configuration. The rules cover direct invocations of \`supabase\` and its
standard Unix install paths. Package runners and shell redirects use their own
policies.

Generate the artifacts with \`node scripts/build-supabase-pack.mjs\` and run
\`npm test -- --shield /absolute/path/to/shield scripts/supabase-pack.test.mjs\`.
`;
}

export async function buildSupabasePack() {
  await writePack(supabasePack());
  await writeFile(new URL('cases.json', directory), JSON.stringify(supabaseCases(), null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildSupabasePack();
