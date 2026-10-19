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
