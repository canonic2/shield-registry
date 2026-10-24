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
| [canonic/node](packs/canonic/node/0.2.0/README.md) | 0.2.0 | Directory options | npm `--prefix`, pnpm `--dir`/`-C` and Yarn `--cwd` declared; Shield `>=0.7.0, <1.0.0` |
| [canonic/git](packs/canonic/git/0.7.0/README.md) | 0.7.0 | Directory options | Git `-C` declared; Shield `>=0.7.0, <1.0.0` |
| [canonic/node](packs/canonic/node/0.1.2/README.md) | 0.1.2 | Shield 0.x compatibility | Node 0.1.1 policy and fixtures; Shield `>=0.2.0, <1.0.0` |
| [canonic/rust](packs/canonic/rust/0.1.2/README.md) | 0.1.2 | Shield 0.x compatibility | Rust 0.1.1 policy and fixtures; Shield `>=0.3.0, <1.0.0` |
| [canonic/baseline](packs/canonic/baseline/0.8.1/README.md) | 0.8.1 | Shield 0.x compatibility | Baseline 0.8.0 policy and fixtures; Shield `>=0.2.0, <1.0.0` |
| [canonic/git](packs/canonic/git/0.6.5/README.md) | 0.6.5 | Shield 0.x compatibility | Git 0.6.4 policy and fixtures; Shield `>=0.2.0, <1.0.0` |
| [canonic/node](packs/canonic/node/0.1.1/README.md) | 0.1.1 | Shield 0.4 compatibility | Node 0.1.0 policy and fixtures with Shield 0.2/0.3/0.4 compatibility |
| [canonic/rust](packs/canonic/rust/0.1.1/README.md) | 0.1.1 | Shield 0.4 compatibility | Rust 0.1.0 policy and fixtures with Shield 0.3/0.4 compatibility |
| [canonic/baseline](packs/canonic/baseline/0.8.0/README.md) | 0.8.0 | Pager review | Pagers require command review in every profile; Shield 0.2/0.3/0.4 compatibility |
| [canonic/git](packs/canonic/git/0.6.4/README.md) | 0.6.4 | Shield 0.4 compatibility | Git 0.6.3 policy and fixtures with Shield 0.2/0.3/0.4 compatibility |
| [canonic/node](packs/canonic/node/0.1.0/README.md) | 0.1.0 | Node ecosystem | Node/npm/pnpm/Yarn policy and optional package-manager choice; Shield 0.2/0.3 |
| [canonic/rust](packs/canonic/rust/0.1.0/README.md) | 0.1.0 | Rust ecosystem | Cargo and Rust development, explicit argument paths; Shield 0.3 |
| [canonic/baseline](packs/canonic/baseline/0.7.0/README.md) | 0.7.0 | Project script review | Project scripts require review across profiles; Shield 0.2/0.3 |
| [canonic/git](packs/canonic/git/0.6.3/README.md) | 0.6.3 | Shield 0.3 compatibility | Git 0.6.2 policy with Shield 0.2/0.3 compatibility |
| [canonic/baseline](packs/canonic/baseline/0.6.0/README.md) | 0.6.0 | Path-checked readers and writers | `nl`, `comm`, `paste`, `column`, pagers, `tee`, `ln`, `chmod`/`chown`, `command -v` and `ulimit` queries with Shield 0.2.0; outside, credential and protected paths deny |
| [canonic/git](packs/canonic/git/0.6.2/README.md) | 0.6.2 | Shield 0.2 compatibility | Git 0.6.1 rules, fixtures and inventory unchanged |
| [canonic/baseline](packs/canonic/baseline/0.5.0/README.md) | 0.5.0 | Everyday commands and builds | Lookups, piped text tools and project builds/tests allow; environment dumps, keychain secrets and hostname changes deny; installs, publishing and interpreters keep review |
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

The release manifest includes Node 0.2.0 and Git 0.7.0,
plus Node 0.1.2, Rust 0.1.2, Baseline 0.8.1 and Git 0.6.5,
plus Node 0.1.1, Rust 0.1.1, Baseline 0.8.0 and Git 0.6.4,
plus Node 0.1.0, Rust 0.1.0, Baseline 0.7.0 and Git 0.6.3,
plus Baseline 0.6.0, Baseline 0.5.0 and Git 0.6.2,
Baseline 0.4.0 and Git 0.6.1,
Baseline 0.3.1, Baseline 0.3.0 and Git 0.6.0,
Baseline 0.2.2 and 0.2.1,
compact Baseline 0.2.0 and Git 0.5.0, plus structured v1 Baseline
0.1.0/0.1.1/0.1.2/0.1.3/0.1.4/0.1.5 and Git 0.3.0/0.4.0/0.4.1. Current Shield requires that format. Historical Git 0.1.0/0.2.0 releases
retain their original bytes for compatible older clients.

Baseline 0.6.0 and Git 0.6.2 require Shield 0.2.0 or later within the 0.2 series.
Baseline 0.5.0 supports Shield 0.1.13 or later within the 0.1 and 0.2 series.
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

### Shield compatibility

Shield 0.x releases preserve the supported pack source and evaluation contract.
New main-registry packs declare their minimum supported Shield version with
`<1.0.0` as the ceiling. A breaking change requires Shield 1.0.0; compatible
minor releases do not require pack republication. Schema and required-capability
checks remain mandatory. Shield continues to enforce signed engine ranges.

Generate the compatibility releases with
`node scripts/build-shield-0x-packs.mjs`: Baseline 0.8.1, Git 0.6.5, Node 0.1.2
and Rust 0.1.2 preserve their previous policies and companion assets. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/shield-0x-packs.test.mjs`.
Before releasing a new Shield 0.x binary, run the complete policy suite against
it to verify admission, decisions and cross-pack composition. Compiled cache
formats may change independently; they do not require new source packs.

Node 0.2.0 and Git 0.7.0 declare `directory_options`, the options that only
choose the folder a tool works in (`directory-options-v1`, Shield 0.7.0). Shield
matches such a command as the plain command run from that folder when no rule
decides it as written, so Node drops the rules that repeated its npm, pnpm and
Yarn rules for those options; Corepack forms keep theirs. Generate them with
`node scripts/build-directory-options.mjs`; validate with
`npm test -- --shield /absolute/path/to/shield scripts/directory-options.test.mjs`.

The Shield 0.4 releases are generated with `node scripts/build-shield-04-packs.mjs`.
Git 0.6.4, Node 0.1.1 and Rust 0.1.1 extend engine compatibility while preserving
their previous policies and companion assets. Baseline 0.8.0 changes `less` and
`more` to Ask in every profile: subprocess helpers, interactive commands and
additional file access do not establish read-only effects. Its outside-file pager
cases require review too. Other Baseline decisions remain unchanged.
Validate with `npm test -- --shield /absolute/path/to/shield`; current-engine
composition tests select admitted releases, while historical sources retain
schema/reproducibility checks and authenticated immutable publication checks.

Baseline 0.7.0 requires Node project scripts to receive
project policy review in every profile. It preserves published 0.6.0 bytes.
Generate it with `node scripts/build-baseline-script-review.mjs`; validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-script-review.test.mjs`.
See its [guide](packs/canonic/baseline/0.7.0/README.md) for the script boundary.

Rust 0.1.0 lives under `packs/canonic/rust/0.1.0/`.
Its [guide](packs/canonic/rust/0.1.0/README.md) covers development trust,
explicit argument paths, profiles, local executable bindings and Baseline/Node
composition. It requires a Shield build supporting `argument-paths-v1`.
Generate with `node scripts/build-rust-pack.mjs` and
`node scripts/build-rust-cases.mjs`; validate with
`npm test -- --shield /absolute/path/to/shield scripts/rust-pack.test.mjs`.
The [implementation plan](docs/rust-pack-plan.md) retains the scope and decisions.

Node 0.1.0 lives under `packs/canonic/node/0.1.0/`.
Its [profile guide](packs/canonic/node/0.1.0/README.md) describes the
optional npm/pnpm/Yarn choice, routine local installs, Corepack routes and other
profile boundaries. Generate policy/inventory with `node scripts/build-node-pack.mjs`
and independent fixtures with `node scripts/build-node-cases.mjs`.
Validate just this work with `npm test -- --shield /absolute/path/to/shield scripts/node-pack.test.mjs scripts/registry-release.test.mjs`.
Publication still requires explicit maintainer action.
The authoring schema accepts Shield's variables, setup questions, `when`, pack
preconditions and templates, including fixture `variables`. Bindings resolve in
Shield before compilation. Rust admission remains required for declaration/name
relationships, template rendering, resolved feature inventories and other semantic
checks; structural schema validation cannot replace it. Custom rules do not gain
pack variables. Historical schemas and previously published pack bytes stay unchanged.
For focused native feedback checks, use
`npm test -- --shield /absolute/path/to/shield scripts/native/node-native.test.mjs`;
the fixture needs PTYs and owns its temporary projects and caches.
See [command discovery and rollout](docs/command-discovery.md) for the exact
client build, registry publication, hook repair and discovery-refresh steps.

### Command discovery metadata

`release.json.commands` maps a listed publisher/name to 1–16 unique command
basenames (ASCII letters/digits plus `._+-`, starting alphanumeric, at most 64
characters). Each ID must have a stable listed release. The publisher signs
these hints as top-level `commands` in catalog **v2**; omission emits v1.
Associations describe potentially relevant packs, not permission for any argv.
The catalog owner can change hints at a higher sequence without changing
immutable policy bytes. Pack policy schema remains version 1.

Clients accepting only catalog v1 cannot read v2; deploy a client with v2 support
before publishing this catalog. New clients continue to read existing v1
catalogs, whose missing metadata produces no command suggestions. Catalog
refresh/search/info happens outside intercepted callbacks. No public artifacts
are regenerated by the Node source builders.

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
npm test -- --shield /absolute/path/to/shield
```

The test suite validates schema contracts, generated Git artifacts, inventory
coverage and signed publication integrity in one serial Node worker, sharing
compiled schemas by content. With `--shield` (or `SHIELD_BINARY`) it checks the
current packs' complete argv fixtures and composed shell-policy cases in batches
through the production Rust evaluator. The binary must support normalized fixture
`input` and `--with-pack`. No project activation or native hooks run in this suite.
Maintainers must run it before signing; the release command runs the same suite.

Fresh native acceptance is a separate category:

```sh
npm run test:native -- --shield /absolute/path/to/shield
```

It initializes isolated projects and checks both agents' Allow/Ask/Deny replies,
protected files, unsupported launchers and Codex PermissionRequest handling in all
three profiles. Reported cwd is valid fallback context; explicit workdir takes
precedence, and PermissionRequest needs no tool ID. Run this category when native
integration behavior changes. Native acceptance requires Unix PTYs and is slower
than the policy suite. `scripts/pack-fixture.py` shares the independent case
definitions between batch evaluation and native boundaries; commands never run.

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

`node scripts/build-baseline-everyday.mjs` generates Baseline 0.5.0 from 0.4.0.
It allows lookups (`test`, `type`, `which`, `id`, `realpath`, `du`, `stat`,
`tree`, …), standard-input text tools (`nl`, `column`, `paste`, `bc`) and
project builds, checks and tests (cargo, go, make, npm/pnpm/yarn scripts and
common project tools; Strict asks). It denies environment dumps, keychain secret
reads, `gh auth token` and hostname changes. Its independent shell-level cases
live in `scripts/everyday-native.py` and feed the batch and native test runners.

`node scripts/build-baseline-path-models.mjs` generates Baseline 0.6.0 from 0.5.0.
It uses Shield 0.2.0's path models: `nl`, `comm`, `paste`, `column`, `less` and
`more` read files like `cat`; `tee`, `ln`, `chmod` and `chown` follow the write
rules, and a hard link's source also follows the read rules. `command -v` and
`ulimit` queries allow. The batch suite checks both releases across all profiles.

`node scripts/build-git-shield-02.mjs` generates Git 0.6.2 from 0.6.1 with
the same rules, fixtures and inventory, declared for Shield 0.2.

### Publish a release

After generating a pack version's source, release it with one command:

```sh
npm run release -- canonic/baseline@0.1.2
```

It asks for the private signing key path and the Shield binary, or takes them as
`--key PATH --shield PATH`, remembering both paths (never the key) in the ignored
`.release.local.json`; without a terminal it uses the remembered paths. It adds the pack to
`release.json`, sets the sequence one past the signed catalog, runs the policy and
publication suite against that Shield, then signs and verifies `public/`. The `expires_at` UTC expiry
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
