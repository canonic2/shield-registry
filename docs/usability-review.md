# Baseline and Git usability review

Reviewed 2026-10-18 for Baseline 0.3.0 and Git 0.6.0 with Shield 0.1.8.

The default policy should let agents perform ordinary developer work while
protecting credentials, policy authority, work that can be discarded, and remote
systems. Ordinary tool/repository configuration is trusted. The existence of a
powerful option elsewhere in a tool does not make its simple read forms unsafe.
Submitted helper, output, force and discard options remain meaningful boundaries.

## Baseline dispositions

| Family | Decision |
| --- | --- |
| Constants, paths, versions, formatting, ordinary listing/counts | Keep existing allows; add formatted date and filesystem-space inspection |
| Ripgrep, grep, find | Keep normal read/list forms and optional ripgrep `--no-config`; preserve protected reads, explicit helpers and unverified traversal boundaries |
| Sed, awk, jq | Add fixed print/selection forms on stdin and approved regular files; review arbitrary programs, environment expressions and extra input loading |
| Sort, uniq, cut, diff, cmp | Add read-only file forms; keep output files, recursive diff and unlisted options in review |
| Local create/copy/move/remove and typed file operations | Keep approved-root decisions and access-root/metadata protection; Strict reviews writes |
| Recursive copying and unresolved mutation targets | Keep blocked until the core can model containment, including existing destination symlinks; do not silently permit them as reads |
| Builds, project scripts, interpreters, dependency installation | Keep review: these explicitly execute project/package code |
| Network, remote copies, GitHub, containers/cloud and permissions | Keep review; explicit destructive cloud/container operations retain denial |
| Privilege escalation, device/filesystem administration | Keep denial |

The new fixed read models live in Rust, shared across agents. Native sed/awk and
text-filter classification uses that same program/option proof. An edit/output
form does not gain protected-policy-file write access by being labeled a reader.
Regular-file inputs still receive canonical containment and credential exclusions.
No new broad interpreter or command-family allow was introduced.

## Baseline 0.5.0 dispositions

Reviewed 2026-10-21 with Shield 0.1.16. Allow rules exist so routine work does
not stop for approval; deny rules are the protection. A command that cannot harm
with any arguments allows; a harmful form is denied rather than asked.

| Family | Decision |
| --- | --- |
| Lookups printing names, identities or path facts (`test`, `[`, `type`, `which`, `whoami`, `id`, `hostname` reads, `realpath`, `readlink`, `lsof`, `expr`, `seq`) | Allow in every profile |
| Metadata and listings (`du`, `stat`, `file`, `tree`) | Allow listed options; output files, file lists, decompression and magic files keep review |
| Text tools without path models (`nl`, `column`, `paste`, `bc`) | Allow on standard input; file operands keep review until Shield checks their paths |
| Builds, checks, tests and formatting (cargo, go, make, npm/pnpm/yarn scripts, tsc, eslint, prettier, vitest, jest, pytest, ruff) | Allow in Loose/Recommended, Strict reviews. They run project code the agent can already edit; directory options must stay relative without `..` |
| Installs, publishing, `npx`/`exec`/`dlx`, `uv run`, global tool options | Keep review: they download or run code outside the project build |
| Environment dumps (`printenv`, bare `env`), keychain secret reads, `gh auth token`, hostname changes | Deny in every profile |
| Interpreters, `xargs`, `/usr/bin/time`, `ulimit`, `command -v` | Unchanged: Shield's shell analysis asks or returns them for rewriting before pack rules apply |
| `chmod`, `chown`, `ln`, `tee`, pagers, `open` | Keep review until Shield models their targets; `open` launches outside the project |

The shell keyword `time` already takes the decision of its command.

## Baseline 0.6.0 dispositions

Reviewed 2026-10-22 with Shield 0.2.0, which models the paths these commands
touch and lets builtin queries reach policy.

| Family | Decision |
| --- | --- |
| `nl`, `comm`, `paste`, `column`, `less`, `more` with files | Allow within the read roots; credential folders and outside paths deny; pager options that write files ask |
| `tee FILE`, `ln`, `chmod`, `chown` | Allow in Loose/Recommended, Strict reviews, within the write roots outside `.git` and Shield state; outside paths deny. A hard link's source must pass the read rules, because the link shares its contents |
| `command -v`/`-V`, `ulimit` queries | Allow; setting a limit and running a command through `command` keep review |
| `xargs`, `/usr/bin/time`, interpreters | Unchanged: Shield cannot check what `xargs` appends, and interpreters run programs it cannot inspect |

## Git dispositions

| Family | Decision |
| --- | --- |
| Inspection | Keep existing allows; add numeric history counts, optional short untracked flag, verbose branch listing and default reflog |
| Staging and ordinary local changes | Keep Loose/Recommended allow and Strict review; add default stash and explicit current-directory init |
| Branch deletion | Allow Git's checked `-d`; keep force/deleting overrides protected |
| Commit amendment | Review separately from hook bypass; bypass remains protected |
| Rebase | Review starting a rewrite (Strict denies); allow existing transaction continue/abort/quit in Loose/Recommended, Strict reviews |
| Garbage collection | Allow normal/automatic housekeeping in Loose/Recommended, Strict reviews; explicit prune overrides remain protected |
| Worktree discard, force reset/push/ref deletion, clean, credential helpers | Keep existing restrictions |
| Remote access/publication, explicit external tools/strategies | Keep review (Strict denies known execution/remote families) |
| Arbitrary Git global overrides, aliases and executable spellings | Keep review where the compact invocation is unmodeled; no inference of safety from the command's name |

Git's own checks and repository configuration are trusted, as for ordinary commit
and merge hooks. This policy is not a replacement for Git's transaction checks or
OS containment. Existing Codex missing-workdir limits are independent of pack
decisions; only actual workdir or the existing explicit-location proof enables
prompt-free approval. Embedded revision tildes such as `HEAD~3` are literal shell
characters; leading/home and assignment tildes retain their expansion handling.

## Evidence

Baseline retains all 387 prior cases, with three explicit cut-file expectation
changes, and adds 126 independent cases. Git runs all 1,023 prior cases with seven
explicit expectation changes plus 117 new cases. Native composition tests cover
261 requests, including protected state, credential/symlink escape, program effects,
force operations and PermissionRequest context. A real Git fixture proves refusal
to delete an unmerged branch and successful checked deletion after merging.
Historical signed pack bytes and fixture expectations are unchanged.
