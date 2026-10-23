# Git permissions 0.6.2

Usable Git inspection and local workflows with review of external impact and
protection against explicit destructive overrides. Requires Shield 0.2.0 or later
within the 0.2 series. The source stores 126 shared bodies, the same 173 command
names and one invocation group, with bare, `--no-pager` and `-P` forms.

## Everyday workflows

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Known inspection forms, including `log -17`, `status -u`, `branch -vv`, plain `reflog` | Allow | Allow | Allow |
| Staging, commits, branch creation, default stash | Allow | Allow | Ask |
| `branch -d`, ordinary `gc`, `gc --auto`, initializing `.` | Allow | Allow | Ask |
| Rebase `--continue`, `--abort`, `--quit` | Allow | Allow | Ask |
| Commit amendment | Ask | Ask | Ask |
| Starting a rebase or remote operations | Ask | Ask | Deny |
| Force push/deletion, hard reset, hook bypass, worktree discard and explicit immediate pruning | Ask | Deny | Deny |

History reads accept numeric count shorthand before or after familiar read-only
flags; file-output and explicit helper options retain review. Reflog inspection
does not grant expiry or deletion. `branch -d` relies on Git's merged-history
check; `-D` and other force overrides retain their restrictions.

Git's ordinary repository configuration, hooks and safeguards are trusted.
Default garbage collection can expire old unreachable objects using Git's normal
configuration. Explicit pruning overrides remain protected. Continuing or ending
a rebase applies to Git's existing transaction; starting or scripting a rewrite
needs review. Commit amendment is separate from skipping hooks.

The [0.4.1 command guide](../0.4.1/README.md) describes the remaining option
vocabulary. [The usability review](https://github.com/canonic2/shield-registry/blob/main/docs/usability-review.md) records
the current decisions and limits. Unknown flags, aliases, global overrides and
executable spellings outside the supported invocation still need review.
Codex PermissionRequest uses explicit workdir when supplied and otherwise the
reported cwd. Missing workdir or tool IDs do not add an approval requirement.
Policy Allow approves, Ask keeps the host prompt and Deny blocks. Pack permissions do not
establish execution containment.

## Validation

117 new independent decision fixtures cover ordinary workflows and protected
neighbors. All 1,023 historical Git cases also run against this policy with seven
explicit reviewed expectation changes. Separate fixture documents preserve the
core's 1,024-case admission bound. A real owned Git repository verifies shorthand,
unmerged-branch refusal, merged deletion, reflog and housekeeping. The combined
pack suite verifies 261 fresh native requests across both agents and all profiles.
`node scripts/build-git-shield-02.mjs` reproduces this release from 0.6.1, whose rules
and fixtures it keeps unchanged, for Shield 0.2. Licensed under MIT.
