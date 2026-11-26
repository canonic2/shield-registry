# Baseline permissions 0.20.0

This release updates process lookups and Shield MCP recovery from
[Baseline 0.19.0](../0.19.0/README.md). The engine range and policy capabilities
are unchanged.

## Process lookups

Use `pgrep -f 'build-worker|compiler'` to match against full process arguments
and print only matching PIDs. All profiles block `pgrep -fl`, `pgrep -lf` and
`pgrep -f -l` on ordinary process searches and direct the agent to drop `-l`.
On macOS, combining these flags prints the full arguments of each match. procps
on Linux lists the process name with `-l`. An agent can request exact one-time
approval for the full listing when the task needs it.

## Restore locked Shield packs

On Shield 0.56.0 and later, all profiles allow the argument-free MCP call
`pack_restore` on a [matching Shield connection](../0.19.0/README.md#shield-mcp).
Use it when `status` or `doctor` reports missing locked artifacts. It fetches
only the versions and digests already selected in the project's locks into
the local artifact store. Project policy, pack selections and locks stay
intact. Extra arguments and unverified connections retain the Ask fallback.
`shield pack restore --help` is covered by the normal help rule. Use MCP
for agent recovery and `shield pack restore` for terminal operation.

Generate with `node scripts/build-baseline-pgrep.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-pgrep.test.mjs`.

Licensed under MIT.
