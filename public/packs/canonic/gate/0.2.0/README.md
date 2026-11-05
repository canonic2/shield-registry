# Gate permissions 0.2.0

Requires Shield `>=0.20.0, <1.0.0`.

CLI and MCP coverage, project paths and server bindings follow
[0.1.0](../0.1.0/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Inspection, fetch and previews | Allow | Allow | Allow |
| Staging, commits and supported in-project worktree creation | Allow | Allow | Ask |
| Push, configuration acceptance, migration, setup and other privileged changes | Allow | Ask | Ask |
| Forced history replacement or deletion of unique work | Ask | Ask | Deny |
| Amendments, explicit project selection, unlisted syntax and server streams | Ask | Ask | Ask |

MCP explicit-project review uses the arguments actually present: a push with
`project` asks, while adding `force_with_lease` retains the destructive decision.
An unused optional force parameter does not make every explicit-project call
destructive. File/path checks, Gate's validation and Gate's own confirmations
remain authoritative. Ask follows host approval or the configured fallback.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
