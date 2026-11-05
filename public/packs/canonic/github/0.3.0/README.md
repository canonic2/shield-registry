# GitHub permission pack

Version 0.3.0 covers `gh` and the official GitHub MCP server with Shield
`>=0.20.0, <1.0.0` and `variable-parts-v1` support. Installing the pack supplies
permissions, not the tools.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed reads, local help and version | Allow | Allow | Allow |
| Listed issue/PR creation, comments, edits, closing and branch creation | Allow | Allow | Ask |
| Merges, remote file publication, credential changes and administration | Allow | Ask | Ask |
| Deleting repositories, issues, releases, runs, projects, gists, codespaces, or closing with branch deletion | Ask | Ask | Deny |
| Explicit token disclosure (`auth token`, `auth status --show-token`) | Deny | Deny | Deny |
| Unlisted commands, options, tools, methods and raw API requests | Ask | Ask | Ask |

Merging a PR is a privileged operation requiring review in Recommended and
Strict. An administrator merge and merged-branch cleanup use that same review
decision. Deleting a tracked file through MCP is reviewed like other versioned
file publication. Closing without merging and deleting the branch retains the
destructive decision. Unknown merge options
and alternate selectors retain the merge decision; repository restrictions
still require a supported numeric selector and listed options.

An optional `repository` setting restricts CLI and MCP requests to one exact
`OWNER/REPO`. Omit it for no repository restriction. When set, CLI calls must
use `-R`/`--repo`; requests outside that target, targets that cannot be verified,
unlisted syntax and project operations deny in every profile. Scope checks
apply before the profile decisions above. For example:

```sh
gh pr merge 12 -R acme/web --squash
```

The CLI matches `gh` on PATH and standard installation paths. MCP connections
use the `hosted`, `local` or `local-read-only` integration with the same profile
decisions. A read-only server may independently refuse writes.

Ask follows the agent host's approval flow or configured fallback; it does not
guarantee a displayed prompt. Allow still respects Shield's protected paths,
other active policy and the host sandbox. Token disclosure stays denied because
it exposes credentials in agent-visible output. Unlisted expressions, including
embedded jq, require review rather than inheriting read access.

Generate source artifacts with `node scripts/build-github-usable-pack.mjs` and
`node scripts/build-github-usable-cases.mjs`. Validate this version with
`npm test -- --shield /absolute/path/to/shield scripts/github-usable-pack.test.mjs`.
Fixtures evaluate CLI forms, all three MCP integrations, profile differences,
destructive variants, explicit token exposure and exact repository boundaries.
