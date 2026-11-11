# Gate permissions 0.2.4

Reviewed against Gate 0.23.0 and the Gate 0.23.1 source checkout. Requires Shield `>=0.20.0, <1.0.0` and
the capabilities declared in `pack.yml`. Extends [0.2.3](../0.2.3/README.md) with the
same rules and profile decisions, and describes Gate's automatic storage conversion.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Repository inspection, ordinary staging and commits | Allow | Allow | Allow |
| Bundled `docs_list`, `docs_search`, `docs_read` | Allow | Allow | Allow |
| Retained `gate_docs_list`, `gate_docs_search`, `gate_docs_read` | Allow | Allow | Allow |
| Unknown MCP tool names | Ask | Ask | Ask |
| Applying a repository rename | Allow | Ask | Ask |
| Explicit discard dry-run in the approved project | Allow | Allow | Allow |
| Discarding changes, forced branch deletion or force-push | Ask | Ask | Deny |

Gate stores only relative links, so a workspace moved, renamed or copied with
its worktrees needs no follow-up command. The first ordinary command in a
workspace written by an older Gate converts its storage once: owned markers,
bindings, receipts, Git worktree links and configuration, hooks, session and
removal records, and exactly owned agent registration paths. The conversion is
journaled and preserves working files, staging and history. Doctor reports
unconverted storage without changing it. These metadata effects keep the
ordinary operation's profile decision.

Documentation tools read only the bundled guides and do not open caller-selected
host files. Gate validates their required fields, pagination and bundle paths.
The pack does not substitute for Gate's argument validation or user confirmation.

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
installed versions. They are absent from the Gate 0.23.1 source checkout, which
is not a published release, so their first verified absent release is not yet
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
