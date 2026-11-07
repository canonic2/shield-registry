# Trust and versioning

A permission pack is a reviewed policy for a tool. Installing it gives Shield
rules for deciding which operations can proceed, need approval, or are denied.
The registry distributes those rules; the Shield client and agent integration
enforce them.

## What a signature establishes

The main registry's signing root is pinned in Shield. Its Ed25519 signature
authenticates the exact catalog bytes. Each catalog entry identifies a pack by
publisher/name, version, artifact path and SHA-256 digest.

Before acquisition, Shield checks the signing root, signature, expiry, sequence,
artifact digest and release identity. Retained checkpoints detect catalog
rollback and changed bytes under an installed release. A key published beside a
catalog is verification material, not a replacement for the client's trusted root.

The public artifacts are available for inspection:

| Artifact | Purpose |
| --- | --- |
| [catalog.json](https://canonic2.github.io/shield-registry/catalog.json) | Release identities, versions, paths, digests, sequence and expiry |
| [catalog.sig](https://canonic2.github.io/shield-registry/catalog.sig) | Ed25519 signature of the exact catalog bytes |
| [catalog-key.pub](https://canonic2.github.io/shield-registry/catalog-key.pub) | Public verification key |
| [Versioned pack directories](../packs/canonic/) | Policy, expected cases, coverage guides, inventories and licenses |

Signing establishes authenticity and integrity. Review a pack's coverage and
permissions for your project; a signature does not establish that every permitted
command is appropriate in your environment.

## Profiles and host enforcement

Loose, Recommended and Strict become progressively restrictive. The exact
decisions depend on the tool and operation, so use its versioned guide rather
than assuming one profile grants the same permissions across all packs.

Packs declare required Shield versions and capabilities. Unsupported capabilities
are refused rather than silently ignored. Installed packs can also interact with
project rules and other packs. An Ask decision follows the host's configured
approval or fallback path; it does not guarantee a prompt.

A pack does not install the tool or interception integration. Tool configuration,
environment, hooks and executable identity still require host enforcement.

## Pinning and updates

An unversioned addition selects the latest stable release. Use an exact reference
to pin a release, for example `main/git@0.8.0`. Published policy and companion
assets are immutable; corrections are published under a new version.

Catalog publication does not rewrite a consuming project's permissions. Review
an update explicitly. An older pinned version retains its older behavior,
including any limits later addressed in a new release. See
[discovery and updates](command-discovery.md).

Installed verified bytes remain available for offline evaluation. An expired
catalog blocks new acquisition; it does not erase installed policy. Signature,
digest or rollback failures should be investigated rather than bypassed.

For a suspected bypass or tampering issue, follow the
[security reporting guide](../SECURITY.md). Maintainers can inspect a local signed
publication with `node scripts/registry-release.mjs check public`.
