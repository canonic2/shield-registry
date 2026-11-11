# GitHub permission pack

Version 0.5.0 requires Shield `>=0.22.0, <1.0.0` with `graphql-v1` and
`variable-prefixes-v1` support.
Installing a pack supplies permissions, not the GitHub CLI or MCP server.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed CLI/MCP reads and supported inline GraphQL queries | Allow | Allow | Allow |
| Listed issue/PR creation, comments, edits, closing and branch creation | Allow | Allow | Ask |
| Merges, remote file publication, credential changes and administration | Allow | Ask | Ask |
| Destructive changes | Ask | Ask | Deny |
| Explicit token disclosure | Deny | Deny | Deny |
| Unlisted commands, tools, methods and unsupported API requests | Ask | Ask | Ask |

## Inline GraphQL reads

Supported query operations can run without an exact-command exception:

```sh
gh api graphql -f query='query {
  repository(owner:"acme", name:"web") {
    pullRequest(number:12) {
      reviewThreads(first:100) {
        nodes { id isResolved path comments(first:100) { nodes { body author { login } } } }
      }
    }
  }
}'
```

Shield parses the entire document and selects the operation identified by
`operationName`, or its sole operation when no name is supplied. Scalar variables,
defaults, aliases, named fragments and inline fragments are supported. Mutations
do not inherit query permissions. `--paginate` is supported when `$endCursor` is
a nullable String used only in approved cursor arguments.

For example, this keeps the repository fixed while the CLI fetches issue pages:

```sh
gh api graphql --paginate -f query='query($endCursor: String) {
  repository(owner:"acme", name:"web") {
    issues(first:100, after:$endCursor) {
      pageInfo { hasNextPage endCursor }
      nodes { number title }
    }
  }
}'
```

Use `-F number=12` for an integer variable declared as `$number: Int!` and
`-f owner=acme` for a string variable. `-f number=12` remains a string and cannot
satisfy an Int declaration. When the document has multiple operations, supply
`-f operationName=NAME` to select one. Only the selected query receives the read
permission; an unselected mutation does not run.

Inline `-f`/`--raw-field` and scalar `-F`/`--field` values are supported. File/stdin
payloads, typed placeholders, object/list inputs, custom headers, alternate hosts,
embedded `--jq`/template expressions and unknown options require review when
unscoped. Shield does not read those inputs to guess their contents.

## Optional repository boundary

Set `repository: acme/web` to restrict the pack to that nominal OWNER/REPO; omit
the setting for no repository restriction. Listed ordinary CLI commands require
`-R`/`--repo`.

Under this setting, `gh api` accepts two read forms for the configured
repository, allowed in every profile:

- Inline GraphQL query reads rooted at it. Shield verifies their actual
  selections, including every sibling field and fragment, against the configured
  owner/name; they do not need a repo flag.
- Plain REST GETs of one literal path under `repos/OWNER/REPO/`, with only
  `--paginate`, `--slurp`, `-i`/`--include`, `--silent`, `--verbose` and
  `-X`/`--method GET`:

```sh
gh api repos/acme/web/pulls/12/comments --paginate
```

Every other `gh api` request is denied with a message naming the accepted forms:
other repositories, the bare `repos/acme/web` path, a leading `/`, full URLs,
fields (`-f`/`-F`, which also switch to POST), other methods, `--input`, headers,
other hosts, mutations and `--jq`/template expressions, which can print
environment values. A REST path under the repository that contains `..`, percent
escapes, `{owner}`/`{repo}`/`{branch}` placeholders, backslashes or spaces is
denied with a message asking for the literal path. A GraphQL query that is
rooted elsewhere or selects an unlisted field is denied with a message naming
the reviewed model.

REST reads cover any GET endpoint under the repository path, such as contents,
workflow runs and forks, which is broader than the GraphQL model below.

From an initialized project with this compatible pack installed, find the
selection with `shield pack list`, then configure it:

```sh
shield pack show PACK_SELECTOR
shield pack configure PACK_SELECTOR --set repository=acme/web
```

Replace `PACK_SELECTOR` with the displayed installed selector and review and
confirm the setting. Inspect the retained version too: configuring GitHub 0.3.0
does not add GraphQL rules.

The scoped GraphQL model covers repository metadata, PRs, issues, reviews, threads,
comments, paging, related author logins and commit OIDs. Review threads include
their path, line, start line and original line positions; review comments
include their diff hunk, path and line positions. It does not grant access to
another repository, a fork parent/head repository, an author's other
repositories, search or opaque root node IDs. Unknown fields and traversals,
unverified targets and unsupported API forms deny in every profile while this
setting is active. Output filtering cannot narrow the server request's scope.
This checks submitted target names and reviewed related metadata, not immutable
server identity after a repository rename/transfer or the command's actual network
destination. Default-host and executable assumptions follow the ordinary CLI pack
boundary. Explicit host selection is limited to `github.com`.

Official MCP integrations remain `hosted`, `local` and `local-read-only`, with
the same existing tool/method profiles. Ask follows the host's configured approval
or fallback behavior; it does not guarantee a displayed prompt. Other policy and
host restrictions remain effective.

## Maintenance

Generate with `node scripts/build-github-graphql-pack.mjs` and
`node scripts/build-github-graphql-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/github-graphql-pack.test.mjs`.
Fixtures cover the full PR-review query with diff positions, profiles, existing
CLI/MCP behavior, scope escapes, scoped REST reads and their path, method,
option and host escapes, other non-GraphQL API forms,
operations, variables, fragments, pagination and unsupported input, both
standalone and composed with Baseline 0.11.1.
