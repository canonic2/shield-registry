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
| [canonic/baseline](packs/canonic/baseline/0.17.0/README.md) | 0.17.0 | Standard commands, approved file paths, Base64 transformations, path-checked searches, read-only loopback fetches and package-script fallback rules |
| [canonic/box](packs/canonic/box/0.2.8/README.md) | 0.2.8 | Workspaces, current setup and documentation tools, read-only previews, paginated inspection, exact current-checkout MCP selection, execution, retained recovery and resource-deleting workspace removal |
| [canonic/docker](packs/canonic/docker/0.1.0/README.md) | 0.1.0 | Local containers, images, builds and Compose, with approved context selection and review for host mounts, privileges, secrets, publication and data removal |
| [canonic/gate](packs/canonic/gate/0.2.8/README.md) | 0.2.8 | Repository and worktree workflows, read-only previews, and reviewed changes to bound remotes |
| [canonic/git](packs/canonic/git/0.12.1/README.md) | 0.12.1 | Everyday local commands, network reads and rebase, with Git patch output checked against writable roots and no-op editor settings accepted |
| [canonic/github](packs/canonic/github/0.9.0/README.md) | 0.9.0 | GitHub CLI/MCP, an optional list of repositories with GraphQL query roots matching one of them and unrestricted nested reads, reviewed mutations, everyday read options, scoped REST reads with or without an explicit `--hostname github.com`, and approval for scoped REST requests with bodies |
| [canonic/hub](packs/canonic/hub/0.1.5/README.md) | 0.1.5 | Workspaces, tasks, processes, agents, configuration and workspace MCP helpers, with review for credential-routing changes that skip Hub’s confirmation and for explicit client executables |
| [canonic/node](packs/canonic/node/0.5.1/README.md) | 0.5.1 | Everyday project scripts, Node files, package-manager listings and in-project Node version queries through Yarn |
| [canonic/rust](packs/canonic/rust/0.2.0/README.md) | 0.2.0 | Cargo, Rust tools, dependencies and explicit argument paths |
| [canonic/testrun](packs/canonic/testrun/0.2.12/README.md) | 0.2.12 | Every Testrun CLI command and verified MCP tool allowed in all profiles, including browser storage, batched actions, builds and diagnostics, with caller-named host files such as camera and microphone fixtures checked against approved roots |
| [canonic/workbench](packs/canonic/workbench/0.2.0/README.md) | 0.2.0 | All 21 current Workbench MCP tools and future tools allowed across every profile, with verified stdio bindings |

GitHub 0.9.0 uses a root-only GraphQL boundary: every query root must name one
of the configured repositories, such as a fork and its upstream, while nested
fields and related-object reads are unrestricted. A single repository saved for
an earlier release keeps working. It requires Shield `>=0.47.0, <1.0.0` with
`graphql-v1`, `graphql-mutations-v1`, `graphql-subtree-v1`, `variable-prefixes-v1`
and `variable-list-branches-v1`. Baseline 0.17.0 allows read-only loopback
fetches without redirects in Loose and Recommended and asks in Strict. It
requires Shield `>=0.49.0, <1.0.0` with `url-subdomains-v1`. The other latest
releases require Shield `>=0.20.0, <1.0.0`. Git 0.12.1 can allow scoped patch
output in Loose and Recommended on Shield 0.44.0 and later, and takes the same
decision after a leading `-c core.editor=true` or similar no-op editor setting.
Gate 0.2.8 allows remote-change previews in every profile, asks before applying
remote changes in Loose and Recommended, and denies applying them in Strict.
Hub 0.1.5 uses the routine decision for workspace MCP headers and the
arbitrary-program decision for the workspace MCP stdio launcher. Testrun 0.2.12
checks browser camera and microphone fixture paths against approved read roots.
Node 0.5.1 allows
`yarn --cwd DIR node --version` in Loose and Recommended when both directories
are inside the project. Strict asks.
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
