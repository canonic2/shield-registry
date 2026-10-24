# Baseline permissions 0.8.1

Supports Shield `>=0.2.0, <1.0.0`. Shield 0.x releases preserve the supported
pack contract; a breaking change requires Shield 1.0.0. Required capabilities
and schema validation still apply. Compatible Shield minor releases do not
require a new pack release.

Rules, profiles, cases and command inventory are identical to 0.8.0;
only release identity and Shield compatibility change. See the
[profile and coverage guide](../0.8.0/README.md) for permission boundaries.

Generate with `node scripts/build-shield-0x-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/shield-0x-packs.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
