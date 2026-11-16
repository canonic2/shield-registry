# Baseline permissions 0.15.0

Supports Shield `>=0.36.0, <1.0.0`.

`grep` searches are decided by the files they read rather than a list of
options. Shield reads grep options the way GNU and BSD grep do, so options that
only shape matching or output, such as `-A1`, `-o`, `-m 3`, `-P` or
`--color=always`, are allowed. The checked paths are file operands, `-r`
folders and their existing entries, `-f` pattern files and `--exclude-from`
files. A search of piped input, such as `git show HEAD:yarn.lock | grep -n -A1
PATTERN`, reads no file and is allowed. A recursive search without a path checks
the working directory.

Outside or protected paths, `-R`, a bare `-C` or `--context` (write `-C3` or
`--context=3`), ambiguous option abbreviations and options grep does not
define are refused with guidance, as for `rg`; earlier releases asked for
review instead. Shield builds before 0.36.0 cannot read these forms and do not
accept this release.

Other rules, profiles and cases match [0.14.0](../0.14.0/README.md).

Generate with `node scripts/build-baseline-grep-effects.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-grep-effects.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
