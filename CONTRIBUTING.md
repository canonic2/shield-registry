# Contributing to Shield Registry

Contributions can fix a permission decision, cover a new tool, improve fixtures,
or make the registry easier to use. Start with an existing issue or
[open one](https://github.com/canonic2/shield-registry/issues/new/choose) when the
intended effects or scope need discussion. Search existing issues and pull
requests first.

## Choose the right change

- **Pack policy:** commands, MCP tools, profile decisions, scope and coverage.
- **Registry tooling:** source validation, signing, catalogs and publication.
- **Documentation:** usage, authoring and contributor guidance.
- **Shield engine or host integration:** use the
  [client repository](https://github.com/canonic2/canonic/tree/main/packages/shield).

For a security-sensitive finding, follow [SECURITY.md](SECURITY.md).

## Prepare a contribution

1. Read the affected pack's guide and compare its current tool interface with
   the policy. Record the exact operation, arguments and side effects, using
   official CLI/MCP documentation or the tool's source as evidence.
2. Find the canonical builder and independent fixture source in the
   [maintainer guide](docs/maintaining.md#choose-the-source). Read the builder's
   imports and destinations before running it. Preserve unrelated changes.
3. Reuse a suitable unpublished candidate, or prepare a new version. Published
   policy and companion assets are immutable, even for documentation fixes.
   Pack versions do not have to match tool versions.
4. Change policy and expected cases independently, then regenerate the selected
   artifacts with their documented entry points. Review the generated diff.

Keep each pull request focused on a coherent change. Several packs can belong
together when a shared interface or tool change affects them. Explain that
relationship rather than mixing unrelated updates.

## Review the permission boundary

Describe how the operation behaves under Loose, Recommended and Strict.
An unfamiliar operation is not automatically safe to allow. Keep restrictions on
credentials, destructive effects, explicit paths and selected repositories or
projects. Include malformed input, option ordering, separators, unknown-operation
fallback and scope escapes where they affect the change.

Fixtures should express independently reviewed behavior. Do not copy evaluator
output into expected cases or weaken tests to obtain a passing result. When
changing an MCP integration, cover both matching and nonmatching transports.

## Verify

Use Node 24+ and a Shield executable supporting the affected capabilities.
Install locked development dependencies if needed:

```sh
npm ci --ignore-scripts
```

Run the focused suite for your change, for example:

```sh
npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs
```

Use `scripts/github-graphql-pack.test.mjs` for GitHub GraphQL work, or the
corresponding test file for another capability. Record the command, Shield
version, result and any skipped or unverified behavior in your pull request.
Documentation-only changes need link/example inspection and `git diff --check`.
The full suite runs before signing; native host acceptance is a separate category.

## Submit for review

Explain the problem, resulting decisions and validation. For policy changes,
name the affected pack/version and give a concrete before/after example. Include
the builder, independent fixtures and regenerated source artifacts together.
Keep real credentials, private paths and identifying project data out of examples.

Maintainers handle signing and publication through the
[release workflow](docs/maintaining.md#publish). Do not hand-edit generated
`public/` artifacts or include signing keys and `.release.local.json` in a pull
request. A merged source change does not activate policy in consuming projects.

Contributions are covered by the repository's [MIT license](LICENSE).
