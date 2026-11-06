# Gate permissions 0.2.2

Requires Shield `>=0.20.0, <1.0.0` and
`field-paths-v1`. Extends [0.2.1](../0.2.1/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| CLI repository rename preview | Allow | Allow | Allow |
| Applying a rename, or MCP rename with host confirmation | Allow | Ask | Ask |
| Explicit discard dry-run in the current project | Allow | Allow | Allow |
| Discarding changes or deleting a dirty worktree | Ask | Ask | Deny |

`discard` without `--dry-run` can ask its user and apply changes even without a
`--confirm` argument; it retains the destructive decision. Untracked deletion
and interrupted discard recovery receive that same decision. A discard with an
explicit MCP project allows a dry-run only when the absolute project path is
inside approved write roots. Unproved paths retain the destructive decision.
The existing project/worktree path checks and force-push/forced-branch deletion
boundaries remain active. Gate's own exact confirmation is still required.

The `worktree_remove` MCP `discard_changes` field and CLI `--discard-changes`
retain explicit data-loss review. `remove_branch` alone keeps the existing
safe-removal behavior. Server launch matching requires exactly `mcp serve`;
extra project arguments cannot borrow this integration's allowances.

Generate with `node scripts/build-current-tool-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
