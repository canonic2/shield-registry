# Git permissions 0.8.0

Requires Shield `>=0.20.0, <1.0.0`.

Git operations use review for legitimate privileged work. Command grammars,
directory selection and inspection coverage follow [0.7.0](../0.7.0/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed inspection | Allow | Allow | Allow |
| Listed staging and routine local edits | Allow | Allow | Ask |
| Fetch, push, rebase, external viewers and maintenance | Allow | Ask | Ask |
| Destructive discard, forced deletion or remote history replacement | Ask | Ask | Deny |
| Credential `fill` or credential-store/cache `get` | Deny | Deny | Deny |
| Amendments, conservative configuration/risk scans, unclassified commands and options | Ask | Ask | Ask |

A clean `worktree remove` and ordinary submodule deinitialization are reviewed
like other privileged work; adding force retains the destructive decision.
Credential administration remains reviewable without allowing credential output.
Ref/index administration and replacement refs are reviewable; explicit ref
deletion, forced index checkout, read-tree resets and reflog expiration retain
their destructive decision.
Supported remote and helper commands can execute configured code. Allow is
permission to submit the command, not containment of that execution.

Ask follows the host's approval or configured fallback. Other packs, project
policy and Shield's protected administration checks still apply.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
