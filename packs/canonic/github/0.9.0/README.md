# GitHub permission pack

Version 0.9.0 requires Shield `>=0.47.0, <1.0.0` with `graphql-v1`,
`graphql-mutations-v1`, `graphql-subtree-v1`, `variable-prefixes-v1` and
`variable-list-branches-v1` support.
Installing a pack supplies permissions, not the GitHub CLI or MCP server.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed CLI/MCP reads and supported inline GraphQL queries | Allow | Allow | Allow |
| Other `issue`, `pr`, `run`, `workflow`, `release` and `repo` `list`, `view`, `diff` and `checks` requests | Allow | Allow | Ask |
| Those reads with a `--jq`/`--template` expression naming `env`, `$ENV`, `include` or `import` | Ask | Ask | Ask |
| Listed issue/PR creation, comments, edits, closing and branch creation, and listed comment and review-thread mutations | Allow | Allow | Ask |
| Merges, remote file publication, credential changes and administration, and listed merge mutations | Allow | Ask | Ask |
| Destructive changes, including listed comment-deletion mutations | Ask | Ask | Deny |
| Explicit token disclosure | Deny | Deny | Deny |
| Unlisted commands, tools, methods, mutations and unsupported API requests | Ask | Ask | Ask |

## Read options

Read commands accept options this pack does not list, such as
`gh pr view 12 --web` or `gh pr checks 12 --watch`, and `--jq`/`--template`
expressions over the response, such as `--jq .url`. gh's jq reaches beyond the
response only through `env` and `$ENV`, so an expression naming them, or
`include`/`import`, asks in every profile, in any spelling including short
clusters such as `-qenv`. A leading `-R`, as in `gh -R acme/web pr view 12`, keeps the listed options only.
Strict allows only the listed forms.

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
`-f operationName=NAME` to select one. Only the selected operation receives a
permission; an unselected operation does not run.

Inline `-f`/`--raw-field` and scalar `-F`/`--field` values are supported. File/stdin
payloads, typed placeholders, list inputs, custom headers, alternate hosts,
embedded `--jq`/template expressions and unknown options require review when
unscoped. Shield does not read those inputs to guess their contents.

## GraphQL mutations

These mutations are reviewed. Each takes the profile row of its CLI equivalent:

| Class | Mutations |
| --- | --- |
| Comments and edits | `resolveReviewThread`, `unresolveReviewThread`, `addPullRequestReviewThreadReply`, `addComment`, `updateIssueComment`, `updatePullRequestReviewComment` |
| Merges | `mergePullRequest`, `enablePullRequestAutoMerge`, `disablePullRequestAutoMerge` |
| Destructive | `deleteIssueComment`, `deletePullRequestReviewComment` |

For example, this resolves two review threads in one request:

```sh
gh api graphql -f query='mutation {
  a: resolveReviewThread(input:{threadId:"PRRT_a"}) { thread { id isResolved } }
  b: resolveReviewThread(input:{threadId:"PRRT_b"}) { thread { id isResolved } }
}'
```

The `input:{...}` object may contain only that mutation's reviewed fields, as
literals or scalar variables such as `threadId:$id` with `-f id=PRRT_a`. Each
mutation may return only its changed object's own fields, such as a thread's
`id` and `isResolved` or a comment's `id`, `url` and `body`. A request that calls
several mutations takes the strictest class among them. Mutations under fragments
or `@skip`/`@include` count; aliases do not rename them.

A request calling any unlisted mutation, an undeclared input field, a repeated
input key, a list or object-typed variable, a response field that reaches a
repository, owner or other object, or `--paginate` is not a listed mutation.

Mutations name their targets by opaque node IDs. Shield does not look these up,
so it cannot tell which repository a mutation changes.

## Optional repository boundary

Set `repository` to one or more nominal OWNER/REPO values to restrict the pack
to them, such as a fork and its upstream:
`repository: [acme/web, example/web-fork]`. It lists at most 8 repositories.
Omit the setting for no repository restriction. A single value written as a
string, as earlier releases configured it, is a one-item list, so an existing
setting keeps its meaning after an update.

Every request must name one listed repository as a whole. The owner of one
listed repository with the name of another, such as `acme/web-fork` above, is
not listed and is refused in every form: `-R`, REST paths, GraphQL roots and
MCP `owner`/`repo` arguments. Ordinary CLI commands require `-R`/`--repo` naming
a listed repository. A missing `-R` is refused, because gh would choose the
repository from the local checkout; another value is refused with a message
pointing to the repository setting.

Under this setting:

- `issue`, `pr` and `run` commands that start with the command words, such as
  `gh pr view fix-tags --web -R acme/web`, are checked by target rather than by
  option. Options this pack does not list pass the boundary and take the
  decisions above: reads allow and other requests ask. Selectors are a PR or
  issue number, `#12` or a branch name. A URL, `OTHER/REPO#12` or `owner:branch`
  names another target and is refused, wherever it appears in the request.
- `issue`, `pr`, `run`, `workflow` and `release` `list` commands accept
  `--search`/`-S` with plain terms only. A qualifier such as `repo:`, `org:` or
  `-repo:`, the words `OR`, `AND` and `NOT` in any case, parentheses and quotes
  are refused, because GitHub search applies them across the query. A list
  request with an unlisted option applies the same check to every value, so
  `--label type:bug` passes with listed options only.
- Other commands, and forms with a leading `-R` such as
  `gh -R acme/web pr view 12`, take the listed options only.

`gh api` accepts these forms for a listed repository:

- Inline GraphQL query reads rooted at it, allowed in every profile. Every root,
  including aliases, fragments and conditional selections, must name the same
  listed owner/name; they do not need a repo flag. A query whose roots name two
  different listed repositories is refused; send one query per repository. All nested selections
  beneath matching roots are allowed without a GitHub field inventory. This
  includes related owners, authors, fork parents and other repositories reached
  through those nested selections. The boundary checks where a query starts,
  not which repositories' data it can return.
- Plain REST GETs of one literal path under `repos/OWNER/REPO/`, with only
  `--paginate`, `--slurp`, `-i`/`--include`, `--silent`, `--verbose`,
  `-X`/`--method GET`, `--hostname github.com` and `--jq`/`--template`
  expressions that do not name `env`, `$ENV`, `include` or `import`, allowed in
  every profile:

```sh
gh api repos/acme/web/pulls/12/comments --paginate
gh api --hostname github.com --paginate repos/acme/web/pulls/12/reviews
gh api repos/acme/web/actions/runs/123 --jq '.head_sha,.event,.run_attempt'
```

- Listed GraphQL mutations. Their targets cannot be verified, so by default each
  asks in every profile, and a destructive mutation still denies in Strict.
  Set `repository_writes: profile` to give them their profile decisions instead.
  Mutation writes are then not confined to the listed repositories. Query
  roots still require a listed owner/name, while their nested reads are unrestricted.
  `repository_writes: ask` is the same as leaving it unset.

- Other REST requests to one literal path under `repos/OWNER/REPO/`, with the
  documented API options, ask in every profile. This includes writes using
  `--method`, fields, file/stdin bodies, custom headers, caching, previews and
  output expressions that read environment values. These options pass the
  repository boundary but do not establish a read-only effect. Shield does not
  inspect payload files or freeze their contents. For example:

```sh
gh api repos/acme/web/pulls/12/reviews --method POST --input /tmp/acme-review.json --jq '{url: .html_url, state: .state}'
```

The request above asks for approval; it does not need an exact-command rule.
`github.com` is gh's default host and the only one accepted, so an explicit
`--hostname github.com` leaves each request's decision unchanged: reads allow and
other requests ask. Another hostname, including a differently capitalized
spelling, is denied. The option parser separates values from the endpoint
regardless of their ordering, including `--input=body.json` and `-XPOST`.
Unknown options or malformed option arguments cannot establish scope and deny.

Unlisted repositories, the bare `repos/acme/web` path, a leading `/`, full URLs,
unresolved endpoints and unlisted GraphQL mutations are denied with a message
naming the accepted forms. A REST path under `repos/` that contains `..`, percent
escapes, `{owner}`/`{repo}`/`{branch}` placeholders, backslashes or spaces is
denied with a message asking for the literal path. A GraphQL query that is
rooted elsewhere is denied with a message naming the required repository roots.
Refusal messages point to the repository setting rather than printing every
listed value.

REST reads cover any GET endpoint under the repository path, such as contents,
workflow runs and forks.

From an initialized project with this compatible pack installed, find the
selection with `shield pack list`, then configure it:

```sh
shield pack show PACK_SELECTOR
shield pack configure PACK_SELECTOR --set repository=acme/web,example/web-fork
```

Replace `PACK_SELECTOR` with the displayed installed selector and review and
confirm the setting. Separate repositories with commas, or pass a JSON array
such as `'["acme/web","example/web-fork"]'`; add `--local` to keep a
developer's own fork out of the shared project configuration. Add `--set repository_writes=profile` the same way to opt
into profile decisions for listed mutations. Inspect the retained version too:
configuring GitHub 0.3.0 does not add GraphQL rules.

The GraphQL boundary is root-only. New nested fields, review-comment `outdated`,
diff positions, paging and arbitrary related-object reads pass without pack
updates. A second root naming another repository, listed or not, root search,
`viewer` and opaque root node IDs are denied. Shield validates supported document structure,
variables and fragments, with bounded analysis; GitHub owns full schema validation.
Nested object argument literals are supported within the input-depth bound;
list inputs and object-valued variables remain unsupported. Unverified root
targets and unsupported GraphQL forms deny in every profile while this setting
is active. Output filtering cannot narrow the server request's scope.
This checks submitted root target names, not immutable
server identity after a repository rename/transfer or the command's actual network
destination. Default-host and executable assumptions follow the ordinary CLI pack
boundary. Explicit host selection is limited to `github.com`.

Official MCP integrations remain `hosted`, `local` and `local-read-only`, with
the same existing tool/method profiles. Ask follows the host's configured approval
or fallback behavior; it does not guarantee a displayed prompt. Other policy and
host restrictions remain effective.

## Maintenance

Generate with `node scripts/build-github-graphql-pack.mjs` and
`node scripts/build-github-graphql-cases.mjs`; the fixtures continue from
`cases.json` into `cases-2.json`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/github-graphql-pack.test.mjs`.
Fixtures cover the full PR-review query with diff positions, profiles, existing
CLI/MCP behavior, scope escapes, scoped REST reads and their path, method,
option and host escapes, scoped REST writes with body files and stdin, scoped search terms and branch selectors, unlisted
read and write options in and outside the scope, every `--jq`/`--template`
spelling, leading `-R` forms, other non-GraphQL API forms, operations, variables, fragments, pagination and
unsupported input. Mutation fixtures cover each class, batches mixing classes,
conditional, fragment and aliased fields, unlisted fields, inputs and payloads,
and each `repository_writes` value. All run standalone and composed with
Baseline 0.11.1.

Root-only fixtures cover unknown nested fields, related repositories, the full
review query including `outdated`, root variables, aliases, fragments, sibling
roots, operation selection and unchanged mutation boundaries.

Repository-list fixtures bind a fork and its upstream and cover each one's CLI,
REST, GraphQL and MCP reads and writes, every owner/name combination across the
two in each form, GraphQL roots naming both, other repositories, sibling names,
path escapes and a missing `-R`. Earlier fixtures keep their string setting,
and a one-item list decides like it.
