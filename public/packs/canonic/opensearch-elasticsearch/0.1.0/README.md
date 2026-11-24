# OpenSearch / Elasticsearch permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed using
[OpenSearch CLI v1.2.0 source](https://github.com/opensearch-project/opensearch-cli/tree/v1.2.0/commands),
[Elastic CLI v0.7.0 source](https://github.com/elastic/cli/tree/v0.7.0),
[Elasticsearch administrative tools](https://www.elastic.co/docs/reference/elasticsearch/command-line-tools)
and the [OpenSearch REST API](https://docs.opensearch.org/latest/api-reference/).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact built-in help and client version forms | Allow | Allow | Allow |
| OpenSearch CLI curl, detector, k-NN and profile operations | Ask | Ask | Deny |
| Elastic CLI Elasticsearch APIs and connection configuration | Ask | Ask | Deny |
| Server launch, native administrative tools, plugins, node repair, keystores and users | Ask | Ask | Deny |
| Opted-in local HTTP health and selected CAT metadata, GET/HEAD without redirects | Allow | Allow | Ask |
| Opted-in local HTTP document reads, queries, other paths and redirects | Ask | Ask | Ask |
| Opted-in local HTTP security and snapshots, or POST/PUT/PATCH/DELETE | Ask | Ask | Deny |
| Other clients, package-manager wrappers and MCP calls | Ask | Ask | Ask |

## Clients and administration

The pack covers `opensearch-cli`, `elastic stack es` and the `elastic es`
and `elastic elasticsearch` aliases. Client configuration selects the cluster
and its credentials. Review requests in every profile that allows approval.
Request files, bulk payloads, templates, scripts, snapshots and output effects
need inspection during that approval. `POST _search` can be a read, but its
request body remains under review. Security changes, bulk operations, scripts,
restore, deletion and repair share the sensitive-operation decision.

The generated command inventory lists the covered native executables.
Their installed identity, Java launchers, saved settings and environment are
host responsibilities. SQL clients remain under review because queries and
their connection/file settings are outside this pack's semantic model.
Absolute Unix executable paths in standard bin directories and `.exe` names
are covered. Package-manager wrappers and other installation paths follow other
installed policy or the host's unknown-request fallback.

## Local HTTP opt-in

Enable this setting only when both `localhost:9200` and `127.0.0.1:9200`
refer to your intended search service. The setting applies to HTTP and HTTPS.

```sh
shield pack configure canonic/opensearch-elasticsearch --set local_http=true
```

The pack then allows GET/HEAD requests for `/_cluster/health` and
`/_cat/health`, `indices`, `nodes`, `shards`, `count`, `aliases` and
`plugins`, with optional trailing slashes and query parameters. These
responses contain cluster and index metadata. Document and query results can
contain sensitive records and require review. Every other request at these
origins also receives a pack decision, so a broad allowance in another pack
cannot independently allow document reads or security operations.

Metadata allowances require normalized `redirects: none` evidence.
Shield supplies this for its recognized read-only curl/wget forms, for example
`curl -fsS http://localhost:9200/_cluster/health`. Local file outputs retain
Shield's path checks. Authenticated requests, uploads, bodies and mutating curl
forms can remain unclassified by the shell recognizer and require approval.
The strict HTTP mutation decision applies when the host supplies a normalized
web request with its method and URL.

The HTTP setting defaults to false. Other ports, remote hosts, hostname aliases,
reverse-proxy prefixes and arbitrary configurable origins need project policy.
The current pack format binds variables as text selectors and cannot substitute
an origin into the URL predicate's host and numeric-port arrays. Extending that
generic contract in Shield is required for configurable remote HTTP coverage.
The pack supplies no MCP server binding. It has been validated with fixtures;
live clusters and administrative tool execution have separate acceptance scope.

Generate with `node scripts/build-search-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/search-pack.test.mjs`.
