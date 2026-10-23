# Rust permissions 0.1.0

Public permission policy for Cargo, rustc, rustdoc, rustfmt, rustup and common
Cargo development extensions. Requires Shield 0.3 **with
`argument-paths-v1` and `prefix-leading-v1`**. Older builds without those
capabilities refuse this pack.
Installing policy does not install Rust, extensions, native SDKs or system tools.

| Listed operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact help/version, bounded toolchain/compiler queries, dependency metadata | Allow | Allow | Allow |
| Project build/check, Clippy, tests, doctests, run, docs, format, fixes and snapshots | Allow | Allow | Ask |
| Local dependency edits, resolution, fetch and vendoring | Allow | Allow | Deny |
| Package creation, packaging and publish dry-run | Allow | Allow | Ask |
| Cleanup, executable installation/removal, publication and toolchain changes | Ask | Ask | Deny |
| Authentication, credentials and registry/configuration administration | Ask | Deny | Deny |
| Execution/config overrides, unlisted syntax and direct plugin execution | Ask | Ask | Deny |

These decisions apply only to supported forms. `commands.json` lists executable
families and their rules; `pack.yml` gives exact option grammars. Unknown commands
and options are reviewed, including alongside Baseline. Development requests
must start inside a project write root or an explicitly approved additional write
root. Version/help and bounded toolchain identity queries need no project cwd.

## Execution trust

Recommended deliberately trusts project and dependency code. Cargo builds and
checks can execute build scripts and procedural macros; tests, examples, bench,
run, plugins and rustdoc tests execute code too. That code can write elsewhere,
start processes, use SDKs or contact a network. `--locked`, `--offline`, `--frozen`
and `--no-run` do not sandbox it. Hierarchical Cargo settings, wrappers, runners,
linkers and credential providers remain part of the trusted environment.
See [Cargo configuration](https://doc.rust-lang.org/cargo/reference/config.html)
and [build scripts](https://doc.rust-lang.org/cargo/reference/build-scripts.html).

Dependency operations can acquire code and update manifests, lockfiles and shared
caches. `cargo install --path .` still changes executable installation state.
`cargo clean` remains reviewed because output may be shared between sessions.
`cargo publish --dry-run` runs local packaging/verification and omits upload;
plain publication, ownership and yank changes remain reviewed. Explicit tokens,
registry overrides and authentication retain the stricter credential boundary.
Authentication is identified at the command position, including declared Cargo
leading options; package names, test filters and program arguments do not select
an authentication operation. Unknown suffixes on those operations retain the
credential decision.

Bare `cargo help` and global `--help`/`-h` are automatic. Topic-bearing help
requires review: Cargo resolves configured aliases before built-in help, so a
topic can dispatch an external command. See Cargo's
[help implementation](https://github.com/rust-lang/cargo/blob/master/src/bin/cargo/commands/help.rs).

## Explicit path checks

The generic `argument_paths` predicate parses each rule's full declared grammar
and physically checks selected explicit paths against approved read/write roots,
including followed symlinks and existing ancestors of new output paths.
It checks every occurrence of a selected option, not just its last value.
Unknown option arity and unresolved paths cannot establish permission.

Covered roles include Cargo manifests and target/build folders, new/init and
vendor destinations, nextest archive outputs, coverage report outputs, direct
compiler sources/output files and rustfmt file operands. Project `.shield`,
`.git`, `.aws`, `.ssh`, `.env`, `.mcp.json`, `.codex` and `.claude` paths are
excluded. Recursive directory destinations cannot encompass those exclusions.
Passing an explicit path check does not prove all runtime accesses are bounded;
implicit manifests, modules, workspace dependencies and executed code remain
trusted. Native core protected-path guards retain their independent authority.

Compiler target names and custom target files have separate grammars. Explicit
`--target` values containing a path separator or ending in `.json` use approved
read roots, including repeated values and toolchain routes. Lists mixing named
targets and target files remain reviewed. Dependency-table selectors for
`cargo add/remove` remain text (including `cfg(...)`), since they are stored in
the manifest. Named targets resolved through ambient `RUST_TARGET_PATH` remain
part of the trusted environment. See
[custom targets](https://doc.rust-lang.org/rustc/targets/custom.html).

Direct rustfmt files use write roots, including check forms in this initial
release; Cargo formatting trusts the selected project and its module discovery.
Rustfmt config output is reviewed, with its explicit destination checked.
Alternate configuration, response files, unsupported emission modes and arbitrary
compiler pass-through retain review. `cargo rustc` and `cargo rustdoc` currently
use that review boundary; direct supported compiler/source forms have their own
grammars. Rustup can automatically acquire a missing selected toolchain, so even
query/proxy permission does not promise no installation or network activity.

## Executables and toolchain routes

Supported ordinary spellings are bare names and `/bin`, `/usr/bin`,
`/usr/local/bin`, `/opt/homebrew/bin` paths. Other locations need a reviewed local
binding: `cargo_executable`, `rustc_executable`, `rustdoc_executable`,
`rustfmt_executable` or `rustup_executable`. Each is optional, accepts one absolute
path ending in the exact tool name, and adds that spelling without changing its
operation decisions. Unset leaves standard spellings available. The pack does
not accept every executable merely because its basename matches.

For example, configure a private proxy path through normal
review using `shield packs configure main/canonic/rust --local --set
cargo_executable=/opt/acme/rust/bin/cargo`. No consuming user's path is embedded
in public policy. Paths identify a trusted installation; this is not binary
content attestation.

`cargo +stable build`, version/date-pinned toolchain routes and explicit
`rustup run TOOLCHAIN cargo ...` reuse the declared Rust grammars. Delegated
global options are supported after the Cargo verb; unlisted option ordering
retains review. Arbitrary `rustup run TOOLCHAIN COMMAND`, `--install`, default
changes, component/target changes and self-management are not transparent
development routes. Debugger and language-server invocation remains reviewed.

## Extensions and composition

Listed Cargo-mediated nextest run/list/archive, deny check, audit scans,
llvm-cov default runs/nextest/reports, and insta test/review/accept/reject/pending
have separate rules. Unlisted subcommands such as `cargo audit fix` and
`cargo llvm-cov clean` retain review. Direct `cargo-nextest`, `cargo-deny`,
`cargo-audit`, `cargo-llvm-cov` and `cargo-insta` executions are reviewed because
their dispatch conventions differ. Other plugins are reviewed.

CLI references inspected for the initial inventory:
[Cargo](https://doc.rust-lang.org/cargo/commands/),
[rustup](https://rust-lang.github.io/rustup/),
[nextest](https://nexte.st/docs/),
[cargo-deny](https://embarkstudios.github.io/cargo-deny/cli/common.html),
[cargo-audit](https://github.com/rustsec/rustsec/tree/main/cargo-audit),
[llvm-cov](https://github.com/taiki-e/cargo-llvm-cov),
[insta](https://insta.rs/docs/cli/).
Coverage is the explicit checked-in grammar, not every option in those tools or
an assertion that a particular tool version is installed. Unix policy/native
fixtures are the initial verification scope; Windows native coverage is pending.

Baseline is optional. Its concrete restrictions remain effective: in Strict,
Baseline also asks for Cargo metadata and tree. Rust's unlisted rules are regular
contributions, so Baseline's broad Cargo/rustfmt allowance cannot permit unknown
Rust syntax. Project custom-rule authority remains Shield's normal contract.
Node composition does not change the Rust profile decisions.

This pack supplies no Make allowance and does not inspect recipes, environment
assignments or unobserved descendants. Task-runner policy is separate. Installing
Rust policy alone does not complete a project's migration from legacy hooks or
authorize real devices, cloud services or arbitrary process termination.

## Source maintenance

Generate policy/inventory with `node scripts/build-rust-pack.mjs`; generate
independent expectations with `node scripts/build-rust-cases.mjs`. Run focused
production evaluation with:

```sh
npm test -- --shield /absolute/path/to/shield scripts/rust-pack.test.mjs
```

Fresh native fixtures run separately through
`npm test -- --shield /absolute/path/to/shield scripts/native/rust-native.test.mjs`.
They own temporary projects/caches, use PTYs for reviewed initialization and
submit commands without executing them. Review and sign through the documented
registry release workflow; source generation never publishes a catalog.

Licensed under MIT.
