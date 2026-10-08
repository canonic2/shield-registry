# Git permission pack

`canonic/git` **0.2.0** defines permissions for Git commands. It includes the
documented Git 2.56 command inventory and additional built-in helpers found in
Apple Git 2.50.1: **173 command names**, with explicit options for common workflows.
The [command inventory](commands.json), [policy](pack.yml) and
[decision fixtures](cases.json) are available for review.

## Install

In an initialized Shield project:

```sh
shield info main/git
shield add main/git --profile recommended
```

Use `main/git@0.2.0` to pin this release. Compatible clients must support the
`argv-options-v1` capability; unsupported clients reject it. Installing policy
does not install Git or an enforcement integration.

## Profiles

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed inspection and dry-run forms | Allow | Allow | Allow |
| Listed `add` / `stage` forms | Allow | Allow | Ask |
| Listed commits, ref creation, checkout/switch, merges, and other local changes | Allow | Ask | Ask |
| Remote access, fetch/pull/push, submodule updates | Ask | Ask | Deny |
| Destructive operations, history rewriting, sensitive helpers | Ask | Deny | Deny |
| Unclassified commands or unlisted options | Ask | Ask | Ask |

Known dangerous command families retain their restrictive baseline even when
options are unlisted. Profiles become progressively restrictive. Project custom
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

Recommended allows `git add -A`, asks before `git commit -m ...`,
`git switch -c feature` and `git push origin main`, and denies `git reset --hard`,
`git clean -fdx`, force/deleting pushes, branch/tag deletion, commit amendment or
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

The 936 fixtures cover each command's baseline in all three profiles and common
workflows, option ordering, clusters, unknown options, missing values, separators,
global overrides and forced refspecs. The Rust Shield evaluator checks the actual
pack; the registry does not implement a second permission engine.

Coverage is based on Git's [command inventory](https://github.com/git/git/blob/v2.56.0/command-list.txt)
and [official manuals](https://git-scm.com/docs/git), including
[push refspecs and force options](https://git-scm.com/docs/git-push) and
[clean's dry-run behavior](https://git-scm.com/docs/git-clean).
Rule changes require a new release with reviewed fixtures. Licensed under MIT.
