# Git permissions 0.10.0

Requires Shield `>=0.20.0, <1.0.0`.

Profiles, boundaries and command coverage follow [0.9.0](../0.9.0/README.md).
This release classifies `git merge-tree`, which agents use to check whether two
branches merge cleanly:

- Loose and Recommended allow the `--write-tree` mode, including the two-operand
  default, and the deprecated three-operand `--trivial-merge` mode, with
  `--name-only`, `-z`, `--messages`, `--no-messages`, `--quiet`,
  `--allow-unrelated-histories`, `--merge-base` and `-X`/`--strategy-option`.
- Strict asks: the merge never changes refs, the index or the working tree, but it
  can add unreferenced objects to the object store.

`--stdin` and unlisted options still ask in every profile.

Generate with `node scripts/build-git-inspection.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/git-inspection.test.mjs`.
