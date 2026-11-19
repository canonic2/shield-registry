# Git permissions 0.12.0

Requires Shield `>=0.20.0, <1.0.0`.

Command coverage and other decisions follow [0.11.0](../0.11.0/README.md).

With Git output target support in Shield, Loose and Recommended allow
`--output` on `diff`, `show`, `log`, `diff-tree`, `diff-index` and
`whatchanged` when all destinations are within the writable scope. In native
agent integrations this includes verified system temporary directories.
Git, Gate and Shield metadata directories are excluded. An unverified or
excluded destination asks in every profile. Strict reviews file output, as
do older clients without the target model. Archive output and other output
modes follow the existing review rules.

Generate with `node scripts/build-git-allow-by-default.mjs 0.12.0`.
Validate with `npm test -- --shield /absolute/path/to/shield scripts/git-scoped-output.test.mjs`.
