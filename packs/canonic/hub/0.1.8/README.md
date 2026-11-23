# Hub permissions 0.1.8

Reviewed against Hub 0.52.0 and the 101 MCP tools listed by
`hub mcp serve --check`. The `canonic/box` pack covers the `box` executable.

Requires Shield `>=0.20.0, <1.0.0` with `argument-paths-v1`, `field-paths-v1`
and `preconditions-v1`.

Task summaries use the inspection decision. They read committed task content
and can ask the existing local manager for live runtime state.

The workspace MCP headers helper uses the routine decision and can start the
same-user loopback passthrough. The optional `--port` must match the user's
Hub configuration and keeps the routine decision. The workspace MCP stdio
launcher uses the arbitrary-program decision because its launch data supplies
an executable.

On macOS, starting a supported local CLI agent in a managed terminal retains
the agent-start execution decision, including launches with a prompt for the
operator to enter. Reading bounded output owned by the calling MCP connection is
inspection, allowed in all profiles. The CLI attachment asks from any working
directory because it takes keyboard control, including native login and
approval prompts. The same decision covers `--resume-capture`, which makes
future output visible to the originating MCP connection after a private attachment.

Hub Proxy reads can list projects, gateway state and redacted deliveries from
`https://app.canonic.sh` through CLI or MCP. Selecting a different controller
origin or a private trust root asks in all profiles. Signing in, revoking a
login, enrolling a connector and changing hosted endpoints or public routes
also ask in all profiles. The standalone `hub-proxy-connector` development
binary follows the project's ordinary Shield policy.

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
Checked Compose stop keeps the routine stop decision. `doctor --execution`
and MCP `doctor` with `execution` also use the routine decision because the
incoming recipe supplies the executable lookup for Docker probes. Plain
`doctor` keeps its inspection decision. An explicit configuration file for
either replacement check must be inside approved read roots and outside
protected paths. For MCP, use an absolute configuration path so Shield can
verify the file selected for the workspace.
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

Workspace and configured target commands can dispatch project lifecycle hooks.
Command hooks require approval in an ignored, untracked local Hub configuration.
Hub checks current approval before resuming a saved checkout command.
Removal previews list the exact approved hook commands alongside the confirmed
inventory. The configured lifecycle commands retain their routine decisions.
Invoking the private hook worker directly asks in every profile from any cwd.
The same review applies to shells that load secrets and secret file sync,
including when `--project` selects a workspace from another directory.
Plugin inspection reports provider capabilities without reading credentials.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Inspection: status, workspaces, the task, agents, processes, operations, manager blockers, plugin bindings, logs, URLs, configuration, plugin state, documentation | Allow | Allow | Allow |
| Separately named read-only `*_preview` tools, which cannot apply or execute effects | Allow | Allow | Allow |
| Routine operations: task edits, workspaces, configured `process run`, process stop, execution-specific `doctor`, setup, plugins, manager, agent stop, MCP logins and apps | Allow | Allow | Ask |
| A replacement recipe outside approved read roots, in a protected location, or given as a relative MCP configuration path | Ask | Ask | Ask |
| Arbitrary programs and other agents: `process exec`, `shell`, retained `process shell`, `workspace create --shell`, CLI plugin workflows and launch, `agent start` and `agent message` | Allow | Ask | Ask |
| `plugin_workflow_run` and `plugin_workflow_resume` through Hub's program and argument confirmation | Allow | Allow | Ask |
| `agent attach` and `agent attach --resume-capture` | Ask | Ask | Ask |
| App creation with an explicit `--claude-bin` | Allow | Ask | Ask |
| `shell --secrets PROFILE` and `config secrets-sync TARGET FILE` | Ask | Ask | Ask |
| MCP auth setup with `--yes` and without `--dry-run` | Ask | Ask | Ask |
| Hosted proxy inspection at the default Canonic controller with default trust | Allow | Allow | Allow |
| Hosted proxy access with another controller or private trust root, login changes, connector enrollment and endpoint or route changes | Ask | Ask | Ask |
| The raw `hub -- COMMAND` shortcut and `workspace create NAME -- COMMAND` | Ask | Ask | Ask |
| Unknown MCP tools and unrecognized command lines, including `hub -w WORKSPACE -- COMMAND` | Allow | Ask | Ask |
| CLI deletion with `--confirm DIGEST`, `--discard-changes`, `--forget` or `data-reset --confirm` | Ask | Ask | Deny |
| `workspace_remove` with `discard_changes` or `forget`, through Hub's inventory confirmation | Allow | Allow | Deny |
| A named input file in version control, Shield state, credentials or agent settings, or outside the approved roots | Ask | Ask | Ask |
| A `task export --output` file outside the writable roots or in a protected location | Ask | Ask | Ask |

The workflow run and resume tools show the program and arguments and require
the user's acceptance. CLI program execution and agent prompts retain their
own Shield review. For MCP workspace disposal, Hub shows the selected resources
and binds the user's confirmation to that inventory, including discarded files
or forgotten workspace history. Keeping every resource retires the registration
without disposal. CLI confirmation digests skip Hub's interactive review.

Input files are `--goal-file`, `--description-file`, `--prompt-file` and
`task import --file`. Hub reads them into its task or a prompt; the checked
locations are `.git`, `.shield`, `.aws`, `.ssh`, `.env`, `.mcp.json`, `.codex`
and `.claude` in the project, and anything outside the approved roots.

`task export --output FILE` writes one task revision to `FILE`, and with
`--overwrite` replaces an existing file there. Inside the writable roots it is
inspection, allowed in all profiles; `FILE` outside them or in a protected
location asks in all profiles. Export without `--output`, and the MCP
`task_export` tool, return text and write no file.

### Explicit client execution and auth confirmation

Hub runs the executable supplied to `mcp app create --claude-bin` to check
its version and capabilities before the app review. The override now follows
the arbitrary-program decision. Omit it to use the installed default client
and the ordinary provisioning decision.

Hub applies `mcp auth setup --yes` without terminal confirmation, including
when `--remove` restores direct server URLs. The published 0.1.3
`auth-setup` fixture allowed that form in Loose and Recommended. All profiles
now ask before applying it. Omit `--yes` for Hub’s terminal review or use
`--dry-run` to inspect the routing changes without applying them.

These tighter decisions apply to forms still present in Hub 0.45.1. The
per-group Compose `startup_timeout_ms` setting changes how long configured
startup can wait and uses the existing `process run` decision.

Project selection, explicit configuration files, checkout paths, environment
overrides and malformed arguments keep the operation's decision; Hub validates
them. The raw `--` forms are matched by risk tokens, which Shield never lets
allow, so they ask even in Loose; `process exec` and `process shell` are the
equivalent commands with the Loose allowance. The current terminal command is
`hub shell`, with the same decisions as retained `hub process shell`.

### Credential and hook review from any directory

Pack 0.1.6 scoped its secret shell, secret sync and private hook worker rules
to approved working directories. Calls from elsewhere could reach the
unlisted Loose allowance. These operations now ask in all profiles from any
directory. Use ordinary workspace lifecycle commands for approved project
hooks. Use a plain shell for sessions that require no secret profile.

## Pagination and compatibility

`process list`, `operation list`, `manager blocker list` and
`plugin binding list` (and their MCP names `process_list`, `operation_list`,
`manager_blocker_list` and `plugin_binding_list`) inspect retained state
without starting work. They are allowed in all profiles. Saved logs accept
`tail`, and waiting `operation_show` remains inspection. A detached
`process_run` with `wait_ms` keeps the configured-target decision. Current
collections, logs and bundled documentation use opaque `cursor` and `limit`
arguments. Hub validates their types, bounds and selection.
Bundled `docs_*` tools read embedded pages rather than arbitrary host files.
Agent Kit publication through setup retains its configuration-change decision;
neither template arguments nor pagination authorize separate execution.

The retirement ledger records local-build evidence from Hub 0.39.0 and
0.52.0. Local installations do not count as published feature releases.

| Retained form | Replacement | First verified absence | Release evidence and removal |
| --- | --- | --- | --- |
| CLI `process shell` | CLI `shell` | Local Hub 0.39.0 | No qualifying published or owner-designated shipped release evidence; removal deferred |
| Documentation `offset`, `start_line`/`end_line` and CLI `--start-line` | Opaque `cursor` and `limit` | Local Hub 0.39.0 | No qualifying release evidence; removal deferred |
| Applying MCP tools with `dry_run` arguments | Separately named `*_preview` tools | Local Hub 0.39.0 | No qualifying release evidence; removal deferred |
| Disposal, retry and wait options on `workspace_remove_preview` | Review default cleanup with `workspace_remove_preview`; request a selected cleanup with `workspace_remove` for exact review and confirmation | Local Hub 0.52.0 | No qualifying release evidence; the older read-only preview remains allowed in all profiles |

Exact permissions and independent fixtures for these forms remain. Remove no
coverage until three subsequent published tool feature releases establish
eligibility and supported versions no longer need it. Current MCP tool names
and retained argument forms are checked separately; no retired MCP tool names
were identified.

## Connection

Server matching accepts exactly the stdio `hub mcp serve` launch, as `hub` on
PATH, a standard Unix install path or `~/.local/bin/hub`. Extra arguments,
wrappers and HTTP do not match. Executable identity and PATH remain host
responsibilities.

Generate with `node scripts/build-hub-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield --hub /absolute/path/to/hub scripts/hub-pack.test.mjs`.
