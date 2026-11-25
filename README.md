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
| [canonic/baseline](packs/canonic/baseline/0.19.0/README.md) | 0.19.0 | Everyday shell commands, approved file paths, read-only loopback fetches, and Shield CLI metadata and MCP review |
| [canonic/box](packs/canonic/box/0.2.8/README.md) | 0.2.8 | Workspaces, current setup and documentation tools, read-only previews, paginated inspection, exact current-checkout MCP selection, execution, retained recovery and resource-deleting workspace removal |
| [canonic/docker](packs/canonic/docker/0.1.0/README.md) | 0.1.0 | Local containers, images, builds and Compose, with approved context selection and review for host mounts, privileges, secrets, publication and data removal |
| [canonic/gate](packs/canonic/gate/0.2.9/README.md) | 0.2.9 | Repository and worktree workflows, read-only previews, and reviewed discard, rename, branch cleanup and remote changes |
| [canonic/git](packs/canonic/git/0.12.1/README.md) | 0.12.1 | Everyday local commands, network reads and rebase, with Git patch output checked against writable roots and no-op editor settings accepted |
| [canonic/github](packs/canonic/github/0.10.0/README.md) | 0.10.0 | GitHub CLI/MCP, public repository search, reviewed mutations, and optional repository boundaries for CLI, GraphQL and REST |
| [canonic/hub](packs/canonic/hub/0.1.10/README.md) | 0.1.10 | Workspaces, tasks, managed agents, Proxy lifecycle, project onboarding and Slack app setup previews |
| [canonic/node](packs/canonic/node/0.6.0/README.md) | 0.6.0 | JavaScript ecosystem, package managers, TypeScript, linting, formatting, tests, monorepos and browser QA |
| [canonic/rust](packs/canonic/rust/0.2.1/README.md) | 0.2.1 | Cargo, Rust tools, dependencies, explicit argument paths and reviewed local rustup executable discovery |
| [canonic/testrun](packs/canonic/testrun/0.2.13/README.md) | 0.2.13 | Testrun CLI and verified MCP tools, with checks on host files such as media fixtures, borrowed browser profiles and browser attachment files |
| [canonic/workbench](packs/canonic/workbench/0.2.0/README.md) | 0.2.0 | All 21 current Workbench MCP tools and future tools allowed across every profile, with verified stdio bindings |
| [canonic/1password](packs/canonic/1password/0.1.0/README.md) | 0.1.0 | Accounts, vaults and items, with reviewed secrets, subprocesses, sharing and mutations |
| [canonic/android](packs/canonic/android/0.1.0/README.md) | 0.1.0 | Android devices, emulators, SDK tooling, signing and application packages |
| [canonic/ansible](packs/canonic/ansible/0.1.0/README.md) | 0.1.0 | Nine Ansible CLIs, with reviewed configuration, plugins, remote execution, Galaxy and Vault |
| [canonic/apple](packs/canonic/apple/0.1.0/README.md) | 0.1.0 | Xcode, Swift, CocoaPods, simulators, devices, signing and submission |
| [canonic/aws-cdk-sam](packs/canonic/aws-cdk-sam/0.1.0/README.md) | 0.1.0 | AWS CDK and SAM development, infrastructure, deployment and credentials |
| [canonic/bun](packs/canonic/bun/0.1.0/README.md) | 0.1.0 | Bun runtime, package management, builds, tests and bunx launchers |
| [canonic/cloudflare](packs/canonic/cloudflare/0.1.0/README.md) | 0.1.0 | Wrangler and cloudflared deployments, storage, secrets, tunnels and Access |
| [canonic/doppler](packs/canonic/doppler/0.1.0/README.md) | 0.1.0 | CLI and official MCP, with reviewed secret retrieval, injection, edits and tokens |
| [canonic/go](packs/canonic/go/0.1.0/README.md) | 0.1.0 | Go toolchain, formatting, analysis, tests, coverage and vulnerability tools |
| [canonic/java](packs/canonic/java/0.1.0/README.md) | 0.1.0 | JVM/JDK tools, Maven and Gradle, including wrappers, signing and packaging |
| [canonic/opensearch-elasticsearch](packs/canonic/opensearch-elasticsearch/0.1.0/README.md) | 0.1.0 | Search clients, nodes, plugins, credentials and cluster/data operations |
| [canonic/opentofu](packs/canonic/opentofu/0.1.0/README.md) | 0.1.0 | OpenTofu infrastructure, providers, state, plans and reviewed mutations |
| [canonic/php](packs/canonic/php/0.1.0/README.md) | 0.1.0 | PHP, Composer, Laravel and ecosystem tests, analysis and formatting |
| [canonic/postgresql](packs/canonic/postgresql/0.1.0/README.md) | 0.1.0 | PostgreSQL clients, SQL, export/restore, administration and maintenance |
| [canonic/prisma](packs/canonic/prisma/0.1.0/README.md) | 0.1.0 | Prisma CLI, package launchers, schema, generation and database operations |
| [canonic/python](packs/canonic/python/0.1.0/README.md) | 0.1.0 | Python, package environments, tests, linting, formatting, types and security tools |
| [canonic/sqlite](packs/canonic/sqlite/0.1.0/README.md) | 0.1.0 | SQLite shell, SQL, exports, analysis, differences and synchronization |
| [canonic/ssh](packs/canonic/ssh/0.1.0/README.md) | 0.1.0 | SSH, SCP, SFTP, rsync, keys and agent operations |
| [canonic/supabase](packs/canonic/supabase/0.1.1/README.md) | 0.1.1 | Supabase CLI and MCP with opt-in SQL on a reviewed hosted read-only connection |
| [canonic/terraform](packs/canonic/terraform/0.1.0/README.md) | 0.1.0 | Terraform infrastructure, providers, state, plans and reviewed mutations |

GitHub 0.10.0 allows verified public-only repository searches in every profile.
Searches without a verified public-only filter ask for approval. With a repository
list configured, every GraphQL query root must name the same listed repository.
Nested fields and related-object reads are unrestricted. The pack requires
Shield `>=0.47.0, <1.0.0` with
`graphql-v1`, `graphql-mutations-v1`, `graphql-subtree-v1`, `variable-prefixes-v1`
and `variable-list-branches-v1`. Baseline 0.19.0 allows `policy_review` to open
Shield's mandatory confirmation on matching Shield MCP connections. Read-only
loopback fetches without redirects are allowed in Loose and Recommended and
ask in Strict. The pack requires Shield `>=0.49.0, <1.0.0` with
`url-subdomains-v1`. The ecosystem packs
declare their engine minimums and exact capability requirements in their guides.
Rust 0.2.1 requires Shield 0.53.0 for reviewed executable discovery.
Git 0.12.1 can allow scoped patch
output in Loose and Recommended on Shield 0.44.0 and later, and takes the same
decision after a leading `-c core.editor=true` or similar no-op editor setting.
Gate 0.2.9 uses Gate's confirmation for discard and repository rename in Loose
and Recommended, with host review retained for worktree branch cleanup.
Hub 0.1.10 allows Slack app setup previews and inspection of bounded output owned by the calling connection
and asks from any working directory before taking keyboard control of a managed
agent's terminal or resuming MCP capture. Explicit Compose replacement recipes
are checked against approved read roots.
Supabase 0.1.1 allows opt-in SQL when both the Shield connection ID and the
exact project-scoped hosted read-only URL match the reviewed setting.
Testrun 0.2.13 checks borrowed browser profile paths against approved write roots
and attachment credential and CA paths against approved read roots.
Node 0.6.0 retains
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
