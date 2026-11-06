# Box permissions 0.2.2

Requires Shield `>=0.20.0, <1.0.0`, including
`field-negation-v1` for recovery selector checks.
Extends [0.2.1](../0.2.1/README.md) with workflow-plugin and MCP publication tools.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Plugin inspection, context, launch preparation and retained workflow inspection | Allow | Allow | Allow |
| Binding edits and a finite recipe check | Allow | Allow | Ask |
| Revised preparation of a blocked checkout with exact attempt and retry identities | Allow | Allow | Ask |
| Plugin selection, workflow reconciliation/abandonment and config publication | Allow | Ask | Ask |
| External workflow run/resume or native plugin launch | Ask | Ask | Ask |
| Explicit dry-run of plugin configuration, workflow execution or config publication | Allow | Allow | Allow |
| Discarding uncommitted workspace files | Ask | Ask | Deny |
| Arbitrary exec, shell and shell shortcuts, including manager-owned sessions | Ask | Ask | Ask |
| Workspace removal, including deferred closure from its own session | Allow | Ask | Ask |
| Immediate self-stop during removal or stop | Ask | Ask | Ask |
| Recover by workspace or exact operation/generation | Allow | Ask | Ask |
| MCP recovery combining workspace with operation or generation | Ask | Ask | Ask |

Preparation returns a terminal handoff; it does not execute its command.
`plugin_launch` is not an MCP tool. Unknown plugin tools still require review.
Explicit MCP project selection retains review, including on previews. Existing
execution, environment, credentials, file-path and cleanup restrictions remain.
Setting `discard_changes` cannot turn checkout deletion into routine removal.
Both CLI `--discard-changes` forms and MCP removal/cleanup retain the destructive
decision, including invalid combinations with a preview or immediate self-stop.
Box still applies its own content revisions and exact confirmation checks.
`workspace_prepare` preserves the saved task and permits no cleanup, branch reset,
arbitrary command or selection change over ambiguous native effects. Missing or
malformed attempt IDs require review; explicit MCP projects retain review.

Execs and shells have recorded executions under the project manager. They can
start the manager, retain execution state and stop owned descendants during
cleanup; they start no recipe services implicitly. Manager ownership leaves
their arbitrary-command Ask boundary unchanged. Shell is CLI-only; an MCP
`shell` request retains unknown-tool review.

Removal from the workspace's own session stops other executions and schedules
closure after the hosting session and its owned children exit. That deferred
request retains the removal decision; `allow_self_stop` explicitly requests
immediate termination and requires review. Checkout deletion or discard retains
the destructive decision even when combined with immediate self-stop. The pack
does not infer caller-session identity or authorize a retry after refusal.

Box rejects recovery combining workspace with operation or generation. MCP
conflicts explicitly require review in this pack. CLI fixtures retain the
existing recovery decision because CLI admission does not validate clap's
argument relationships; Box rejects those conflicts before recovery. Compose
creation settlement retains the destructive decision. These policy fixtures
verify admission and decisions, not session supervision or recovery execution.

Server matching accepts exactly `mcp serve`; additional arguments selecting a
different project do not gain this pack's allowances. Supported executable
locations and user-install matching remain unchanged.

Generate with `node scripts/build-current-tool-packs.mjs box`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
