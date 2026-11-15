# Gate permissions 0.2.6

Reviewed against the Gate 0.26.1 source checkout and installed build. Gate has
no published releases yet. Requires Shield `>=0.20.0, <1.0.0` and the
capabilities declared in `pack.yml`. Extends [0.2.5](../0.2.5/README.md). This
release allows everyday Gate use inside the approved project by default and
reviews the forms that can cause harm.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Repository inspection, ordinary staging and commits | Allow | Allow | Allow |
| Gate commands, options and MCP tools the pack does not list, inside the project | Allow | Allow | Ask |
| Creating a worktree under `.gate/worktrees` or another approved folder | Allow | Allow | Allow |
| Bundled `docs_list`, `docs_search`, `docs_read` | Allow | Allow | Allow |
| Retained `gate_docs_list`, `gate_docs_search`, `gate_docs_read` | Allow | Allow | Allow |
| Any operation with a policy file (`--config`, MCP `config`) | Operation's decision | Operation's decision | Operation's decision |
| Amending the last commit | Allow | Ask | Ask |
| Removing a clean worktree with `--confirm` | Allow | Allow | Ask |
| CLI staging of ignored files (`add --force`), remote binding, push and `gate.yml` acceptance | Allow | Ask | Ask |
| Applying a repository rename | Allow | Ask | Ask |
| Explicit discard dry-run in the approved project | Allow | Allow | Allow |
| Running Gate outside the approved folders, or selecting a project outside them or in a protected folder | Ask | Ask | Ask |
| Discarding changes, forced branch deletion or force-push | Ask | Ask | Deny |

## Everyday use

Inside the approved project, a command, option or MCP tool the pack does not
list is allowed in Loose and Recommended, so a new Gate option or tool works
without approval; Strict asks. Path checks skip options they do not declare,
and the value of a skipped option is still checked as a path operand. `--force`
is declared as a flag, so `gate add --force` takes the decision for staging
ignored files, as `-f` does.

## Project boundary

One check runs before the ordinary rules for every Gate request, listed or not.
Gate must run inside the approved read roots, and commands that change files
inside the approved write roots. An explicit `--project` or MCP `project` must
resolve inside the approved roots and outside protected folders (`.git`,
`.shield`, `.aws`, `.ssh`, `.codex`, `.claude`), and MCP `project` must be
absolute. Anything else asks. Each Strict Deny keeps its Deny across the
boundary: CLI and MCP discard, forced branch deletion, force-push, session
removal and worktree removal that discards changes. Documentation tools take no
project and keep their decisions.

## Policy files

`--config PATH` and MCP `config` make Gate read that exact file instead of
`gate.yml` or `.config/gate.yml`. Gate refuses a file other than the accepted
one until `gate sync` accepts it, and accepting it keeps sync's decision. The
pack declares `--config` wherever it declares `--project`, so
`gate --config acme.yml status` and `gate status --config=acme.yml` keep the
command's own decision wherever the file is.

## Behavior

Gate stores only relative links, so a main worktree moved, renamed or copied
with its worktrees needs no follow-up command. The current source reads only
state with worktree names. A folder whose state an older Gate wrote under
workspace names refuses every command and names `.gate/state/workspace.json`;
the user removes its combined worktrees with the older installed Gate, whose
commands keep their decisions below, and then moves the state by hand as Gate's
getting started guide describes. On worktree-named state, the first ordinary
command converts older portability storage once: owned markers, bindings,
receipts, Git worktree links and configuration, hooks, session and removal
records, and exactly owned agent registration paths. The conversion is journaled
and preserves working files, staging and history. Doctor reports unconverted
storage without changing it. These metadata effects keep the ordinary
operation's profile decision.

Worktree destinations, including `.gate/worktrees/<name>`, must resolve inside
the approved write roots and outside protected directories; destinations that
escape the project through `..`, absolute paths elsewhere and protected folders
need review. Gate itself refuses parent traversal and other nesting inside the
source workspace.

Branch removal across every repository (`--all-repos`, MCP `all_repos`), branch
removal previews and worktree removal with `--remove-branch` keep the decisions
of ordinary branch and worktree removal. Branch removal with `--force` keeps its
destructive decision, including in a preview.

`gate apply` and MCP `apply` read the named patch file only as a patch to stage
for owned paths, and Gate's workflow saves patches to temporary folders. The
patch path keeps the ordinary staging decision and is not path-checked.

Documentation tools read only the bundled guides and do not open caller-selected
host files. Gate validates their required fields, pagination and bundle paths.
The pack does not substitute for Gate's argument validation or user confirmation.

## Retained compatibility

Gate has no published release, so no retirement window has started: every
retained form below keeps its exact reviewed permissions, path checks and
independent fixtures, and its first verified absent release is not established.
Removal is deferred until that release is verified, three subsequent published
feature releases follow, and no supported version needs the form.

- The `.gate/tasks/<name>` worktree rule. Older installed versions used it;
  `.gate/worktrees/<name>` replaces it. `.gate/workspaces/<name>` never had a
  dedicated rule: the general approved-folder rule gives it the same decision,
  and fixtures cover it.
- The `gate_docs_list`, `gate_docs_search` and `gate_docs_read` MCP aliases, with
  their explicit-project checks. They were first observed absent in installed
  Gate 0.23.0, which was not a published release. Use `docs_list`, `docs_search`
  and `docs_read`.
- The CLI commands `relocate` and `worktree repair` and the MCP tool
  `worktree_repair`. Gate has no replacement: moved and copied worktrees need
  none, and storage from older versions converts on first use.

No safety exception has been established.

Explicit project and worktree paths keep approved-root and protected-directory
checks. Server matching requires a recognized Gate executable, stdio transport
and exactly `mcp serve`; extra launch arguments cannot gain these permissions.
Project setup inherits the agent host's project directory. Gate-owned Git hooks
resolve `gate` through PATH, including in a Git GUI's environment.

Regenerate only this candidate with
`node scripts/build-current-tool-packs.mjs gate`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
