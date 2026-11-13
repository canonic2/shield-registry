# Git permissions 0.9.0

Requires Shield `>=0.20.0, <1.0.0`.

Profiles, boundaries and command coverage follow [0.8.0](../0.8.0/README.md).
This release widens the allowed inspection grammars with read-only options agents
use routinely:

- `range-diff` accepts the diff display options (`--stat`, `--name-only`, `-U`, colors).
- `log`, `stash list` and `reflog show` add `--abbrev-commit`, `--decorate`,
  grep matching modes, reflog walks, signatures, notes, mailmap, merge displays and
  `-<n>` counts combined with any listed option.
- `show` adds one-line and abbreviated displays, decoration and merge displays.
- Diff commands add compact summaries, rename/copy detection, submodule displays and
  whitespace controls. Options Git accepts only as `--name=value` or bare, such as
  `--stat=120` and `--decorate`, accept both spellings.
- `status`, `grep`, `ls-files`, `ls-tree`, `blame`, `rev-list`, `for-each-ref`,
  `describe`, and branch/tag listings add their remaining display options.

Options that write files (`--output`), launch external programs (`--ext-diff`,
`--textconv`, `grep -O`) or compare files outside the repository
(`diff --no-index`) remain unlisted and ask.

Generate with `node scripts/build-git-inspection.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/git-inspection.test.mjs`.
