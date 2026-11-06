# Baseline permissions 0.11.1

Requires Shield `>=0.20.0, <1.0.0`.

Preserves [0.11.0](../0.11.0/README.md) and allows the bundled documentation
tools of verified Workbench stdio servers: `docs_list`, `docs_search`
and `docs_read`, with their legacy prefixed names. No other server operation
receives an allowance. Server bindings require the tool's supported executable
locations and `mcp serve` launch arguments; a server name alone is insufficient.
Shield's own documentation tools use Shield's built-in inspection approvals
and require no pack integration.

Generate with `node scripts/build-docs-tool-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/docs-tool-packs.test.mjs`.
