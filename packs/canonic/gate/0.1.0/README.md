# Gate permissions 0.1.0

Permissions for Gate, which manages independent Git
repositories that share one working folder. The pack covers the `gate` CLI and
Gate's own MCP server (`gate mcp serve`). Requires Shield `>=0.18.0, <1.0.0`.

## Profiles

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Status, diffs, checks, ownership, doctor, branch/worktree/session listings, plans before `--confirm`, `sync --dry-run`, `migrate` plans | Allow | Allow | Allow |
| Staging (`add`, `apply --cached`), commits, `worktree add` inside the project, session start/stop/resume | Allow | Allow | Ask |
| `switch`, `add --force`, `attach`, `branch remove`, `session promote`, confirmed worktree removal/repair and relocation, `recover`, `init` | Allow | Ask | Ask |
| `commit --amend` | Ask | Ask | Ask |
| `fetch`, `push`, `remote add` | Ask | Ask | Deny |
| Accepting `gate.yml` (`sync`), `migrate --apply/--recover`, `mcp setup` | Ask | Ask | Deny |
| `push --force-with-lease`, `branch remove --force`, confirmed `session remove` | Ask | Deny | Deny |
| `mcp serve` from a shell; an explicit `--project`; `worktree add` outside the project | Ask | Ask | Ask |
| Unlisted syntax and commands outside approved project folders | Ask | Ask | Deny |

`--version`, `--help`, `help`, `<command> --help` and `mcp serve --check`
(with or without `--json`) allow from any folder.
Gate's global options (`--json`, `--project`) are recognized before the command
and between its words, so `gate branch --json remove` is decided as
`branch remove`.
A stricter decision always wins: `--project` with a forced push still denies in
Recommended. Commits and amendments take the same decisions as the
`canonic/git` pack's commits and amendments.

`worktree add` creates its folder wherever the path points and fills it with
repository files. A path inside the project, such as `.gate/tasks/<name>`,
keeps the routine decision. Any other folder, a protected folder such as
`.git`, or an option the pack does not list asks in every profile.

## MCP tools

Bind Gate's server to the pack in `.shield/config.yml`:

```yaml
mcp:
  gate:
    transport: {type: defaults, pack: main/canonic/gate, integration: gate}
    agents: {claude: gate, codex: gate}
    packs: {main/canonic/gate: gate}
```

Each tool takes its CLI command's decision. Arguments adjust it: `amend`,
`force`, `force_create` and `force_with_lease` match their CLI options;
`sync` with `dry_run: true` allows; `migrate` with `apply` or `recover` asks.
`session_remove` deletes after Gate's own confirmation, so it is classified as
the deletion. `worktree_add` keeps the routine decision only for a `path` of the
form `.gate/tasks/<name>`, because MCP rules cannot check where another path
resolves; any other path asks. Any explicit `project` argument asks. Unknown
tools ask, and deny in Strict.

The binding matches a server launched as `gate mcp serve` from `PATH`,
`/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin` or `~/.local/bin`, where
`make install-local` and user-scope `gate mcp setup` place and register it.

## Coverage limits

- Gate's own validation, hooks and confirmation prompts remain authoritative;
  the pack does not inspect `gate.yml`, patches or commit contents.
- Commands are matched as `gate`, `/usr/bin/gate`, `/usr/local/bin/gate` and
  `/opt/homebrew/bin/gate`; other absolute paths, including `~/.local/bin/gate`,
  ask. Run Gate from `PATH` to keep the listed decisions.
