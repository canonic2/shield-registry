# Baseline permissions 0.12.0

Supports Shield `>=0.20.0, <1.0.0`.

Recursive `grep` searches are allowed in every profile when each operand is an
existing file or folder in approved readable paths and no existing entry below a
folder, hidden ones included, is excluded: `grep -rn -i PATTERN PATH`, with
`--recursive`, `--include`, `--exclude`, `--exclude-dir` and patterns given
with `-e` or `--regexp`. Filters do not narrow the checked footprint. Options may
follow the operands as single words, such as `--include=*.md`. A recursive
search without a path, outside or unverifiable paths, `-R` and pattern files ask
for review, like other unsupported `grep` forms. Shield builds without the
recursive `grep` model also ask. `grep` review guidance names the supported
folder searches and `rg`. Other rules, profiles and cases match
[0.11.1](../0.11.1/README.md).

Generate with `node scripts/build-baseline-recursive-grep.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-recursive-grep.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
