# Gate permissions 0.2.7

Requires Shield `>=0.20.0, <1.0.0`.

The separately named read-only `*_preview` tools are Allow in Loose,
Recommended and Strict. They cannot apply changes or execute workflows, and
reject a caller-supplied dry-run argument. Current applying MCP tools also reject
that argument; use the preview identity for inspection. Rules for older binaries
retain their reviewed decisions. Approved-root and stdio
connection boundaries remain enforced; unknown tool names keep their fallback.

Bundled CLI `docs list|search|read` and MCP `docs_list|docs_search|docs_read`
are Allow in every profile with opaque `cursor` and `limit`. Gate validates
queries, page names and paging arguments without acquiring host-file access.
The former MCP `offset` and `start_line` forms retain their permissions and
independent fixtures. Their first verified absence is this 2026-11-15 source
checkout (0.26.1); Gate has no published feature release starting retirement.
Removal remains deferred until three subsequent published feature releases.


Reviewed 2026-11-16 against Gate 0.28.0 source and installed catalog:
42 current MCP tools, including seven separate previews, plus retained
compatibility names. The MCP `dry_run` argument on `discard`, `rename`,
`sync`, `migrate`, `branch_remove`, `session_remove` and `worktree_remove`
is first verified absent in 0.27.0 on 2026-11-15. Use each tool’s
`*_preview` identity instead. The old argument forms retain their exact
decisions, including Strict Deny for forced branch deletion, session deletion
and removal with discarded changes. Independent fixtures cover every retained
form across profiles. Gate has no published feature release starting this
window; earliest removal is deferred until three subsequent published feature
releases are verified. No safety exception is applied. Malformed preview
arguments remain Allow because Gate rejects them before dispatch; they cannot
change a preview into an applying call.


All other coverage, supported older interfaces and retirement constraints remain
as described in [0.2.6](../0.2.6/README.md). No coverage is retired.

Gate status supports `--entries-only` and MCP `entries_only: true` to return public
repository navigation entries without inspecting working changes. It remains a
read-only Allow operation in every profile; independent fixtures cover both forms.


Reviewed 2026-11-16 against Gate 0.28.0 source and installed CLI: `push --destination`
and MCP `destination_branch` select a remote branch name, with no host-path
effect. Existing prefix matching and unknown-option skipping cover both CLI
value forms without an option allowance. Ordinary CLI publication remains
Allow/Ask/Ask in Loose/Recommended/Strict; leased rewrites remain Ask/Ask/Deny.
MCP publication remains Allow in all profiles because Gate confirms it;
leased MCP rewrites remain Allow/Allow/Deny. Independent fixtures cover both
interfaces, exact lease forms, malformed selection and outside-project guards.
No policy decision or historical source changes for destination selection.


Regenerate with `node scripts/build-current-tool-packs.mjs gate` and validate
with `npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
