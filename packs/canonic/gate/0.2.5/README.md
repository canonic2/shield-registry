# Gate permissions 0.2.5

Reviewed against Gate 0.23.1 and the current Gate source checkout, which names
`.gate/worktrees/<name>` as the in-project location for combined worktrees.
Requires Shield `>=0.20.0, <1.0.0` and the capabilities declared in `pack.yml`.
Extends [0.2.4](../0.2.4/README.md) with the same profile decisions and an
explicit `.gate/worktrees/<name>` rule for `worktree_add`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Repository inspection, ordinary staging and commits | Allow | Allow | Allow |
| Creating a worktree under `.gate/worktrees` or another approved folder | Allow | Allow | Allow |
| Bundled `docs_list`, `docs_search`, `docs_read` | Allow | Allow | Allow |
| Retained `gate_docs_list`, `gate_docs_search`, `gate_docs_read` | Allow | Allow | Allow |
| Unknown MCP tool names | Ask | Ask | Ask |
| Applying a repository rename | Allow | Ask | Ask |
| Explicit discard dry-run in the approved project | Allow | Allow | Allow |
| Discarding changes, forced branch deletion or force-push | Ask | Ask | Deny |

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

Documentation tools read only the bundled guides and do not open caller-selected
host files. Gate validates their required fields, pagination and bundle paths.
The pack does not substitute for Gate's argument validation or user confirmation.

## Retained compatibility

The `.gate/tasks/<name>` worktree rule keeps its exact reviewed decision and
path checks, with independent fixtures, for older installed versions. Gate
0.23.1 documents `.gate/workspaces/<name>` instead, and the current source
checkout `.gate/worktrees/<name>`. The first published release without
`.gate/tasks` is not established, so removal is deferred until that release is
verified and three subsequent published feature releases follow, and no
supported version needs it. `.gate/workspaces/<name>`, the location of the
latest published Gate, never had a dedicated rule: the general approved-folder
rule gives it the same decision, and fixtures cover it.

The current interface exposes the three `docs_*` names. The three `gate_docs_*`
aliases retain their exact reviewed permissions and explicit-project checks for
older installed versions. They were first verified absent in installed Gate
0.23.0; the original retirement release and publication evidence are unverified.
Use `docs_list`, `docs_search` and `docs_read` as their replacements. Removal is
deferred until three subsequent published feature releases have been verified
and no supported version needs the aliases. If 0.23.0 is established as the
baseline, the earliest eligible version is 0.26.0, assuming 0.24.0, 0.25.0 and
0.26.0 are each published. Patches and pack releases do not count. No elapsed
window or safety exception has been established.

The CLI commands `relocate` and `worktree repair` and the MCP tool
`worktree_repair` keep their exact reviewed permissions and fixtures for older
installed versions. They are absent from the Gate source checkout, which is not
a published release, so their first verified absent release is not yet
established. Gate has no replacement command: moved and copied workspaces need
none, and storage from older releases converts on first use. Removal is deferred
until the first published release without them is verified and three subsequent
published feature releases follow, and no supported version needs them.

Explicit project and worktree paths keep approved-root and protected-directory
checks. Server matching requires a recognized Gate executable, stdio transport
and exactly `mcp serve`; extra launch arguments cannot gain these permissions.
Project setup inherits the agent host's project directory. Gate-owned Git hooks
resolve `gate` through PATH, including in a Git GUI's environment.

Regenerate only this candidate with
`node scripts/build-current-tool-packs.mjs gate`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
