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
| [canonic/baseline](packs/canonic/baseline/0.4.0/README.md) | 0.4.0 | Sed edits decided by path | In-place sed edits and sed script file writes and reads within approved roots with Shield 0.1.13; writes exclude only `.git` and Shield state |
| [canonic/git](packs/canonic/git/0.6.1/README.md) | 0.6.1 | `engines` field | Git 0.6.0 rules and fixtures unchanged, declared for Shield 0.1.13 |
| [canonic/baseline](packs/canonic/baseline/0.3.1/README.md) | 0.3.1 | Hidden filename listings | `rg --files --hidden` within approved roots with Shield 0.1.9; content-read protections retained |
| [canonic/baseline](packs/canonic/baseline/0.3.0/README.md) | 0.3.0 | Usable read defaults | Scoped sed/awk/jq and text-file filters, formatted date and filesystem-space inspection with Shield 0.1.8 |
| [canonic/git](packs/canonic/git/0.6.0/README.md) | 0.6.0 | Usable Git workflows | Familiar history/status/branch reads, checked deletion and ordinary housekeeping; explicit dangerous overrides remain protected |
| [canonic/baseline](packs/canonic/baseline/0.2.2/README.md) | 0.2.2 | Ordinary ripgrep searches | Optional `--no-config` with Shield 0.1.7; explicit risky options and protected paths retain their checks |
| [canonic/baseline](packs/canonic/baseline/0.2.1/README.md) | 0.2.1 | Search guidance update | Ignore-aware bounded searches and glob listings with Shield 0.1.6; shared rule identities and profile decisions preserved |
| [canonic/baseline](packs/canonic/baseline/0.2.0/README.md) | 0.2.0 | Compact structured v1 release | 71 shared executable-family bodies preserve the reviewed 149-rule policy |
| [canonic/git](packs/canonic/git/0.5.0/README.md) | 0.5.0 | Compact structured v1 release | 110 bodies, 173 command members and one invocation group preserve all 837 matched rule identities |
| [canonic/baseline](packs/canonic/baseline/0.1.5/README.md) | 0.1.5 | Structured v1 release | Standard commands, version checks, bounded directory searches and listings, text filters and files bound to approved read/write roots |
| [canonic/git](packs/canonic/git/0.4.1/README.md) | 0.4.1 | Structured v1 release | Git inspection, staging, recoverable local changes, remote activity and destructive operations |
| [canonic/git](packs/canonic/git/0.2.0/README.md) | 0.2.0 | Published historical format | Same reviewed command inventory and profile decisions |

The signed `public/` catalog uses sequence 19 and includes Baseline 0.4.0 and Git 0.6.1,
Baseline 0.3.1, Baseline 0.3.0 and Git 0.6.0,
Baseline 0.2.2 and 0.2.1,
compact Baseline 0.2.0 and Git 0.5.0, plus structured v1 Baseline
0.1.0/0.1.1/0.1.2/0.1.3/0.1.4/0.1.5 and Git 0.3.0/0.4.0/0.4.1. Current Shield requires that format. Historical Git 0.1.0/0.2.0 releases
retain their original bytes for compatible older clients.

Baseline 0.4.0 and Git 0.6.1 require Shield 0.1.13 or later within the 0.1 series.
Baseline 0.3.1 requires Shield 0.1.9 or later within the 0.1 series.
Baseline 0.3.0 and Git 0.6.0 require Shield 0.1.8 or later within the 0.1 series.
See the [usability review](docs/usability-review.md) for the reviewed defaults and boundaries.
Baseline 0.2.2 requires Shield 0.1.7 or later within the 0.1 series.
Baseline 0.2.1 requires Shield 0.1.6 or later within the 0.1 series.
Baseline 0.2.0 and Git 0.5.0 require Shield 0.1.1 or later within that series.
Baseline requires `access-paths-v1` and `fallback-rules-v1`; use a Shield build
implementing those capabilities. Its removal scope follows operator-confirmed project access paths.
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
Packs declare the Shield versions they support as `engines: {shield: RANGE}`,
which Shield 0.1.13 and later read; Shield is the only program a pack can name.
Releases published for Shield 0.1.12 and earlier keep a single `engine` range and
validate against [`policy-shield-0.1.12.schema.json`](schemas/policy-shield-0.1.12.schema.json).

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

Build the compact releases with `node scripts/build-git-compact-pack.mjs` and
`node scripts/build-baseline-compact-pack.mjs`. Git shares wrapper invocations and
command membership while preserving each original matched rule ID. Baseline
combines only identical bodies with disjoint explicit executable selectors;
its shared family IDs and source-member IDs are documented in the pack inventory.
Tests reconstruct every prior source rule, compare production evaluation evidence
across all three profiles, and retain the independent fixture suites. Baseline's
native path checks cover both the flat and compact releases.

`node scripts/build-baseline-hidden-listings.mjs` generates Baseline 0.3.1 from
the immutable 0.3.0 release. It retains 84 shared bodies and supports
`rg --files --hidden` with Shield 0.1.9; hidden content searches keep their
existing restrictions.

`node scripts/build-baseline-sed-edits.mjs` generates Baseline 0.4.0 from 0.3.1.
It adds `edit-sed`, `edit-sed-gnu` and `write-sed`, widens the sed read rules to
substitution, translation, deletion and named-file reads, and narrows write
exclusions to `.git` and Shield's review state and cache, leaving agent settings
and policy files to Shield's protected-path guard. It requires Shield 0.1.13,
which models these sed targets and reads the `engines` field.
`node scripts/build-git-engines.mjs` generates Git 0.6.1 from 0.6.0 with the
same rules and fixtures, declared for Shield 0.1.13 with `engines`.

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

Retained releases must match the authenticated previous catalog and all of their
published assets byte for byte. Their historical fixtures are not reinterpreted
by a newer engine: those expectations can record modeling limits that the new
engine deliberately expands. Current-engine tests compare retained flat and
compact Baseline policy using the 0.2.1 expectations, while new releases must
pass their own complete fixtures before signing.

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
