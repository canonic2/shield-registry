# Shield Registry documentation

To install your first pack, start with the [quickstart](../README.md#start-with-a-pack).
The [pack table](../README.md#available-packs) links to each current coverage
guide, including profile decisions, supported operations and optional settings.

## Use and troubleshoot packs

- [Discovery and updates](command-discovery.md): how Shield suggests packs and
  how to review installation or update an existing selection.
- [Trust and versioning](trust.md): signatures, pinned releases, offline use and
  the boundaries of registry verification.
- [Get help](../SUPPORT.md): choose the right report and include a useful
  reproduction.
- [Security reporting](../SECURITY.md): contact maintainers about sensitive findings.

## Contribute and maintain

- [Contributing](../CONTRIBUTING.md): prepare a focused policy, fixture, tooling
  or documentation change.
- [Maintainer guide](maintaining.md): find source builders, run checks, sign and
  publish a batch, and preserve immutable releases.
- [Policy schema](../schemas/policy.schema.json): the structural source contract;
  production Shield admission supplies semantic validation.

Keep these task guides current in place. The signed
[catalog](../public/catalog.json), versioned pack directories and
[Git history](https://github.com/canonic2/shield-registry/commits/main/)
retain release history. Dated investigations in this directory are historical
evidence and do not replace current pack guides.
