# Testrun permissions 0.2.0

Requires Shield `>=0.20.0, <1.0.0`.

CLI and MCP coverage, device/browser operations, path requirements and server
bindings follow [0.1.0](../0.1.0/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Device/browser inspection, screenshots, status and waits | Allow | Allow | Allow |
| Listed input, connection, app installation and configured builds | Allow | Allow | Ask |
| Support installation, signing/setup and other privileged changes | Allow | Ask | Ask |
| Inline builds, environment overrides, opaque execution and unlisted syntax | Ask | Ask | Ask |

Explicit build projects, build/launch environment maps and browser request fields
retain their original predicates. Supported isolated-browser actions keep their
own input decision; host files, permission grants, exported storage, arbitrary
HTTP and opaque batches retain review. Physical device input acts on the
connected target and its signed-in apps. The pack does not sandbox build code,
installed simulator applications or child processes.
Ask uses the host's permission flow or configured fallback.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
