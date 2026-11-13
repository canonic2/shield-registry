# Box permissions 0.2.6

Reviewed against Box 0.29.0 and the current Box source checkout (0.33.0), whose
`workspace remove` deletes a workspace's resources by default.

Requires Shield `>=0.20.0, <1.0.0`, including `field-paths-v1`,
`field-negation-v1` and `preconditions-v1`. Extends [0.2.5](../0.2.5/README.md)
with deletion decisions for workspace removal.

Explicit MCP `project` paths that resolve to the exact enrolled checkout use
the ordinary tool decision. Filesystem resolution accepts symlink aliases and
equivalent absolute paths. A descendant, parent or sibling checkout is a different
selection, including another checkout beneath `.gate/worktrees`.

| Operation in the enrolled checkout | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Redacted configuration inspection (`config_show`) | Allow | Allow | Allow |
| Configuration preview (`config_sync`, `dry_run: true`) | Allow | Allow | Allow |
| Configuration publication (`config_sync`) | Allow | Ask | Ask |
| Agent registration and inherited hook repair (`setup`, `repair_hooks`) | Allow | Ask | Ask |
| Workspace content edits | Allow | Allow | Ask |
| Arbitrary execution (`exec`) | Ask | Ask | Ask |
| Workspace removal assessment (`workspace_remove`, `dry_run: true`) | Allow | Allow | Allow |
| Workspace removal keeping every resource (`keep: [checkout, branches, data]`) | Allow | Ask | Ask |
| Workspace removal, and any other resource deletion | Ask | Ask | Deny |
| Unknown tools | Ask | Ask | Ask |

## Workspace removal

`workspace_remove` and `box workspace remove` delete the workspace's checkout,
the merged branches it created, its data and volumes, and its finished command
history, unless the request keeps them. Every removal that deletes something
takes the deletion decision, including a removal that ends this session with
`allow_self_stop`. Discarding uncommitted files (`discard_changes`) and forgetting
the task record (`forget`) keep their own deletion rules. Box still asks for
its own confirmation of the reviewed inventory before deleting anything.

Only two MCP forms delete nothing: a literal `dry_run: true` preview, and
`keep` listing exactly `checkout`, `branches`, `data` in that order. Any other
order, a partial list or a malformed value takes the deletion decision. Box
rejects `dry_run` combined with any other option.

The CLI cannot prove that a request keeps all three resources, so every
`box workspace remove` that is not a `--dry-run` preview takes the deletion
decision, including one with three `--keep` options. A CLI `--dry-run` preview
keeps the registration decision of the frozen `workspace remove` prefix rule,
Allow/Ask/Ask, because that rule's working-folder check ranks with any option
rule. Use the MCP preview for an assessment that always allows.

This tightens decisions early under the retirement rule's exception for a name
reused for stronger effects. In older Box versions a plain removal kept every
resource. Plain `workspace_remove` and `box workspace remove` move from
Allow/Ask/Ask to Ask/Ask/Deny, and their `allow_self_stop` forms from Ask to
Ask/Ask/Deny. The pack cannot tell the installed Box version apart, so these
decisions apply to older versions too. Upgrade Box to remove a workspace while
keeping its resources, using the MCP `keep` form above.

In another project, every `workspace_remove` form is denied in Strict, as
`workspace_cleanup` already was, including previews.

## Retained compatibility

The current Box source has no `workspace cleanup` command or `workspace_cleanup`
tool, and its `workspace remove` has no `--delete-checkout`, `--cleanup`,
`--worktree`, `--branches`, `--data`, `--history` or `--all` options and no MCP
`delete_checkout` field. `workspace remove` with `keep` and `dry_run` replaces
them. Their rules keep their exact reviewed decisions, with independent
fixtures, for older installed versions. The source checkout is not a published
release, so the first verified release without them is not yet established.
Removal is deferred until that release is verified, three subsequent published
feature releases follow, and no supported version needs them.

Project preconditions check the absolute path against the enrolled project before
ordinary rule ranking. Passing this check grants no operation by itself. Failed
or unavailable resolution retains the previous explicit-project review decision,
including Strict denial for cleanup and deletion. Empty, relative and malformed
project values require review. Omitted or null `project` keeps default selection.
Bundled documentation tools ignore project selection and retain their decisions.

Other argument restrictions, malformed dry-run handling, required preparation
identities, transport matching, CLI `--project` review and Box's own confirmation
requirements retain their existing behavior. Server matching accepts exactly
the stdio `box mcp serve` launch; extra arguments and HTTP do not match.

`setup` and `config_sync` still require Box's own exact human
confirmation before changing registrations, even under a pack Allow decision.
Their `dry_run: true` previews allow inspection without publication. An explicit
different project retains Ask across profiles, including for repair and preview.
Only the current `setup` and `docs_*` tool names are covered. Retired
`config_setup` and `box_docs_*` names receive the unknown-tool Ask decision.
User-scope setup, removal and hook repair retain Allow/Ask/Ask; previews require
the literal boolean `dry_run: true`. Box validates required agents and conflicting
arguments before applying changes; the pack retains the ordinary mutation
decision for refused or malformed mutation requests.

Generate this candidate with `node scripts/build-current-tool-packs.mjs box`.
Validate source admission, reproducibility, independent decisions and retained
published artifacts with
`npm test -- --shield /absolute/path/to/shield scripts/box-mcp-experience.test.mjs scripts/current-tool-packs.test.mjs`.

This registry uses indexed catalog v3.
