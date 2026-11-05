# GitHub permission pack

Version 0.2.0 covers GitHub CLI and the official GitHub MCP server. It requires
Shield with `variable-parts-v1` support. Install and authenticate GitHub CLI or
the MCP server separately; the pack supplies permissions.

## Install with optional repository scope

The `repository` setting is an optional, exact `OWNER/REPO` name. With it omitted,
there is no repository restriction; the selected profile still decides each
operation. No repository is inferred from the current folder or credentials.

Inspect `pack_info` with `view: "settings"`, then ask for this setting during
normal MCP installation:

```json
{"reference":"canonic/github@0.2.0","profile":"recommended","variables":["repository"]}
```

Enter a name such as `acme/web` in the settings form. Submission prepares an
inactive proposal. Review it and submit the returned `apply_arguments` unchanged
to `policy_apply` for final approval. To install without a restriction, omit
`variables`. The `local` layer controls where settings are stored; it does not
restrict remote targets.

The operator CLI asks whether to set the optional repository:

```sh
shield pack add canonic/github@0.2.0 --profile recommended
```

After installation, change the scope with `shield pack configure canonic/github
--set repository=acme/api`, or remove it with `--unset repository`; both need
review and confirmation. MCP agents can use `pack_configure` to collect a new
value, or propose a reviewed unset through `policy_propose`.

## Scope and profiles

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Local help/version | Allow | Allow | Allow |
| Listed metadata, content and log reads | Allow | Allow | Ask |
| Listed ordinary changes | Ask | Ask | Deny |
| Merges, deletion, credentials and administration | Ask | Deny | Deny |
| Other commands, tools or methods | Ask | Ask | Deny |

When `repository` is set, scope checks run in addition to these decisions:

- CLI repository operations require explicit `-R OWNER/REPO` or `--repo
  OWNER/REPO`, including attached/equals forms and options before or between
  command words. Every repeated repository option must match.
- MCP requests require matching string `owner` and `repo` fields on a connection
  bound to this pack. Unknown targets, tools and methods deny.
- Inferred targets, URL operands, host-qualified names, search overrides, raw
  API calls, extensions and unlisted syntax deny. Project operations deny:
  repository scope does not establish project ownership or item membership.
- Local help/version and the listed token-free `gh auth status` forms remain
  available. Matching repository writes still ask or deny according to profile.

Names are literal and case sensitive. Wildcards, URLs, empty names and `.`/`..`
repository names are invalid. The setting restricts one repository; generated
organization, multiple-repository and project variants use the separate
[scope-generator workflow](../0.1.0/README.md#optional-scope).

The checks identify the primary target. They do not inspect input-file contents,
constrain ambient hosts/credentials, or authorize linked repositories, arbitrary
network clients or unbound MCP connections. Keep those permissions separately
reviewed. The operation inventory and supported executable/integration forms
are described in the [GitHub coverage guide](../0.1.0/README.md#profiles-and-coverage).

## Maintainer checks

```sh
node scripts/build-github-configurable-pack.mjs
node scripts/build-github-configurable-cases.mjs
npm test -- --shield /absolute/path/to/shield scripts/github-configurable-pack.test.mjs
```

The fixtures exercise unset and bound scope across profiles and MCP integrations,
including missing, repeated, crossed and outside targets. The source candidate
requires normal signed publication before registry discovery can select it.
