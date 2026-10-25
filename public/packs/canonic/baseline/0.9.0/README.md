# Baseline permissions 0.9.0

Supports Shield `>=0.2.0, <1.0.0`.

`grep` filters piped input in every profile, like the other stdin text filters:
`grep FLAGS PATTERN` with the supported flags and no file operands, as in
`ls -a | grep -i ignore`. Searches of named files keep their approved-path
requirements. Recursive searches, pattern files, unknown options and other
`grep` forms remain denied with the same advice. Every `grep` rule decides
alike in all profiles, so the `grep` cases run in the recommended profile only,
keeping the fixtures within their 1024-case limit. Other rules, profiles and
cases match [0.8.0](../0.8.0/README.md).

Generate with `node scripts/build-baseline-stdin-grep.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-stdin-grep.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
