# Baseline permissions 0.18.0

Supports the same Shield engine and capabilities as [0.17.0](../0.17.0/README.md).

Rsync help and version queries are allowed in every profile. This includes
`rsync --version`, `rsync --help` and repeated `--version` for metadata
output supported by newer rsync releases. The command may contain only those
metadata flags, with at least one present. No transfer operands, helper commands,
daemon settings, file-output options or other options are included.

All transfer, deletion, overwrite, configuration and helper forms retain the
previous Baseline decision. Listings and dry runs can contact remote hosts or
run transport helpers, so they retain review. No special SSH pack is needed for
these built-in metadata queries.

Reviewed against the [upstream rsync manual](https://rsync.samba.org/ftp/rsync/rsync.1)
and installed macOS openrsync reporting rsync 2.6.9 protocol compatibility.
The local version query completed without a remote connection. Transfer
execution and native Windows behavior are not part of this validation.

Other rules, profiles and existing fixtures match [0.17.0](../0.17.0/README.md).
Published artifacts are immutable. This release does not activate policy in
existing projects; installed pack updates require review.

Generate with `node scripts/build-baseline-rsync-metadata.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-rsync-metadata.test.mjs`.

Licensed under MIT.
