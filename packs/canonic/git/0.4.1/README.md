# Git permission pack

`canonic/git` **0.4.1** defines structured v1 permissions for Git commands. It includes the
documented Git 2.56 command inventory and additional built-in helpers found in
Apple Git 2.50.1: **173 command names**, with explicit options for common workflows.
The [command inventory](commands.json), [policy](pack.yml) and
[decision fixtures](cases.json) are available for review.

## Install

In an initialized Shield project:

```sh
shield info main/git
shield add main/git@0.4.1 --profile recommended
```

This release requires `structured-rules-v1` and `argument-rules-v1`;
unsupported clients reject it. Pack installation does not install Git or an
enforcement integration. Releases 0.3.0/0.4.0 and historical 0.1.0/0.2.0
releases remain available for compatible clients.

The 837 rules use domain conditions and explicit profile decisions. Option
grammars declare optional long values separately, and conservative risk_tokens
rules replace the historical contains representation. All 1023 independent
decision fixtures preserve the reviewed profile outcomes.

## Profiles

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed inspection and dry-run forms | Allow | Allow | Allow |
| Listed `add` / `stage` forms | Allow | Allow | Ask |
| Listed local changes Git history can recover: `init` of the current folder, commits, branch/tag creation, branch rename/copy/upstream, switch, `checkout -b`/`--detach`, merges, cherry-picks, reverts, soft resets, stashes | Allow | Allow | Ask |
| Other `checkout` forms, which may overwrite uncommitted files | Allow | Ask | Ask |
| Remote access, fetch/pull/push, submodule updates | Ask | Ask | Deny |
| Destructive operations, history rewriting, sensitive helpers | Ask | Deny | Deny |
| Unclassified commands or unlisted options | Ask | Ask | Ask |

Recommended lets an agent do contained, recoverable repository work on its own and
keeps prompts for remote access and unlisted forms; destructive operations stay
denied. `git init` with a target path, `--template` or `--separate-git-dir` can reach
outside the working folder, so it asks. `git checkout NAME` can switch branches or
replace a file's uncommitted changes, and Git decides which only when it runs, so
it asks and suggests `git switch` or `git restore --staged`. Known dangerous command families retain
their restrictive baseline even when options are unlisted. Profiles become progressively restrictive. Project custom
rules can override community pack decisions; Shield's own authority restrictions
remain enforced by the client.

## Everyday examples

The inspection allowlists cover status, log, diff/show, grep/blame, object/ref
queries, branch/tag listing, stash/reflog inspection, remote URL listing,
worktree/submodule status and read-only configuration queries. Examples allowed
in all profiles include:

```sh
git status --short --branch
git status --porcelain=v2 -z
git log --oneline --graph -n5 HEAD
git diff --cached --stat
git diff --no-ext-diff --no-textconv -- src
git branch --list 'feature/*'
git config --get user.name
git clean -nd
```

Recommended allows `git init`, `git add -A`, `git commit -m ...`, `git branch -m main`
and `git switch -c feature`, asks before `git checkout main` and `git push origin main`,
and denies `git reset --hard`, `git clean -fdx`, force/deleting pushes, branch/tag
deletion or forced rename, commit amendment or
hook bypass, destructive stash/worktree operations and sensitive internal helpers.
Dry-run permission requires the actual dry-run flag to be parsed: a string inside
an option value or after `--` does not count.

## Matching and boundaries

Rules match the literal executable `git`. `--no-pager` and `-P` before the command
are supported. Other global options, including `-c`, `-C`, `--git-dir` and
`--config-env`, ask rather than being stripped. Absolute executable paths,
aliases, extension commands and future command names ask when not explicitly matched.

Allow rules enumerate option arity. They preserve operands and `--`, recognize
long attached values and short clusters, and reject unknown options. Options
such as `--output`, `--ext-diff`, `--textconv` and pager-opening grep forms receive
no inspection allowance. Optional long values can use `--name=value`.
Some valid Git spellings still ask when their arity has not been explicitly listed.

Risk rules conservatively detect force, deletion and rewrite flags anywhere
before `--`. Forced/deleting refspecs also match after `--`. A dangerous-looking
token consumed as another option's value can still ask or deny; these risk rules
cannot grant permission. Matching does not parse shell source, resolve executable
identity, inspect hooks/configuration or prove the absence of external effects.
Repository settings can affect Git behavior, including inspection commands.
The host must enforce the actual command and environment; this pack provides
reviewable permission decisions, not a Git sandbox.

All inventoried command names have an explicit baseline. That does not imply
every possible option combination is allowed or fully classified. Less common
plumbing, import/export, recovery and administration forms require review unless
a more specific rule applies. Whole-policy comparison may report incomplete
coverage for option-aware predicates.

## Validation and maintenance

The 1023 fixtures cover each command's baseline in all three profiles and common
workflows, option ordering, clusters, unknown options, missing values, separators,
global overrides and forced refspecs. The Rust Shield evaluator checks the actual
pack; the registry does not implement a second permission engine.

Coverage is based on Git's [command inventory](https://github.com/git/git/blob/v2.56.0/command-list.txt)
and [official manuals](https://git-scm.com/docs/git), including
[push refspecs and force options](https://git-scm.com/docs/git-push) and
[clean's dry-run behavior](https://git-scm.com/docs/git-clean).
Rule changes require a new release with reviewed fixtures. Licensed under MIT.
