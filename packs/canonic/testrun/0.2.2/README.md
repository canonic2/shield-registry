# Testrun permissions 0.2.2

Requires Shield `>=0.20.0, <1.0.0`.
Extends [0.2.1](../0.2.1/README.md) for the shared mobile/browser verbs.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Valid mobile MCP action batches, up to eight supported actions | Allow | Allow | Ask |
| Browser action batches through `act` | Ask | Ask | Ask |
| Browser launch through `connect` with `engine` or `browser_connect` | Ask | Ask | Ask |
| Malformed/unknown action discriminators or oversized batches | Ask | Ask | Ask |
| Explicit app launch environment overrides | Ask | Ask | Ask |

`act` now accepts browser operations that may import host files, export storage
or send arbitrary HTTP. Its former generic device allowance cannot establish
those effects as routine input. Every supplied mobile slot must name a supported
mobile action; a later browser action cannot borrow an earlier tap's allowance.
Existing launch-environment review applies to every slot.

The CLI serializes actions as opaque JSON. An explicitly targeted `act` receives
review because its target can select browser operations; this also conservatively
reviews explicitly targeted mobile CLI calls. Untargeted mobile CLI input retains
its existing profile decision. Browser `connect --engine` receives review too.
The legacy `browser_send` tool keeps its existing operation-specific decisions;
this release does not add a blanket browser allowance. Build, project,
device setup and unknown-tool boundaries remain unchanged.

The opt-in native trace performance lifecycle retains the trace request's
Allow/Ask/Ask decisions through `browser_send` and the opaque CLI request.
Shared browser `act` keeps Ask in every profile. Independent fixtures cover
default and explicit manual/no-reload forms; no policy or version change is
needed for this option.

Native trace `filePath` export at start or stop keeps the existing host-file
mutation decision: Allow/Ask/Ask for opaque CLI requests and `browser_send`,
Ask in every profile for shared browser `act`. Eighteen independent profile
cases cover start/stop JSON/gzip destinations through those interfaces. No
policy or version change is needed for this option.

Server matching requires exactly `mcp serve`, without extra project arguments.
No device or browser is launched by pack generation or decision fixtures.

Generate with `node scripts/build-current-tool-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
