# Shield Registry

The main registry of signed, versioned permission packs for developer tools.

A pack defines which operations are allowed, need approval, or are denied under
three protection profiles. Each release includes declarative policy, expected
decisions, coverage documentation and a license. This repository maintains the
packs and publishes their verified artifacts; Shield's CLI and enforcement
integrations are developed separately.

**Registry:** [canonic2.github.io/shield-registry](https://canonic2.github.io/shield-registry/)

## Available packs

| Pack | Version | Status | Coverage |
| --- | --- | --- | --- |
| [canonic/baseline](packs/canonic/baseline/0.1.2/README.md) | 0.1.2 | Structured v1 release | Standard commands, bounded directory searches and listings, text filters and files bound to approved read/write roots |
| [canonic/git](packs/canonic/git/0.3.0/README.md) | 0.3.0 | Structured v1 release | Git inspection, staging, local changes, remote activity and destructive operations |
| [canonic/git](packs/canonic/git/0.2.0/README.md) | 0.2.0 | Published historical format | Same reviewed command inventory and profile decisions |

The signed `public/` catalog uses sequence 7 and includes structured v1 Baseline
0.1.0/0.1.1/0.1.2 and Git 0.3.0. Current Shield requires that format. Historical Git 0.1.0/0.2.0 releases
retain their original bytes for compatible older clients.

Baseline requires `access-paths-v1`; use a Shield build implementing that
capability. Its removal scope follows operator-confirmed project access paths.
See its guide for profile decisions, native-hook fixtures and coverage limits.

Git includes 173 documented and internal command names, option-aware rules for
common workflows, and fixtures across all three profiles. See the pack's guide
for exact coverage and limits. Published older versions remain available.

## Use the registry

Published releases require a compatible Shield client and an initialized project:

```sh
shield search git
shield info main/git
shield add main/git --profile recommended
shield add main/baseline --profile recommended
```

The reserved `main` source points here and pins the release signing key in the
client. With `main` selected as your default registry, `shield add git` selects
the same pack. Review the proposed permissions before confirming.

Unversioned additions select the latest stable release. Compatible clients must
support the selected pack's declared capabilities. Use
`shield add main/git@0.3.0 --profile recommended` to pin an exact version.
Updates require a reviewed policy change; installed verified bytes remain
available for offline evaluation. A pack installs permissions, not the tool or
its interception integration.

## Profiles

Every pack provides **Loose**, **Recommended** and **Strict** profiles.
These become progressively restrictive. In the current Git pack:

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed inspection and dry-run forms | Allow | Allow | Allow |
| Listed staging forms | Allow | Allow | Ask |
| Listed routine local changes | Allow | Ask | Ask |
| Remote access and publication | Ask | Ask | Deny |
| Destructive operations and sensitive helpers | Ask | Deny | Deny |

Unknown requests require review. Known dangerous command families retain their
restrictions when options are unlisted. Read the selected pack's documentation;
command configuration, environment, hooks and executable identity still need
host enforcement.

## Trust and release format

The registry serves:

- [`catalog.json`](https://canonic2.github.io/shield-registry/catalog.json): release
  identities, versions, paths, SHA-256 digests, sequence and expiry.
- [`catalog.sig`](https://canonic2.github.io/shield-registry/catalog.sig): the
  Ed25519 signature of the exact catalog bytes.
- [`catalog-key.pub`](https://canonic2.github.io/shield-registry/catalog-key.pub):
  the public signing key.
- Pack policy, fixtures, documentation, license and the
  [policy schema](schemas/policy.schema.json).

The client authenticates the catalog against its trusted root and verifies each
artifact's digest and identity before acquisition. Retained checkpoints prevent
catalog rollback and changed bytes under an installed release. Expired catalogs
block new acquisition; already installed policy can be evaluated offline.

Published policy bytes are immutable. Changes receive a new pack version.
Each catalog publication increases its sequence and renews its expiry.
Signing keys stay outside this checkout and CI; only public verification material
and signed releases are committed.

## Contributing

Open an issue for missing coverage or a pull request with a proposed pack change.
Include the operation's effects, decisions in all three profiles, expected
fixtures, coverage documentation and a license. Include adversarial cases:
option ordering, short clusters, attached values, separators and unlisted options.

Pack rules are data, not executable plugins or installers. Tool-specific choices
belong in packs; generic evaluation mechanisms belong in Shield. The current
`schema_version: 1` contract requires `kind: pack` or `kind: custom`, explicit
`conditions`, scalar/profile `decision`, and exact capability inventories.
Argument predicates use `argument-rules-v1`; the base is `structured-rules-v1`.
Requirements pair with `on_unmet`, and guidance contains static candidate suggestions.
Clients reject unsupported capabilities instead of weakening the policy.

### Validate locally

Use Node 24+ and a compatible local Shield binary:

```sh
npm ci --ignore-scripts
SHIELD_BINARY=/absolute/path/to/shield npm test
```

The test suite validates schema contracts, generated Git artifacts, inventory
coverage and signed publication integrity. With `SHIELD_BINARY` set, it also
runs the current structured Git release's behavioral fixtures through the Rust evaluator.
Maintainers must run that check before signing.

Git's reviewed option and profile data live in `scripts/git-policy.mjs`.
Its independent expected decisions live in `scripts/build-git-cases.mjs`;
the pinned inventory lives beside the pack. Regenerate after changing them:

```sh
node scripts/build-git-pack.mjs
node scripts/build-git-cases.mjs
node scripts/build-policy-schema.mjs
```

### Publish a release

After generating a pack version's source, release it with one command:

```sh
npm run release -- canonic/baseline@0.1.2
```

It asks for the private signing key path and the Shield binary, or takes them as
`--key PATH --shield PATH`, remembering both paths (never the key) in the ignored
`.release.local.json`; without a terminal it uses the remembered paths. It adds the pack to
`release.json`, sets the sequence one past the signed catalog, runs every test
against that Shield, then signs and verifies `public/`. The `expires_at` UTC expiry
in `release.json` is set by hand. The underlying steps are:

```sh
node scripts/registry-release.mjs build . /path/to/private-ed25519.pem /path/to/shield
node scripts/registry-release.mjs check public
```

Building checks the structural schema and validates every new source pack and its
fixtures with the current Shield before signing. Validation uses captured bytes in
an owned temporary directory so the signed bytes are the bytes that passed.
The JSON Schema cannot establish Rust regex syntax, native path semantics,
declared-option relationships, credential refusal or byte/resource limits;
Rust admission is required and remains authoritative.

Historical formats are retained only when their policy bytes match the previous
catalog authenticated against the same reviewed root. Their source assets must
match the retained public assets too. Expired prior metadata still constrains
immutable bytes. New or altered historical content refuses; it cannot use this
retention path to bypass current validation. The archived
[`policy-legacy.schema.json`](schemas/policy-legacy.schema.json) supports
historical inspection only; current authoring uses [structured v1](schemas/policy.schema.json).
Review and commit the source and generated `public/` files together. The GitHub
Actions workflow verifies signatures and artifact digests, then deploys
`public/` through GitHub Pages on pushes to `main`. Pull requests validate
without deployment permissions. GitHub requires no custom publication secrets.

## License

Registry tooling and packs are licensed under [MIT](LICENSE).
