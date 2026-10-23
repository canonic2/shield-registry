# Baseline permissions 0.8.0

Supports Shield `>=0.2.0, <0.5.0`, including Shield 0.4. Policy format and
capabilities are unchanged. See the [profile and coverage guide](../0.7.0/README.md)
for the command inventory and permission boundaries.

Pagers (`less` and `more`) require review in every profile, including commands with readable files, logging options or helper environment variables. They can start subprocesses and access files beyond their input operands. File-read permission does not authorize pager execution. Outside-file pager commands also require review; these rules do not claim a complete file footprint. Other rules and protected-path guards still apply. Other command decisions match Baseline 0.7.0.

Generate with `node scripts/build-shield-04-packs.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/shield-04-packs.test.mjs`.
Node and Rust composition checks run in the complete policy suite. Published
previous releases retain their original bytes.

Licensed under MIT.
