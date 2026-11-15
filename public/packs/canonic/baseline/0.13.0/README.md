# Baseline permissions 0.13.0

Supports Shield `>=0.20.0, <1.0.0`.

Package-script reviews (`npm run`, `npm test`, `pnpm`/`yarn` script verbs and
their `--prefix`, `--workspace`, `--dir`, `--filter`, `-r` and `--cwd` forms) are
fallback rules. Without a package-manager pack they still ask; with one, such as
canonic/node, that pack decides. Other rules, profiles and cases match
[0.12.0](../0.12.0/README.md).

Generate with `node scripts/build-node-everyday.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/node-everyday.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
