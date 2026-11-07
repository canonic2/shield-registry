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

Add every pending source path to `release.json.packs` exactly once. Retain all
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

The helper advances the sequence above the local signed catalog, runs the full
suite, validates every new pack and its complete fixtures through Rust, then
builds and signs `public/`. Captured temporary bytes bind validation to signing.
The private key must match `keys/main.pub`. Check the deployed catalog before
publication too; its sequence must be lower than the new one.

Verify the signed output:

```sh
node scripts/registry-release.mjs check public
```

Review and commit source and generated output together. Push to `main` only with
publication authorization. The **Validate and publish registry** workflow checks
signatures and digests, then deploys Pages. Confirm the workflow for the exact
commit and compare live catalog/signature bytes and new pack digests before
reporting publication. No custom GitHub signing secrets are required.

## Retention and growth

The README and generated landing page present one latest version per pack.
Replace current guidance in place; avoid release-by-release paragraphs or growing
retained-version lists. The catalog and versioned artifact directories retain
history for exact-version acquisition and authenticated immutability. Source and
`public/` copies are both required by the build and retention checks.

The current catalog format admits at most **64 releases**, across all packs, in
both registry tooling and the client. The release planner and builder reject an
oversized manifest before validation or signing. Count all retained and pending
entries when preparing a batch. Removing old entries violates the existing
retention contract; raising only this repository's limit would produce catalogs
that current clients reject. Extending capacity requires coordinated client and
registry work before publication, including an authenticated archive or another
compatible retention design. Do not prune published artifacts to fit the limit.

Command-discovery metadata stays bounded too: at most 64 pack IDs, each mapping
to 1–16 unique command basenames. These are authenticated relevance hints, not
permission rules. See [command discovery](command-discovery.md).
