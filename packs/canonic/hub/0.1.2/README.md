# Hub permissions 0.1.2

Reviewed against Hub 0.41.0 with the Compose follow-up: its CLI definitions and the 95 tools that
`hub mcp serve --check` lists. Hub succeeds Box; `canonic/box` keeps covering
the `box` executable, and this pack grants nothing to it.

Requires Shield `>=0.20.0, <1.0.0`, including `argument-paths-v1`.

Ordinary Hub use is allowed. Hub validates its own arguments, selection and
configuration, and asks its user before the effects it confirms, so the pack
does not match every option. It reviews only the forms an agent could use to
escape other command policy or cause loss that cannot be undone.

Compose member restart (CLI `process restart`, MCP `process_restart`) has
the routine process-change decision. Hub verifies execution, target, service,
engine and exact container ownership; restart accepts no arbitrary command.
Compose pause/resume have the same routine decision and can affect a shared
generation's other owners. Live member logs and bounded container stats are
inspection, allowed in all profiles; selectors cannot select arbitrary containers.
Container `process exec` uses `execution`, `target` and `service`, with
literal inner argv visible in the request. It retains arbitrary execution's
Allow/Ask/Ask decisions; this pack does not evaluate that inner program through
other packs. Declarative Compose build/restart sequences invoked by configured
`process run` retain the configured-target decision. Missing/malformed selectors
are Hub's validation responsibility and keep the operation's decision.

Workspace creation can query and fetch the configured integration branch or
remote default, using the user's Git transport credentials, URL rewrites and
proxy configuration. This retains the ordinary workspace decision in all
profiles. Explicit local revisions avoid fetching; `--no-fetch` requests cached
refs. `--source` and `--copy-source` select registered workspaces. MCP has
matching `source`, `copy_source` and `no_fetch` fields. Transport identity and
credential-helper execution remain host responsibilities. Gate's added status
navigation field is read-only and does not change its pack decisions.

Current applying and preview MCP tools reject dry-run arguments. Use the
separately named preview identity for inspection. Legacy argument rules retain
their reviewed decisions for older installed binaries.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Inspection: status, workspaces, the task, agents, processes, operations, manager blockers, plugin bindings, logs, URLs, configuration, plugin state, documentation | Allow | Allow | Allow |
| Separately named read-only `*_preview` tools, which cannot apply or execute effects | Allow | Allow | Allow |
| Everything else Hub covers: task edits, workspaces, configured `process run`, process stop, setup, plugins, manager, agent stop, MCP logins and apps | Allow | Allow | Ask |
| Arbitrary programs and other agents: `process exec`, `shell`, retained `process shell`, `workspace create --shell`, plugin workflows and launch, `agent start` and `agent message` | Allow | Ask | Ask |
| The raw `hub -- COMMAND` shortcut and `workspace create NAME -- COMMAND` | Ask | Ask | Ask |
| Unknown MCP tools and unrecognized command lines, including `hub -w WORKSPACE -- COMMAND` | Allow | Ask | Ask |
| Self-confirmed or irreversible deletion: `--confirm DIGEST`, `--discard-changes`, `--forget`, `data-reset --confirm`, and `discard_changes` or `forget` in `workspace_remove` | Ask | Ask | Deny |
| A named input file in version control, Shield state, credentials or agent settings, or outside the approved roots | Ask | Ask | Ask |

Arbitrary programs, workflows and agent prompts run outside the rules other
packs apply to commands, so they are reviewed rather than trusted. Removing a
workspace through MCP or an interactive terminal is confirmed by Hub's user;
supplying the confirmation digest skips that, and discarding uncommitted files
or the workspace record cannot be undone.

Input files are `--goal-file`, `--description-file`, `--prompt-file` and
`task import --file`. Hub reads them into its task or a prompt; the checked
locations are `.git`, `.shield`, `.aws`, `.ssh`, `.env`, `.mcp.json`, `.codex`
and `.claude` in the project, and anything outside the approved roots.

Project selection, explicit configuration files, checkout paths, environment
overrides and malformed arguments keep the operation's decision; Hub validates
them. The raw `--` forms are matched by risk tokens, which Shield never lets
allow, so they ask even in Loose; `process exec` and `process shell` are the
equivalent commands with the Loose allowance. The current terminal command is
`hub shell`, with the same decisions as retained `hub process shell`.

## Pagination and compatibility

`process list`, `operation list`, `manager blocker list` and
`plugin binding list` (and their MCP names `process_list`, `operation_list`,
`manager_blocker_list` and `plugin_binding_list`) inspect retained state
without starting work. They are allowed in all profiles. Current collections,
logs and bundled documentation use opaque `cursor` and `limit` arguments;
Hub validates their types, bounds and selection. Missing required fields and
malformed requests retain the operation's decision and are refused by Hub.
Bundled `docs_*` tools read embedded pages rather than arbitrary host files.
Agent Kit publication through setup retains its configuration-change decision;
neither template arguments nor pagination authorize separate execution.

Retirement ledger, verified 2026-11-15 against checked-out and installed Hub
0.39.0. This is local-build evidence, not a published feature-release count.

| Retained form | Replacement | First verified absence | Release evidence and removal |
| --- | --- | --- | --- |
| CLI `process shell` | CLI `shell` | Local Hub 0.39.0 | No qualifying published or owner-designated shipped release evidence; removal deferred |
| Documentation `offset`, `start_line`/`end_line` and CLI `--start-line` | Opaque `cursor` and `limit` | Local Hub 0.39.0 | No qualifying release evidence; removal deferred |
| Applying MCP tools with `dry_run` arguments | Separately named `*_preview` tools | Local Hub 0.39.0 | No qualifying release evidence; removal deferred |

Exact permissions and independent fixtures for these forms remain. Remove no
coverage until three subsequent published tool feature releases establish
eligibility and supported versions no longer need it. Current MCP tool names
and retained argument forms are checked separately; no retired MCP tool names
were identified. Published packs 0.1.0 and 0.1.1 and their companion assets remain immutable.

## Connection

Server matching accepts exactly the stdio `hub mcp serve` launch, as `hub` on
PATH, a standard Unix install path or `~/.local/bin/hub`. Extra arguments,
wrappers and HTTP do not match. Executable identity and PATH remain host
responsibilities.

Generate with `node scripts/build-hub-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield --hub /absolute/path/to/hub scripts/hub-pack.test.mjs`.
