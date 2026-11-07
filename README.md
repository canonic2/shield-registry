# Shield Registry

[![Validate and publish](https://github.com/canonic2/shield-registry/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/canonic2/shield-registry/actions/workflows/publish.yml)

**Reviewed permissions for the tools you use.**

This is Shield's main registry of signed, versioned permission packs. A pack
defines which CLI commands and MCP tools are allowed, need approval, or are
denied across three protection profiles. Each release includes its policy,
independent decision fixtures, coverage guide and license.

[Browse the registry](https://canonic2.github.io/shield-registry/) ·
[Documentation](docs/README.md) · [Contribute](CONTRIBUTING.md) ·
[Get help](SUPPORT.md) · [Security](SECURITY.md)

## Start with a pack

With a compatible [Shield client](https://github.com/canonic2/canonic/tree/main/packages/shield)
installed and your project initialized:

```sh
shield pack search git
shield pack info main/git
shield pack add main/git --profile recommended
```

Inspect the coverage and proposed permissions before confirming. `main` is the
built-in registry source; no separate registry setup is needed. A pack supplies
permissions, not the underlying tool or its interception integration.

Add Baseline for everyday shell and file operations:

```sh
shield pack add main/baseline --profile recommended
```

An unversioned addition selects the latest stable release. You can pin an exact
release with `shield add main/git@0.8.0 --profile recommended`. Publishing a newer
pack does not change installed project policy; updates require review. See
[discovery and updates](docs/command-discovery.md).

## Available packs

This table lists the latest published release of each pack. The signed
[catalog](public/catalog.json) records all published versions;
[release.json](release.json) selects releases for publication and can include
pending candidates. Older artifacts remain available for pinned installations.

| Pack | Latest version | Coverage |
| --- | --- | --- |
| [canonic/aws](packs/canonic/aws/0.2.0/README.md) | 0.2.0 | AWS CLI and MCP operations, optional profile and region restrictions |
| [canonic/baseline](packs/canonic/baseline/0.11.1/README.md) | 0.11.1 | Standard commands, approved file paths and verified Workbench docs tools |
| [canonic/box](packs/canonic/box/0.2.2/README.md) | 0.2.2 | Workspaces, plugins, execution, cleanup, session closure and recovery |
| [canonic/gate](packs/canonic/gate/0.2.2/README.md) | 0.2.2 | Repository and worktree workflows, rename, discard and path checks |
| [canonic/git](packs/canonic/git/0.8.0/README.md) | 0.8.0 | Inspection, staging, local changes, remote access and destructive boundaries |
| [canonic/github](packs/canonic/github/0.4.0/README.md) | 0.4.0 | GitHub CLI/MCP and parsed inline GraphQL reads with optional repository scope |
| [canonic/node](packs/canonic/node/0.4.0/README.md) | 0.4.0 | Node, npm, pnpm, Yarn and Corepack, with optional manager selection |
| [canonic/rust](packs/canonic/rust/0.2.0/README.md) | 0.2.0 | Cargo, Rust tools, dependencies and explicit argument paths |
| [canonic/testrun](packs/canonic/testrun/0.2.3/README.md) | 0.2.3 | Mobile/browser QA, builds, actions and launch review |

GitHub requires Shield `>=0.22.0, <1.0.0` with `graphql-v1`. The other latest
releases require Shield `>=0.20.0, <1.0.0`. Each pack declares its exact required
capabilities; clients refuse unsupported packs rather than weakening checks.

## Profiles

Every pack provides **Loose**, **Recommended** and **Strict** profiles. They become
progressively restrictive. Read the selected pack's guide for its operation
table, optional settings and coverage limits; decisions depend on the tool
and its effects.

Unknown requests require review. Known dangerous command families retain their
restrictions when options are unlisted. Configuration, environment, hooks and
executable identity still need host enforcement. Ask follows the host's approval
or fallback behavior; it does not guarantee a displayed prompt.

## Trust and release format

Shield authenticates the catalog against a pinned signing root, then verifies
expiry, sequence, release identity and artifact digest before acquisition.
Published versions and companion assets are immutable. Installed verified bytes
remain available for offline evaluation.

A valid signature establishes publisher authenticity and artifact integrity;
you still need to review whether the permissions fit your project. See
[trust and versioning](docs/trust.md) for the model and its limits.

[Catalog](https://canonic2.github.io/shield-registry/catalog.json) ·
[Signature](https://canonic2.github.io/shield-registry/catalog.sig) ·
[Public key](keys/main.pub) · [Policy schema](schemas/policy.schema.json)

## Contributing

Found a wrong decision or a missing tool? [Open an issue](https://github.com/canonic2/shield-registry/issues/new/choose)
with the operation, pack version, profile and expected behavior. For changes,
start with [CONTRIBUTING.md](CONTRIBUTING.md); it explains source ownership,
independent fixtures and focused verification. Maintainers can use the
[publication guide](docs/maintaining.md).

This repository owns pack policy and registry publication. Shield's evaluator,
CLI and host integrations live in the
[client repository](https://github.com/canonic2/canonic/tree/main/packages/shield).

## License

Registry tooling and packs are licensed under [MIT](LICENSE).
