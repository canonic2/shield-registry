# Box permissions 0.2.0

Requires Shield `>=0.20.0, <1.0.0`.

CLI and MCP coverage, path requirements and server bindings follow
[0.1.0](../0.1.0/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Inspection and previews | Allow | Allow | Allow |
| Workspace content and declared recipe execution | Allow | Allow | Ask |
| Agent work, setup, sync, discovery, login revocation and other privileged changes | Allow | Ask | Ask |
| Destructive workspace/data cleanup | Ask | Ask | Deny |
| Arbitrary commands, environment overrides, explicit project selection and unlisted syntax | Ask | Ask | Ask |
| Printing authentication headers | Deny | Deny | Deny |

MCP explicit-project selection reviews the actual operation. A workspace removal
that keeps resources asks; adding `delete_checkout` still has the destructive
decision. Named content and goal files retain their explicit path requirements.
Recipe execution trusts project code. Raw `exec`/shell commands are not parsed as
transparent children, including child help flags, and retain review.
Ask follows host approval or the configured fallback.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
