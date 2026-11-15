# Hub permissions 0.1.0

Reviewed against Hub 0.36.0: its CLI definitions and the 66 tools that
`hub mcp serve --check` lists. Hub succeeds Box; `canonic/box` keeps covering
the `box` executable, and this pack grants nothing to it.

Requires Shield `>=0.20.0, <1.0.0`, including `argument-paths-v1`.

Ordinary Hub use is allowed. Hub validates its own arguments, selection and
configuration, and asks its user before the effects it confirms, so the pack
does not match every option. It reviews only the forms an agent could use to
escape other command policy or cause loss that cannot be undone.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Inspection: status, workspaces, the task, agents, logs, URLs, configuration, plugin state, documentation | Allow | Allow | Allow |
| Everything else Hub covers: task edits, workspaces, configured `process run`, process stop, setup, plugins, manager, agent stop, MCP logins and apps | Allow | Allow | Ask |
| Arbitrary programs and other agents: `process exec`, `process shell`, `workspace create --shell`, plugin workflows and launch, `agent start` and `agent message` | Allow | Ask | Ask |
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
equivalent commands with the Loose allowance.

## Connection

Server matching accepts exactly the stdio `hub mcp serve` launch, as `hub` on
PATH, a standard Unix install path or `~/.local/bin/hub`. Extra arguments,
wrappers and HTTP do not match. Executable identity and PATH remain host
responsibilities.

Generate with `node scripts/build-hub-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/hub-pack.test.mjs`.
