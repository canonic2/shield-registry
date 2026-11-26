# Baseline permissions 0.21.0

This release extends [Baseline 0.20.0](../0.20.0/README.md) with literal
`sed -e` expressions. It requires Shield `>=0.57.0, <1.0.0` for checking
the files named by each expression.

## Sed expressions

Use one or more supported `-e` expressions for reads or in-place edits.
For example, `sed -i '' -e '1s/old/new/' -e '2s/left/right/' README.md`
edits an approved file on macOS. On GNU sed, use `--in-place` for this
expression form. Supported in-place edits allow in Loose and Recommended
and ask in Strict. Read-only expressions allow in all profiles when their
files are readable under policy. Named reads and writes in in-place scripts
follow the same path checks as positional scripts.

Script files (`-f`), backup suffixes, blocks, shell execution and standalone
`-e` scripts that write named files require review.

## Shield inspection

On a matching Shield MCP connection, all profiles allow `rule_list` with a
`pack_selector` from `pack_list`. The `invocations` and `command_sets`
sections require that selector. `policy_evaluate` previews that match an MCP
server automatically show its resolved rule identity in `data.mcp_match.server`.
Use that identity in a custom MCP rule. CLI help and version commands are also
allowed. The [Shield connection and review boundaries](../0.19.0/README.md#shield-mcp)
and [locked pack recovery](../0.20.0/README.md#restore-locked-shield-packs) apply.

Generate with `node scripts/build-baseline-sed-expressions.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-sed-expressions.test.mjs scripts/baseline-shield.test.mjs`.

Licensed under MIT.
