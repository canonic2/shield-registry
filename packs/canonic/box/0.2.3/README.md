# Box permissions 0.2.3

Requires Shield `>=0.20.0, <1.0.0`, including `field-negation-v1`.
Extends [0.2.2](../0.2.2/README.md) for Box 0.26.0. Existing CLI, plugin,
execution, cleanup and recovery boundaries are retained.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Redacted effective configuration and publication-state inspection (`config_show`) | Allow | Allow | Allow |
| Explicit MCP project selection, including configuration inspection | Ask | Ask | Ask |
| Deferred workspace creation in the recipe's checkout layout | Allow | Allow | Ask |
| Deferred attachment or an explicit checkout path | Ask | Ask | Ask |
| Deferred preparation with exact workspace, operation, generation and retry identities | Allow | Allow | Ask |
| Preparation missing or carrying malformed attempt/retry identities | Ask | Ask | Ask |
| Guided configuration publication (`config_sync` with `select`) | Allow | Ask | Ask |
| Explicit configuration publication preview | Allow | Allow | Allow |
| Dashboard workspace status read (`status`) and bundled `docs_*` tools | Allow | Allow | Allow |
| Unknown tools | Ask | Ask | Ask |

`config_show` reads redacted project or user configuration, drift and recovery
state; it publishes nothing. Explicit MCP project paths retain review.
`select` collects choices before the ordinary publication review and host user
confirmation. Selection itself grants no permission to publish.

`deferred` changes how workspace creation, attachment or preparation returns its
result. Manager admission has the ordinary operation's effects and permissions;
Box validates request identities before recording Task intent. The pack does not
replace Box's schema validation, revision checks or confirmation requirements.

Progress notifications, workspace resources, subscriptions and Tasks management
are MCP protocol features, not additional tool names. The dashboard uses the
existing `status` read and offers no mutation controls. These tool rules do not
claim to authorize or intercept protocol methods. Text-only clients keep the
ordinary tool results. Unknown dashboard or Tasks tool names require review.

Server matching accepts exactly the stdio `box mcp serve` launch. Extra launch
arguments and HTTP transports do not match. Executable locations, approved-path
restrictions, arbitrary-command review and destructive Strict denial remain.

Generate only this version with
`node scripts/build-current-tool-packs.mjs box`. Validate its schema,
reproducibility, retained CLI/MCP fixtures and independent interaction cases with
`npm test -- --shield /absolute/path/to/shield scripts/box-mcp-experience.test.mjs`.

This release uses indexed catalog v3; clients
must support that format before consuming the new registry root.
