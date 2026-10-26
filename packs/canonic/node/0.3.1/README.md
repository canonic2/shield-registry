# Node permissions 0.3.1

Supports Shield `>=0.7.0, <1.0.0`.

Credential commands match the npm command position, so script or dependency
names such as `get`, `set` and `config` do not become credential operations.
Direct npm credential/configuration commands and their Corepack forms retain
their profile decisions. Recognized leading npm options retain those checks;
unlisted forms require review.

Local `npm pkg get/set/delete/fix` operations allow in Loose and Recommended
and ask in Strict. They inspect or edit package.json without executing scripts.
Corepack npm forms have the same policy. Project scripts, dependency additions,
and execution/configuration overrides retain their existing review boundaries.

Generate with `node scripts/build-node-command-review.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/node-command-review.test.mjs`.

Licensed under MIT.
