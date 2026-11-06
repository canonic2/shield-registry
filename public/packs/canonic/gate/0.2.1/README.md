# Gate permissions 0.2.1

Requires Shield `>=0.20.0, <1.0.0` and `field-paths-v1` support.

Routine local CLI and MCP engineering is allowed in every profile: staging,
commits, attachment, initialization, safe branch deletion, guarded force-create,
session lifecycle and promotion, transaction recovery and approved worktree
creation. Gate's file, commit and transaction safeguards remain authoritative.

MCP pushes, policy acceptance, migration and removals retain Gate's concrete
confirmation instead of a generic approval first. Strict still denies loss of
unique work and remote history replacement. CLI final destructive operations,
amendments, forced ignored-file staging and remote destination changes retain
their reviews. Other boundaries follow [0.2.0](../0.2.0/README.md).

Explicit project paths are checked against approved roots. MCP project paths
must be absolute; a worktree destination must also be absolute when selecting
an explicit project. Relative MCP destinations otherwise use the enrolled
project root, matching Shield's verified launcher even when the agent works
in a subfolder. The Gate connection requires exactly `gate mcp serve`; select
another workspace with the tool's absolute `project` argument. Worktree destinations retain
protected-path exclusions and physical symlink checks.

Requires the `field-paths-v1` capability in an updated Shield build. Older
builds refuse this release rather than ignoring its path checks. Short
`docs_list`, `docs_search` and `docs_read` tools and the legacy names are allowed.

Generate with `node scripts/build-gate-switch-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/gate-switch.test.mjs`.
