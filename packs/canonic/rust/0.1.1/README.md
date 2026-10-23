# Rust permissions 0.1.1

Supports Shield `>=0.3.0, <0.5.0`, including Shield 0.4. Policy format and
capabilities are unchanged. See the [profile and coverage guide](../0.1.0/README.md)
for the command inventory and permission boundaries.

Rules, profiles, cases and command inventory are identical to 0.1.0; only release identity and Shield compatibility change.

Generate with `node scripts/build-shield-04-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/shield-04-packs.test.mjs`.
Node and Rust composition checks run in the complete policy suite. Published
previous releases retain their original bytes.

Licensed under MIT.
