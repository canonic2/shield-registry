# Supabase permissions 0.1.1

Reviewed against [Supabase CLI v3.3.0](https://github.com/supabase/cli/tree/v3.3.0/apps/cli/src)
and the [hosted MCP tool catalog](https://supabase.com/docs/guides/ai-tools/mcp#available-tools)
in November 2026. The [MCP tool definitions](https://github.com/supabase/mcp/tree/03afe8e7a021b13d1611c8b7dc77e1144fa044da/packages/mcp-server-supabase/src/tools)
also cover the legacy `get_logs` operation. Requires Shield `>=0.54.0, <1.0.0`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| CLI version and standalone help for any command, MCP documentation search and project API URL | Allow | Allow | Allow |
| CLI `projects list` and `orgs list` from approved readable roots with ordinary display options | Allow | Allow | Ask |
| MCP table, extension, migration, advisor, branch, function, storage and notebook metadata, type generation and publishable keys | Allow | Allow | Ask |
| CLI credential commands, project and function deletion, branch deletion, disabling or pausing branches | Ask | Deny | Deny |
| Explicit hosted database reset/push and migration rollback/history changes, security administration, backups, stack destroy/prune | Ask | Deny | Deny |
| Recognized CLI database queries, resets, pushes, dumps, migration changes, function serving and deployments, and other reviewed write operations | Ask | Ask | Deny |
| Local stack lifecycle, status, migration/function/test creation, type generation and project inspection | Ask | Ask | Ask |
| Project linking/pulling, config conversion/pull, test execution, generated keys/JWTs, reports, snippets and experimental compute | Ask | Ask | Deny |
| Unlisted CLI forms and explicit workdirs on account listings | Ask | Ask | Ask |
| MCP SQL execution on an opted-in, project-scoped read-only connection | Allow | Allow | Allow |
| Other MCP SQL execution, migration application, function deployment, notebook execution, billing confirmations and remote changes | Ask | Ask | Deny |
| MCP secret collection, branch deletion or reset, project pausing and notebook deletion | Ask | Deny | Deny |
| MCP logs, stored function or notebook contents, account requests and unknown tools | Ask | Ask | Ask |

## Connect MCP

Use Supabase's [connection setup](https://supabase.com/docs/guides/ai-tools/mcp)
to configure a hosted server and complete OAuth. For example:

`https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst&read_only=true`

Use your project's 20-letter ref for project scoping. Shield matches the official
HTTPS endpoint with an optional `project_ref`, `read_only` and `features`
parameter, each appearing at most once,
in any order. When using features, provide a comma-separated list of group
names. Adding the pack enables policy for matching connections regardless of
their alias. The account-wide endpoint uses the same tool decisions, including
review for account tools and arbitrary SQL. Local connections match
`http://localhost:54321/mcp` or `http://127.0.0.1:54321/mcp` and use the
same decisions. The local service and port ownership are trusted host inputs.
Custom local ports, self-hosted servers, stdio wrappers and URLs with
`skip_elicitations` fall back to the host's permissions.
Supabase's server controls the exposed tools and inserts the configured project
ref into scoped metadata calls. Use `read_only=true` to run queries with
Supabase's read-only Postgres user.

### Allow SQL on a reviewed connection

Configure a managed Shield MCP connection with the official hosted URL, a
project ref and `read_only=true`. In the pack's `read_only_sql` setting, add
one entry per connection. Separate the Shield connection ID from its exact
configured URL with one space.

`project-data https://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst&read_only=true&features=database`

The setting is off by default. Shield matches the connection ID and URL
together. The URL can omit `features` or set it to `database`. A changed URL
requires a new matching entry. Host aliases discovered outside a managed
connection and local MCP endpoints use the ordinary SQL decisions. This setting
allows `execute_sql` requests to reach the selected server. Supabase and
Postgres enforce database permissions for the submitted SQL.

## CLI effect coverage

The help rule accepts `--help` or `-h` with any command path, including
commands absent from the policy inventory. For example, run
`supabase db push --help`. Other options and arguments such as URLs or file
paths use the command's ordinary policy.

The policy inventories local stack start/stop/status and experimental stack
operations, initialization, migration creation and history, type generation,
database inspection and queries, schema changes, hosted projects and branches,
functions, storage, configuration, tests, account operations, credentials and
security administration. Fixtures cover both current `--remote` selection
and retained `--linked`, `--db-url` and `--project-ref` spellings.

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
and configuration. The rules cover direct invocations of `supabase` and its
standard Unix install paths. Package runners and shell redirects use their own
policies.

Generate the artifacts with `node scripts/build-supabase-pack.mjs` and run
`npm test -- --shield /absolute/path/to/shield scripts/supabase-pack.test.mjs`.
