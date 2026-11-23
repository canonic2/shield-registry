# Gate permissions 0.2.9

Requires Shield `>=0.20.0, <1.0.0`.

The separately named `*_preview` tools are Allow in Loose, Recommended and
Strict within their approved roots, subject to the worktree branch-cleanup
compatibility rule below. Current previews and applying tools reject a
caller-supplied dry-run argument; use the preview identity for inspection.
Approved-root and stdio connection boundaries still apply. Unknown tool names
keep their fallback.

Bundled CLI `docs list|search|read` and MCP `docs_list|docs_search|docs_read`
are Allow in every profile with opaque `cursor` and `limit`. Gate validates
queries, page names and paging arguments without acquiring host-file access.
The former MCP `offset` and `start_line` forms retain their permissions and
independent fixtures. Their first verified absence is this 2026-11-15 source
checkout (0.26.1); Gate has no published feature release starting retirement.
Removal remains deferred until three subsequent published feature releases.


Reviewed against Gate 0.33.0 source and its installed catalog:
48 current MCP tools, including ten separate previews, plus retained
compatibility names. The MCP `dry_run` argument on `discard`, `rename`,
`sync`, `migrate`, `branch_remove`, `session_remove` and `worktree_remove`
is first verified absent in 0.27.0 on 2026-11-15. Use each tool’s
`*_preview` identity instead. The retained argument forms keep their decisions
except where the worktree branch-cleanup rule requires approval. Strict still
denies the retained forms for forced branch deletion, session deletion and
removal with discarded changes. Independent fixtures cover every retained form
across profiles. Gate has no published feature release starting this window.
Retirement requires three subsequent published feature releases.

The CLI `worktree status --runtime` reports readiness and repository entry
bindings. It keeps the same read-only decisions and project boundary as
`worktree status`.


All other coverage, supported older interfaces and retirement constraints remain
as described in [0.2.7](../0.2.7/README.md). No coverage is retired.

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


Gate 0.33.0 exposes `remote set-url`, `remote rename`, and
`remote remove` (alias `rm`). CLI reviews and the three dedicated MCP
preview tools are Allow in all profiles inside approved project roots.
The applying MCP tools are Allow in Loose and Recommended within approved
writable roots, with Gate confirming the exact change. CLI `--confirm` keeps
Ask in those profiles. Strict denies applying through either interface.
These commands only edit local repository metadata.
`remote set-url` records the destination for subsequent Git transport.
Reviewing or applying the URL change leaves the destination untouched.


The applying MCP tool `discard` is Allow in Loose and Recommended inside
the approved project. Gate obtains the user's confirmation of the exact plan
before it restores files or deletes opted-in untracked files. This lets a
Shield-managed host resolve the generic tool approval without a second prompt.
Strict denies applying discard. An explicit project outside approved writable
roots still requires review in Loose and Recommended and is denied in Strict.
CLI discard remains Ask/Ask/Deny. `discard_preview` and the retained legacy
`dry_run: true` form keep their existing decisions.

Repository `rename` uses Gate's confirmation in Loose and Recommended,
including with an explicit approved project. Strict keeps the additional host
review for this cross-worktree operation.

Dirty `worktree_remove` without branch cleanup uses Gate's confirmation in
Loose and Recommended when the destination is within approved writable roots.
Strict denies dirty removal. The preview checks approved read roots.
MCP removal or preview with `remove_branch: true` still needs host approval
or is denied under the profile. The pack matches older Gate binaries whose
completed-removal review could attempt branch cleanup. Gate releases with the
fix require confirmation for branch cleanup even after removal completes.

Regenerate with `node scripts/build-current-tool-packs.mjs gate` and validate
with `npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
