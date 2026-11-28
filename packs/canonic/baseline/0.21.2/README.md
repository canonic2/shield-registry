# Baseline permissions 0.21.2

All profiles allow the macOS command `ipconfig getifaddr en0` and its
`/usr/sbin/ipconfig` form. The rule accepts one literal interface name and
reads its local IPv4 address. Other `ipconfig` forms, including `set` and
DHCP packet inspection, require review.

The pack supports Shield `>=0.57.0, <1.0.0`. Shield 0.62.0 recognizes this
pack for checked `find -exec wc` on Unix. With the Docker 0.2.0 permission
pack, it also recognizes checked Docker `grep` in Loose and Recommended.
Docker grep requires one reviewed `--context`, no exec options, and a
nonrecursive search of explicit absolute file paths without auxiliary files.
Explicit policy restrictions still apply.

See [Apple's implementation](https://github.com/apple-oss-distributions/bootp/blob/main/ipconfig.tproj/client.c)
and [Baseline 0.21.1](../0.21.1/README.md) for the other rules and requirements.

Generate with `node scripts/build-baseline-interface-address.mjs`. Validate
with `npm test -- --shield /absolute/path/to/shield scripts/baseline-interface-address.test.mjs`.

Licensed under MIT.
