# Box permissions 0.1.0

Permissions for Box, which manages coding workspaces
with goals, plans, agent conversations, checkouts and recipe executions. The
pack covers the `box` CLI and Box's own MCP server (`box mcp serve`).
Requires Shield `>=0.18.0, <1.0.0`.

## Profiles

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listings, status, content and history, roadmap, agent and host catalogs, doctor, recipe checks, bounded logs, cleanup/data-reset/repair previews, `--dry-run` reviews | Allow | Allow | Allow |
| Content edits (roadmap, criteria, evidence, references, notes, blockers, handoffs), `workspace update`, `workspace create`, `workspace attach` inside the project, `init`, `run`, `stop`, gateway, preferences | Allow | Allow | Ask |
| `workspace remove` (resources kept), `recover`, confirmed `repair`, `conversation open` and `archive`, manager stop/drain | Allow | Ask | Ask |
| `exec`, `shell`, `box -- <command>`, `workspace create -- <command>` or `--shell`, `run --set-env`, `--allow-self-stop` | Ask | Ask | Deny |
| `conversation message`, `conversation open --start/--prompt` | Ask | Ask | Deny |
| `setup`, `config init/convert/sync/repair/abandon`, `mcp setup/sync`, `mcp auth setup`, `mcp tool list`, `mcp app create` | Ask | Ask | Deny |
| `workspace cleanup` without `--dry-run`, confirmed `workspace data reset`, `workspace remove` with cleanup or forget options, `recover --settle-compose-creation`, `mcp auth logout`, `mcp auth headers` | Ask | Deny | Deny |
| `watch`, `logs --follow`, `mcp serve` from a shell; an explicit `--project`; `workspace create --path` or `workspace attach` outside the project | Ask | Ask | Ask |
| Unlisted syntax and commands outside approved project folders | Ask | Ask | Deny |

`run` executes the recipe's declared services and commands, so it trusts
project code the way builds and tests do; `--set-env` overrides can change what
those commands run, so they need review. `exec` runs any command and is not
narrowed to the command it names.

Named files must stay inside the project's approved folders, away from `.git`,
`.shield`, credentials (`.env`, `.ssh`, `.aws`) and agent settings: the
`content export --output` destination, which `--overwrite` replaces, the
`content apply/import --file` source, and `--goal-file` or `--description-file`
on `workspace create`, `workspace attach`, `workspace update`, `handoff set`
and the content add, update, resolve and reopen commands. Other paths deny in
every profile.

`run` executes the recipe in a workspace's folder, so the folder a workspace
uses is checked too. `workspace create` without `--path` uses the recipe's
checkout layout and keeps its decision. A `--path` inside the project, or a
`workspace attach` directory inside it, keeps the routine decision; any other
folder asks in every profile.

## MCP tools

Bind Box's server to the pack in `.shield/config.yml`:

```yaml
mcp:
  box:
    transport: {type: defaults, pack: main/canonic/box, integration: box}
    agents: {claude: box, codex: box}
    packs: {main/canonic/box: box}
```

Each tool takes its CLI command's decision. Arguments adjust it:
`workspace_cleanup` with `dry_run: true` allows; `repair` with `dry_run: false`
asks in Recommended; `workspace_remove` with `delete_checkout` or `forget`
denies in Recommended; `conversation_open` with `start`, `run` with `set_env`,
and `stop`/`workspace_remove` with `allow_self_stop` ask.
`workspace_data_reset` deletes after Box's own confirmation, so it is
classified as the deletion. MCP rules cannot check where a path resolves, so
`workspace_create` with an explicit `path` and every `workspace_attach` ask.
Any explicit `project` argument asks. Unknown tools ask, and deny in Strict.

The binding matches a server launched as `box mcp serve` from `PATH`,
`/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin` or `~/.local/bin`, where
`make install-local` and user-scope `box mcp setup` place and register it.

## Coverage limits

- The command given to `exec`, `box -- <command>` or `workspace create --` is
  not evaluated against other packs; it always needs review. The terminal
  shortcut keeps that decision with global options too: `box --json -- status`
  runs an external `status` command. Child command names, options and `--help`
  do not inherit Box's own inspection or file permissions.
- Box's confirmation digests, revision checks and ownership rules remain
  authoritative; the pack does not inspect recipes or content edits.
- Commands are matched as `box`, `/usr/bin/box`, `/usr/local/bin/box` and
  `/opt/homebrew/bin/box`; other absolute paths, including `~/.local/bin/box`,
  ask. Run Box from `PATH` to keep the listed decisions.
