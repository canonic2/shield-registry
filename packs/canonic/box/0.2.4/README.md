# Box permissions 0.2.4

Requires Shield `>=0.20.0, <1.0.0`, including `field-paths-v1`,
`field-negation-v1` and `preconditions-v1`.

Explicit MCP `project` paths that resolve to the exact enrolled checkout use
the ordinary tool decision. Filesystem resolution accepts symlink aliases and
equivalent absolute paths. A descendant, parent or sibling checkout is a different
selection, including another checkout beneath `.gate/workspaces`.

| Operation in the enrolled checkout | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Redacted configuration inspection (`config_show`) | Allow | Allow | Allow |
| Configuration preview (`config_sync`, `dry_run: true`) | Allow | Allow | Allow |
| Configuration publication (`config_sync`) | Allow | Ask | Ask |
| Agent registration and inherited hook repair (`config_setup`, `repair_hooks`) | Allow | Ask | Ask |
| Workspace content edits | Allow | Allow | Ask |
| Arbitrary execution (`exec`) | Ask | Ask | Ask |
| Resource deletion | Ask | Ask | Deny |
| Unknown tools | Ask | Ask | Ask |

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

`config_setup` and `config_sync` still require Box's own exact human
confirmation before changing registrations, even under a pack Allow decision.
Their `dry_run: true` previews allow inspection without publication. An explicit
different project retains Ask across profiles, including for repair and preview.

Generate this candidate with `node scripts/build-current-tool-packs.mjs box`.
Validate source admission, reproducibility, independent decisions and retained
published artifacts with
`npm test -- --shield /absolute/path/to/shield scripts/box-mcp-experience.test.mjs`.

This registry uses indexed catalog v3.
