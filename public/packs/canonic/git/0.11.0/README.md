# Git permissions 0.11.0

Requires Shield `>=0.20.0, <1.0.0`.

Command coverage follows [0.10.0](../0.10.0/README.md). This release
allows everyday Git use by default and reviews the forms that can cause harm.

## What changes

- **Local commands and options:** Loose and Recommended allow commands and options
  the pack does not list, such as `commit --trailer` or a new `log` display option.
  Strict still asks for anything it does not list.
- **Network reads:** Recommended allows `fetch`, `pull`, `ls-remote`, `clone`,
  `remote show`, `remote update` and `submodule update`/`add`/`sync`, including
  for URLs. Strict asks.
- **Rebase:** Recommended allows `rebase`; `-i`, `-x`/`--exec` and `-s`/`--strategy` ask.

## What still asks

In every profile:

- Options that run a program for a transfer: `--upload-pack`, `--receive-pack`,
  `--exec`, and `clone -u`.
- `clone`/`init` with `--template`, `-c` or `--config`.
- `--ext-diff`, `--textconv` and `grep -O`/`--open-files-in-pager`.
- `git config` keys that run programs, load configuration or redirect remote
  access, such as `alias.*`, `core.sshCommand`, `core.hooksPath`, `include.path`,
  `credential.helper`, `url.*.insteadOf` and `filter.*`. Ordinary keys such as
  `user.name` are allowed. Reading one of these keys, as in
  `git config --get core.hooksPath`, also asks; `git config --list` does not.
- `diff`/`grep --no-index`, `blame --contents`, `--output` and `archive -o`.
- `pull`/`merge`/`cherry-pick`/`revert` with an external merge strategy, `bisect run`
  and `git shell`.
- Git options before the subcommand other than `-C`, `--no-pager` and `-P`, such as
  `-c` and `--git-dir`.

In Recommended, as in 0.10.0: `push`; destructive operations such as
`reset --hard`, `clean`, forced checkout, switch, branch, tag, `rm` and `mv`, stash drops,
ref and reflog deletion; forced fetch refspecs and `submodule update --force`; history
rewrites such as `commit --amend`; and administration commands. Strict refuses the
destructive operations.

Destructive-option checks match short-option clusters such as `rm -rf` and
`--option=value` spellings such as `--force-with-lease=main`.

## Limits

The pack matches arguments, not repository state. It cannot tell whether a remote
name is configured, what a hook does or whether a path leaves the project. Changing
remotes or executing configuration asks, so a remote cannot be redirected silently.
Environment variables such as `GIT_SSH_COMMAND` need host enforcement.

Generate with `node scripts/build-git-allow-by-default.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/git-allow-by-default.test.mjs`.
