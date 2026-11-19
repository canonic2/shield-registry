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
[catalog](public/catalog.json) and its authenticated history record all published versions;
[release.json](release.json) selects releases for publication and can include
pending candidates. Older artifacts remain available for pinned installations.

| Pack | Latest version | Coverage |
| --- | --- | --- |
| [canonic/aws](packs/canonic/aws/0.2.0/README.md) | 0.2.0 | AWS CLI and MCP operations, optional profile and region restrictions |
| [canonic/baseline](packs/canonic/baseline/0.16.0/README.md) | 0.16.0 | Standard commands, approved file paths, Base64 transformations with checked input/output files, path-checked `rg` and `grep` searches, everyday read-only listings and package-script fallback rules |
| [canonic/box](packs/canonic/box/0.2.8/README.md) | 0.2.8 | Workspaces, current setup and documentation tools, read-only previews, paginated inspection, exact current-checkout MCP selection, execution, retained recovery and resource-deleting workspace removal |
| [canonic/docker](packs/canonic/docker/0.1.0/README.md) | 0.1.0 | Local containers, images, builds and Compose, with approved context selection and review for host mounts, privileges, secrets, publication and data removal |
| [canonic/gate](packs/canonic/gate/0.2.7/README.md) | 0.2.7 | Everyday repository and worktree workflows, read-only previews, push destination selection, policy-file selection, bundled documentation and project, remote and destructive boundaries |
| [canonic/git](packs/canonic/git/0.12.0/README.md) | 0.12.0 | Everyday local commands, network reads and rebase, with Git patch output checked against writable roots |
| [canonic/github](packs/canonic/github/0.8.1/README.md) | 0.8.1 | GitHub CLI/MCP, GraphQL queries with optional repository-root matching and unrestricted nested reads, reviewed mutations, everyday read options, scoped REST reads with or without an explicit `--hostname github.com`, and approval for scoped REST requests with bodies |
| [canonic/hub](packs/canonic/hub/0.1.3/README.md) | 0.1.3 | Workspaces, tasks, processes, agents and configuration, with writable-root checks for task exports |
| [canonic/node](packs/canonic/node/0.5.0/README.md) | 0.5.0 | Everyday project scripts, Node files and package-manager listings, with optional manager selection and execution boundaries |
| [canonic/rust](packs/canonic/rust/0.2.0/README.md) | 0.2.0 | Cargo, Rust tools, dependencies and explicit argument paths |
| [canonic/testrun](packs/canonic/testrun/0.2.11/README.md) | 0.2.11 | Every Testrun CLI command and verified MCP tool allowed in all profiles, including browser storage, batched actions, builds, diagnostics and future operations, with caller-named host files kept inside approved roots |
| [canonic/workbench](packs/canonic/workbench/0.2.0/README.md) | 0.2.0 | All 21 current Workbench MCP tools and future tools allowed across every profile, with verified stdio bindings |

GitHub 0.8.1 uses a root-only GraphQL boundary: every query root must name the
configured repository, while nested fields and related-object reads are unrestricted.
It requires Shield `>=0.39.0, <1.0.0` with `graphql-v1`,
`graphql-mutations-v1`, `graphql-subtree-v1` and `variable-prefixes-v1`. Baseline requires Shield
`>=0.40.0, <1.0.0` with the Base64 file-effects model. The other latest
releases require Shield `>=0.20.0, <1.0.0`. Git 0.12.0 can allow scoped patch
output in Loose and Recommended on Shield 0.44.0 and later. Hub 0.1.3 asks
before exporting to files outside the writable roots or in protected locations.
Each pack declares its exact required capabilities. Clients refuse packs whose
required capabilities they lack.

## Profiles

Every pack provides **Loose**, **Recommended** and **Strict** profiles. They become
progressively restrictive. Read the selected pack's guide for its operation
table, optional settings and coverage limits; decisions depend on the tool
and its effects.

Unknown requests normally require review. The trusted Testrun and Workbench packs
also allow future operations within their documented scope. Known dangerous command families retain their
restrictions when options are unlisted. Configuration, environment, hooks and
executable identity still need host enforcement. Ask follows the host's approval
or fallback behavior; it does not guarantee a displayed prompt.

## Trust and release format

Shield authenticates the catalog against a pinned signing root, then verifies
expiry, sequence, release identity and artifact digest before acquisition.
Published versions and companion assets are immutable. Installed verified bytes
remain available for offline evaluation.

Catalog v3 supports growing history through authenticated per-pack version trees.
Discovery carries current pack heads; old pins follow bounded history pages.
Clients supporting only flat v1/v2 catalogs cannot acquire from this registry;
upgrade to a v3-capable Shield build. Existing installed packs remain usable offline.

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
