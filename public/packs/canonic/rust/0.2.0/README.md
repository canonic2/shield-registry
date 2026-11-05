# Rust permissions 0.2.0

Requires Shield `>=0.20.0, <1.0.0`.

Rust, Cargo, toolchain routes, executable bindings and explicit path grammars
follow [0.1.2](../0.1.2/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata, help and identity queries | Allow | Allow | Allow |
| Listed builds, tests, formatting, dependency edits, resolution, fetch and vendoring | Allow | Allow | Ask |
| Supported executable installation and authentication prefixes | Allow | Ask | Ask |
| Registry/configuration risk scans, cleanup, execution overrides, direct plugins, publication and unlisted syntax | Ask | Ask | Ask |
| Explicit paths outside approved roots or into protected state | Deny | Deny | Deny |

Dependencies and build scripts remain trusted project execution. A strict profile
can review acquiring dependencies without making normal dependency maintenance
impossible. Registry selection and authentication are reviewable instead of
being denied as a family. Explicit target, manifest,
output and source path checks are unchanged, including toolchain routes.
Review does not approve a future command or contain executed code.

Ask uses the host's permission flow or configured fallback. Generate with
`node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
