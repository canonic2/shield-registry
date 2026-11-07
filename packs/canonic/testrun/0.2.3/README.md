# Testrun permissions 0.2.3

Requires Shield `>=0.20.0, <1.0.0`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Browser launch through shared CLI `connect --engine` or either MCP launch tool | Ask | Ask | Ask |
| Browser action batches through `act` | Ask | Ask | Ask |
| Opaque CLI `browser send` and host HTTP/trace mutations through `browser_send` | Allow | Ask | Ask |
| Valid mobile MCP action batches, up to eight supported actions | Allow | Allow | Ask |
| Explicit app launch environment overrides | Ask | Ask | Ask |

The browser-launch guard retains review when the shared CLI command includes
`--mode`, `--context`, reordered or attached values, unknown options, or a bare
engine marker without a value. Context
JSON stays opaque. Other options cannot make an explicit browser launch borrow
the mobile connect allowance. Testrun still validates its actual arguments.

Owned-browser cleanup evidence adds no permission. Disconnect remains
Allow/Allow/Ask, with independent CLI and both MCP-name fixtures.

Configured browser headers, page-over-context overrides, whole-list replacement/reset and associated HTTP
header inheritance retain their host/network request decisions through CLI and
MCP. An explicit empty HTTP header list does not bypass review. Shared browser
actions remain Ask in every profile. Existing operation-specific browser reads
and isolated evaluation decisions remain in force; there is no blanket browser
allowance.

Configured Basic credentials, associated inheritance and explicit empty
suppression retain opaque HTTP/context mutation review. Forty-five independent
development profile cases cover CLI, both MCP action paths and browser launch;
credential data does not grant a new Allow decision.

Build, project, device setup, host-file access, unknown-tool fallback and the
other restrictions described in [0.2.2](../0.2.2/README.md) remain. Server matching
requires exactly `mcp serve`, without extra project arguments. Generation and
decision fixtures do not launch a device or browser.

Generate with `node scripts/build-current-tool-packs.mjs testrun`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
Installing or updating the pack requires review in the consuming project.
