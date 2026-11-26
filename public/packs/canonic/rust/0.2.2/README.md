# Rust permissions 0.2.2

Requires Shield `>=0.55.0, <1.0.0`.

Rust, Cargo, toolchain routes, executable bindings and explicit path grammars
follow [0.1.2](../0.1.2/README.md).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata, help and identity queries | Allow | Allow | Allow |
| Listed builds, tests, formatting, dependency edits, resolution, fetch and vendoring | Allow | Allow | Ask |
| Supported executable installation and authentication prefixes | Allow | Ask | Ask |
| Registry/configuration risk scans, cleanup, execution overrides, direct plugins, publication and unlisted syntax | Ask | Ask | Ask |
| Explicit paths outside approved roots or into protected state | Deny | Deny | Deny |

Dependencies and build scripts remain trusted project execution. A strict profile
can review acquiring dependencies without making normal dependency maintenance
impossible. Registry selection and authentication are reviewable instead of
being denied as a family. Explicit target, manifest,
output and source path checks are unchanged, including toolchain routes.
Review does not approve a future command or contain executed code.

Ask uses the host's permission flow or configured fallback. Generate with
`node scripts/build-rust-development.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/rust-development.test.mjs`.

## Local builds and tests

Loose and Recommended allow routine Cargo builds and Nextest runs in approved
projects. Cargo and Nextest validate job counts, ignored-test modes and other
test selection values. For example, run a focused ignored test with
`cargo nextest run --locked --test integration --run-ignored only smoke_test`,
or use `cargo nextest run -- --ignored --exact smoke_test` for libtest-style
selection. Test listing, retries and console reporting use the same profile
decisions. Strict continues to ask for these operations.

Explicit manifest, target and output paths must stay within approved roots.
Configuration overrides, custom debuggers and tracers, and reusing archived
builds through Nextest run or list require review.

## Local Rust executable paths

Shield with executable path list support checks CARGO_HOME/bin, ~/.cargo/bin
and its own PATH for Cargo, rustc, rustdoc, rustfmt and rustup. The ordinary
pack review shows the exact paths and saves them in ignored local settings.
Discovery preserves existing bindings and local opt-outs. Run pack configure,
or call MCP pack_configure with the installed reference and no assignments, to
discover missing settings on an existing installation.

Use an explicit local list for installations outside those locations. Include
each path you want to use for that tool.

```sh
shield pack configure canonic/rust --local --set 'rustfmt_executable=["/opt/rust/bin/rustfmt","/opt/rust-dev/bin/rustfmt"]'
```

The same arguments, path requirements and profiles apply to each configured
executable. A path must match literally to use the binding.
