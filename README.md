# Shield Registry

The main registry of signed, versioned permission packs for developer tools.

A pack defines which operations are allowed, need approval, or are denied under
three protection profiles. Each release includes declarative policy, expected
decisions, coverage documentation and a license. This repository maintains the
packs and publishes their verified artifacts; Shield's CLI and enforcement
integrations are developed separately.

**Registry:** [canonic2.github.io/shield-registry](https://canonic2.github.io/shield-registry/)

## Available packs

| Pack | Latest version | Coverage |
| --- | --- | --- |
| [canonic/git](packs/canonic/git/0.2.0/README.md) | 0.2.0 | Git inspection, staging, local changes, remote activity and destructive operations |

Git includes 173 documented and internal command names, option-aware rules for
common workflows, and fixtures across all three profiles. See the pack's guide
for exact coverage and limits. Published older versions remain available.

## Use the registry

With Shield installed and a project initialized:

```sh
shield search git
shield info main/git
shield add main/git --profile recommended
```

The reserved `main` source points here and pins the release signing key in the
client. With `main` selected as your default registry, `shield add git` selects
the same pack. Review the proposed permissions before confirming.

Unversioned additions select the latest stable release. Compatible clients must
support the selected pack's declared capabilities. Use
`shield add main/git@0.2.0 --profile recommended` to pin an exact version.
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
belong in packs; generic evaluation mechanisms belong in Shield. The common
`schema_version: 1` contract uses explicit capabilities for optional features.
Clients reject unsupported capabilities instead of weakening the policy.

### Validate locally

Use Node 24+ and a compatible local Shield binary:

```sh
npm ci --ignore-scripts
SHIELD_BINARY=/absolute/path/to/shield npm test
```

The test suite validates schema contracts, generated Git artifacts, inventory
coverage and signed publication integrity. With `SHIELD_BINARY` set, it also
runs every retained Git release's behavioral fixtures through the Rust evaluator.
Maintainers must run that check before signing.

Git's reviewed option and profile data live in `scripts/git-policy.mjs`.
Its independent expected decisions live in `scripts/build-git-cases.mjs`;
the pinned inventory lives beside the pack. Regenerate after changing them:

```sh
node scripts/build-git-pack.mjs
node scripts/build-git-cases.mjs
```

### Publish a release

Maintainers add the new version to `release.json`, retain existing releases,
increase the catalog sequence and choose a UTC expiry. Then validate and sign:

```sh
node scripts/registry-release.mjs build . /path/to/private-ed25519.pem /path/to/shield
node scripts/registry-release.mjs check public
```

Building validates each source pack and its fixtures with Shield before signing.
Review and commit the source and generated `public/` files together. The GitHub
Actions workflow verifies signatures and artifact digests, then deploys
`public/` through GitHub Pages on pushes to `main`. Pull requests validate
without deployment permissions. GitHub requires no custom publication secrets.

## License

Registry tooling and packs are licensed under [MIT](LICENSE).
