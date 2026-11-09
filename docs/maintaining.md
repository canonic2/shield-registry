# Maintain and publish packs

Use this guide to change a permission pack, validate it with Shield, and publish
its signed artifacts. Run commands from the registry root with Node 24+.
For a first contribution, start with [CONTRIBUTING.md](../CONTRIBUTING.md).

## Choose the source

Check Git status and compare the signed `public/catalog.json` with `release.json`.
The catalog records publication; the manifest can contain pending versions.
Reuse a suitable unpublished candidate. A published version, including its guide,
fixtures, license and inventory, must keep its exact bytes.

Current source builders are grouped by capability rather than a release diary:

| Pack | Policy and fixture sources |
| --- | --- |
| Baseline | `scripts/build-docs-tool-packs.mjs` extends the reviewed policy with verified bundled docs tools |
| Git, Node, Rust, AWS | `scripts/build-reviewed-profiles.mjs` and `scripts/build-reviewed-profile-cases.mjs` |
| Box, Gate, Testrun | `scripts/build-current-tool-packs.mjs` and `scripts/current-tool-cases.mjs` extend frozen sources; the builder accepts a tool selection |
| GitHub | `scripts/build-github-graphql-pack.mjs` and `scripts/build-github-graphql-cases.mjs` |
| Workbench | `scripts/workbench-policy.mjs` and independent `scripts/workbench-cases.mjs`; regenerate with `node scripts/build-workbench-pack.mjs` |

Read each builder's imports and destination before running it. Shared builders
may generate several packs. Historical builders remain dependencies and
reproducibility evidence; running all generators is not a release prerequisite.
Prefer extending an applicable maintained builder with explicit destinations
over adding a script for each patch release.

For example, regenerate only the current Box candidate with:

```sh
node scripts/build-current-tool-packs.mjs box
```

GitHub policy and fixtures have separate entry points:

```sh
node scripts/build-github-graphql-pack.mjs
node scripts/build-github-graphql-cases.mjs
```

Expected decisions are independent of policy constructors. Do not copy evaluator
output into fixtures. Compare the tool's actual CLI/MCP interfaces, side effects,
argument boundaries, launch criteria and restrictions across all profiles.

Each fixture file contains at most 1,024 cases and fits the 1 MiB artifact limit.
Larger current-tool suites are generated as `cases.json`, `cases-2.json`, and
consecutive numbered files, with at most 64 files per release. The generator
preserves every case and its order. Source checks and the release builder validate
every file independently through the schema and Shield; every fixture file is
published and retained byte-for-byte on later releases. A failure in any file
prevents signing and publication. To reproduce a decision, pass the corresponding
file to Shield's `__internal test-pack --pack PACK --cases FILE` entry point.

## Source contract

Packs are declarative data. The current `schema_version: 1` contract requires
`kind: pack`, explicit conditions, scalar or profile decisions, and an exact
capability inventory. Shield is the only program named in `engines`.
Shield 0.x packs use a compatible minimum version with `<1.0.0` as the ceiling.

The authoring schema supports variables, setup questions, conditional rules,
preconditions, templates, fixture variables and GraphQL predicates. Rust resolves
bindings before compilation. Custom documents keep their literal-only contract.
Regenerate the schema after changing its source:

```sh
node scripts/build-policy-schema.mjs
```

Structural checks do not establish Rust regex validity, resolved capabilities,
argument relationships, path semantics or resource bounds. Production Shield
admission and fixture decisions remain required. Historical schemas are retained
for inspecting frozen documents, not authoring new policy.

## Validate

Install locked tooling when needed:

```sh
npm ci --ignore-scripts
```

For focused feedback, select the relevant test file:

```sh
npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs
npm test -- --shield /absolute/path/to/shield scripts/github-graphql-pack.test.mjs
npm test -- --shield /absolute/path/to/shield --workbench /absolute/path/to/workbench scripts/workbench-pack.test.mjs
```

Before signing, the release helper runs the full suite:

```sh
npm test -- --shield /absolute/path/to/shield
```

This checks schema admission, reproducibility, inventories, signed retention,
policy decisions and composition using the production evaluator. Historical
incompatible-version skips are acceptable; every pending version must pass its
own complete fixtures. Historical fixture bytes retain their original engine's
expectations. Current-engine tests separately cover modeling changes, including
sed target evidence through `scripts/baseline-preview.mjs`.

Native hook acceptance is separate. Run it when native integration behavior
changes, with host access for its isolated projects and Unix PTYs:

```sh
npm run test:native -- --shield /absolute/path/to/shield
```

## Publish

Add every pending source path to `release.json.packs` exactly once. Use
`catalog_version: 3` for indexed publication. Retain all
published entries and valid command-discovery associations. Set a valid UTC
`expires_at`. Keep the README's table to one latest published entry per pack;
replace its row rather than appending release history. Put detailed coverage and
compatibility in the versioned guide before signing it.
Keep the README and [documentation index](README.md) focused on current tasks;
release history belongs in Git, the signed catalog and versioned pack guides.

Run one release command for the batch, using one pending reference:

```sh
npm run release -- canonic/PACK@VERSION --key /path/to/private-ed25519.pem --shield /absolute/path/to/shield
```

Replace `PACK` and `VERSION` with the prepared pack. The command processes every
manifest entry, not just that reference. It remembers paths, never key material,
in ignored `.release.local.json`; later invocations can omit those options.
Without a terminal it uses the remembered paths.

Run the same command with `--preflight` to inspect pending paths and verify the
signing key, Shield executable and live publication without changing files:

```sh
npm run release -- canonic/PACK@VERSION --preflight
```

The helper advances the sequence above the local signed catalog, runs the full
suite, validates every new pack and its complete fixtures through Rust, then
builds and signs `public/`. Captured temporary bytes bind validation to signing.
The private key must match `keys/main.pub`. Before making changes, the release
command authenticates the deployed catalog, compares catalog/signature bytes
with local `public/`, and checks each served current pack against its digest.
A pending or mismatched deployment stops preparation before the sequence changes.

Verify the signed output:

```sh
node scripts/registry-release.mjs check public
```

Review and commit source and generated output together. Push to `main` only with
publication authorization. The **Validate and publish registry** workflow checks
signatures and digests, then deploys Pages. Confirm the workflow for the exact
commit and compare live catalog/signature bytes and new pack digests before
reporting publication. No custom GitHub signing secrets are required.

After Pages succeeds, verify the deployment through the registry's own runtime:

```sh
npm run release -- --check-live
```

This checks the reviewed signing root, unexpired catalog, exact local/live
catalog and signature bytes, and every current pack digest. Requests have bounded
timeouts and artifact sizes. Use these CLI entry points for release checks;
importing registry modules in an isolated REPL does not use the checkout's Node
dependency resolution.

## Retention and growth

The README and generated landing page present one latest version per pack.
Replace current guidance in place; avoid release-by-release paragraphs or growing
retained-version lists. The catalog and versioned artifact directories retain
history for exact-version acquisition and authenticated immutability. Source and
`public/` copies are both required by the build and retention checks.

Indexed catalog v3 lists one current head per pack and authenticates each pack's
version tree. `metadata/<sha256>.json` pages contain at most 64 ordered releases
or child references. Historical artifacts and companions remain immutable and
available; historical version count does not consume discovery slots. The
publisher verifies the complete history when retaining releases and renewing
metadata. Each discovery/page document must fit 1 MiB. Pack versions published
by this registry are stable numeric SemVer versions.
Each pack's complete history must fit the client query bounds: 4,096 releases,
128 pages, 8 MiB and depth 16. The builder and publication checker refuse a pack
exceeding these bounds before signing or accepting output. Discovery has an
explicit maximum of 4,096 heads, also within its 1 MiB bound.

Upgrade clients to a build supporting catalog v3 before switching the served
root. Existing flat v1/v2 catalogs remain readable by the new client. Older
clients refuse v3; they can keep evaluating installed verified bytes offline.
The release planner defaults to v2; changing `catalog_version` to 3 is explicit.
Before the first v3 publication, complete this blocking checklist:

- Publish a Shield release containing v3 catalog and history support through its
  normal distribution channels. A local development build does not satisfy this.
- Record the released version and public release URL in the registry publication
  review, and verify that released binary against a signed v3 fixture.
- Only then sign and deploy the v3 root. Stop publication if either prerequisite
  is missing, even when source fixtures and the development build pass.

Explicit v1/v2 publication retains the 64-release limit. Do not prune published
artifacts to fit a limit.

Command-discovery metadata stays bounded by the root document, each pack mapping
to 1–16 unique command basenames. These are authenticated relevance hints, not
permission rules. See [command discovery](command-discovery.md).
