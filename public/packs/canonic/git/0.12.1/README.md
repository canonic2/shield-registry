# Git permissions 0.12.1

Requires Shield `>=0.20.0, <1.0.0`.

Command coverage and other decisions follow [0.12.0](../0.12.0/README.md).

A leading `-c core.editor=true`, `-c core.editor=:`, `-c sequence.editor=true` or
`-c sequence.editor=:` is the usual way to skip an editor, as in
`git -c core.editor=true rebase --continue`. These settings add no effect of
their own, so the command takes the decision it has without the setting. They
do not guarantee that no editor runs: `GIT_EDITOR` takes precedence, and
`sequence.editor` covers only the rebase todo list. Recommended allows
`rebase --continue`, `rebase -i` still asks and `reset --hard` still asks.
It may follow `--no-pager` or `-P`. Output destinations keep their writable-scope
check after the setting; Shield versions that cannot read past the setting to
verify a destination ask.

Any other value, such as `-c core.editor=vim`, another key, an attached
`-ccore.editor=true`, `--config-env` or a second `-c` matches no form and asks
in every profile, because those settings can run programs or change what Git reads.

Generate with `node scripts/build-git-allow-by-default.mjs 0.12.1`.
Validate with `npm test -- --shield /absolute/path/to/shield scripts/git-noop-editor.test.mjs`.
