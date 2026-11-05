# GitHub permission pack

Version 0.1.0 covers `gh` and the official GitHub MCP server with Shield
0.18.0 or later. Installing the
pack supplies permissions; install and authenticate GitHub CLI or the MCP server
separately.

## Profiles and coverage

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact local help/version forms | Allow | Allow | Allow |
| Listed metadata, content and log reads | Allow | Allow | Ask |
| Listed issue/PR comments, creation, editing and file/branch changes | Ask | Ask | Deny |
| Merges, deletion, credentials and administration | Ask | Deny | Deny |
| Other commands, tools or methods | Ask | Ask | Deny |

CLI read coverage includes repo view, issue/PR list and numeric view, PR
view/diff/checks for a number or the current branch, workflow/run list, numeric
run view including logs, release list, project view/list/item-list/field-list,
and `gh auth status` without `--show-token`. The policy uses closed option lists;
an unlisted option keeps review. Only `gh --version`, `gh --help` and `gh help`
are unconditional local allowances.

The rules match `gh` found on `PATH` and the standard install locations
`/usr/bin`, `/usr/local/bin`, `/opt/homebrew/bin`, `/opt/local/bin`,
`/home/linuxbrew/.linuxbrew/bin` and `/snap/bin`. Other paths, such as a copy
under a home folder, are not this pack's requests and fall back to Ask.

`--jq` and `-q` expressions require review (Ask in Loose/Recommended, Deny in
Strict), including simple filters: GitHub CLI's embedded jq can read environment
variables through `env` and `$ENV`. Plain JSON output retains the listed read
decision. Scoped packs deny jq expressions as unlisted syntax.

Listed writes include issue/PR create, comment, edit, close and reopen, PR merge,
and issue delete. Raw `gh api` requests keep review.

These commands are privileged in every form:

- merging or closing a PR with `-d`/`--delete-branch`, and deleting issues;
- repository delete, edit, archive, unarchive and rename; deploy-key and
  autolink add/create and delete;
- release, release asset, run, label, cache, project, gist and codespace deletion;
- `variable set`/`delete`, `secret`, `ssh-key`, `gpg-key` and `auth` (except
  `auth status` above);
- `extension`, `alias` and `config set`, which can run local commands.

Other unlisted forms, such as `gh workflow run` or `gh pr review`, retain the
unlisted decision. PR merge, PR close with branch deletion and issue deletion
retain their privileged decision for branch/URL selectors, omitted merge
selectors, shorthand flags and unlisted options. Scoped packs admit only the
listed numeric forms and options through their scope checks.
Repository options before, between or after command words retain the operation's
classification, including separate, equals and attached `-R`/`--repo` forms.

MCP coverage includes repository files, branches, commits, tags, releases,
issues, PRs and selected project reads; selected comments, file/branch changes,
PR creation, merging and deletion have explicit write decisions. Multi-method
read tools allow only the methods listed in the policy. `projects_write` is
privileged, including unknown methods. Unknown tools never inherit read access.

## Optional scope

Scopes are generated from a JSON file, rather than configured through Shield's
installation questions. Copy [scope.example.json](scope.example.json) and edit it:

```json
{
  "organizations": ["acme"],
  "repositories": ["acme/web", "acme/api"],
  "projects": [{"owner": "acme", "number": 7}]
}
```

Each supplied list accepts 1–16 entries. Omit a key to leave that dimension
unset; empty lists and unknown keys refuse. Names are literal and case sensitive;
a repository name needs at least one character other than `.`.
`organizations` matches owner logins, which may identify an organization or a
user; the pack does not look up account types.

- An organization list alone permits listed operations on repositories and
  projects owned by those accounts.
- A repository list restricts repository operations to those exact owner/name
  pairs. A project list restricts project operations to exact owner/number pairs.
- Explicit repository/project lists narrow an organization list. Entries outside
  the named organizations refuse generation.
- Without an organization list, specifying only repositories denies project
  operations, and specifying only projects denies repository operations. Project
  membership does not authorize operations on an item's underlying repository.
- `{}` generates the unscoped policy under a separate local identity.

Scoped CLI repository commands require `-R OWNER/REPO` or `--repo OWNER/REPO`,
including attached/equals forms and repo options before or between command words. Every repeated target
must satisfy the scope. Repo inference, URL operands, host-qualified repo names,
`--search`, raw API calls, extensions and unlisted syntax are denied. Project
commands require an explicit `--owner`; an explicit project list also requires
its number, so listing all projects is denied.

Scoped MCP requests require an explicit matching `owner` and `repo`, or matching
`owner` and numeric `project_number`. Unknown tools/methods and searches are
denied. Project writes and reads through opaque item/field IDs are denied because
the request does not establish their ownership. The project-list tool can list
fields/items/views/status updates for an allowed project; listing all projects
requires an organization scope without an explicit project list.

These checks identify the primary operation target, not every linked object or
data value in the result. A permitted project can contain issues from another
repo; a PR can reference a fork. Scopes do not inspect local input-file contents,
verify account types, attest executable identity, or constrain a CLI's ambient
host/credentials. Keep the connector host and credential permissions under
operator control. The scopes apply only to `gh` and MCP connections explicitly
bound to this pack, not to arbitrary network clients.

## Generate and use a local scoped pack

From this registry checkout, generate a separate pack and local catalog:

```sh
node scripts/build-github-pack.mjs --scope /path/to/github-scope.json --id acme/github --output /path/to/github-registry
```

The output contains `pack.yml`, `commands.json`, `LICENSE` and a `catalog.json`
with the policy's SHA-256 digest. Review the generated policy. In an initialized
Shield project, register and install it:

```sh
shield registry add github-local /path/to/github-registry
shield pack add github-local/acme/github --profile recommended
```

Shield asks for confirmation of source enrollment and permission activation.
When changing the scope, pass a new version, for example `--pack-version 0.1.1`,
regenerate the same local catalog, then review `shield pack update` in the project.
Installed versions retain their verified bytes; editing a generated file does
not update active permissions. Published pack versions are immutable.

## MCP connections

The `hosted` integration matches exactly:

```json
{"type":"http","url":"https://api.githubcopilot.com/mcp/"}
```

The `local` integration matches `github-mcp-server stdio`, and `local-read-only`
matches `github-mcp-server stdio --read-only`. Both accept the executable on
`PATH` or under `/usr/bin`, `/usr/local/bin` or `/opt/homebrew/bin`, and require
exactly that argument list. A `go install` build under a home folder, Docker
wrappers, alternate endpoints, enterprise hosts, other server arguments such as
`--toolsets`, and legacy GitHub MCP servers require a separately reviewed
integration. Authentication stays in the project's reviewed connector settings;
no token is embedded in this pack. Bind the connection to this pack and its
`hosted`, `local` or `local-read-only` integration through Shield's MCP
connection workflow.

## Authoring and verification

```sh
node scripts/build-github-pack.mjs
node scripts/build-github-cases.mjs
npm test -- --shield /absolute/path/to/shield scripts/github-pack.test.mjs
```

Tests cover profile decisions, every MCP integration, owner/repo and owner/project
pair separation, missing and repeated targets, numeric types, URL and query
overrides, unknown options/tools/methods, scope bounds, generated catalog digests,
compound shell requests and Baseline composition. They evaluate policy without
executing GitHub commands or accessing an account. Live GitHub acceptance and
publication are separate work.

Regressions also cover jq environment access, repo-option placement on
privileged commands, administration and credential commands, branch deletion
on close and alternate install paths, alone and composed with Baseline.

Reviewed upstream references: [GitHub CLI manual](https://cli.github.com/manual/gh_help_reference),
[GitHub MCP server](https://github.com/github/github-mcp-server) and its
[server configuration](https://github.com/github/github-mcp-server/blob/main/docs/server-configuration.md).
