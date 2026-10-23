# Rust permission pack plan

Status: source implementation prepared 2026-10-22. Rust 0.1.0 policy, independent
fixtures, coverage guide and discovery associations are present. Signed
publication, local installation and project activation are separate rollout work.

The implementation uses Shield's generic `argument_paths` predicate to check
explicitly named resources. It deliberately does not invent a complete runtime
filesystem footprint for Cargo, rustfmt or executed project code. Focused
production and native verification covers the implemented grammars. The optional
locked gate is deferred; no project setting is required. Local per-tool paths
use optional string bindings. See the [source guide](../packs/canonic/rust/0.1.0/README.md)
for the actual supported forms and remaining review boundaries.

## Goal and ownership

Prepare `canonic/rust` as a public permission pack for ordinary Rust development:
single crates, Cargo workspaces, libraries, binaries, stable and nightly
toolchains, cross-compilation and common testing tools. A project should be able
to build, check, test and maintain its Rust code under a clear trust model, with
separate decisions for dependency changes, installation, credentials and release.

Policy, command inventory, expected decisions and publication belong to this
registry. Generic parsing, resource observation, host interception and policy
composition belong to Shield. The pack neither installs Rust nor provides a
sandbox. Public rules and fixtures must contain no consuming project names,
package paths, personal home directories, device identities or account values.

## Findings from the development workspace

The inspection covered `.canonic/policies/{shell,fs,defaults,web}.yml`, the shared
Rust architecture/testing and behavioral rules, Rust package guides, manifests,
toolchain files and Makefiles, the legacy policy hook, Shield's shell/location
implementation and composition contracts, and the Node/Baseline pack sources.
These findings motivate generic cases; they do not become public exceptions.

| Observed setup | Generic implication |
| --- | --- |
| Multiple independent Cargo packages, sibling path dependencies and no root Cargo workspace | Cover per-package cwd and manifest selection as well as real Cargo workspaces; do not require a root manifest or a `crates/` layout. |
| Version-pinned stable toolchains and a date-pinned nightly, minimal profiles and extra components | Respect rustup's normal selection; do not hardcode a compiler version or require nightly. Toolchain/component changes remain separate operations. |
| Make entry points invoke an absolute rustup Cargo proxy | Bare commands alone are insufficient. Include reviewed executable locations and test native invocation, not just argv fixtures. |
| Separate formatting, lint, types, tests, doctests, docs, dependency and coverage targets | Model each operation independently; permission to test does not request or authorize running every engineering gate. |
| nextest, libtest, snapshots, coverage, feature/target selection and custom build profiles | Give each supported CLI an explicit grammar, including filters and pass-through arguments. Do not restrict everyone to one runner or profile. |
| Make variables select Cargo, flags, test targets and installation roots | A harmless-looking target name does not establish the recipe's effects. Rust permissions cannot classify arbitrary Make recipes. |
| Some tests start children/listeners or interact with devices and remote systems | Test permission trusts executable project code. It does not establish authorization to use a real device, cloud account or remote host. |
| Checked-in Cargo environment settings isolate test Git configuration | Existing configuration is part of the development trust boundary. Inline execution overrides need separate review. |
| A build script compiles native bridges and invokes other SDK toolchains | Rust builds can legitimately launch non-Rust tools. Describe that execution trust; a Rust pack does not grant standalone permissions to every transitive tool. |
| Instructions forbid cleaning shared Cargo output, while legacy shell policy permits `cargo clean` | Workflow instructions and executable policy are distinct. Keep clean reviewed generically; a project may explicitly deny it. |
| Legacy rustfmt checks gate `--print-config` writes and inspect file paths | Preserve these hazard cases in the new design. Do not assume the Rust core already has the legacy checks. |
| Legacy policy broadly allows selected Cargo prefixes and Make; unmatched Claude requests defer to the host | These are local development choices, not a public permission specification or proof that Shield enforces equivalent behavior. |

The workspace's temporary roots, local installation prefixes, acceptance-device
exceptions, tool versions and generated agent permissions are deliberately not
pack defaults. Architecture rules about module layout, lints, test determinism,
cache retention and when to run checks remain project instructions.

## Lessons carried over from Node

Use the [Node guide](../packs/canonic/node/0.1.0/README.md),
[`build-node-pack.mjs`](../scripts/build-node-pack.mjs) and
[`node-pack.test.mjs`](../scripts/node-pack.test.mjs) as implementation references:

1. State execution trust directly. Node installs can run lifecycle scripts;
   Cargo builds can run build scripts and procedural macros. A familiar command
   name, `--locked`, `--offline`, `--frozen` or `--no-run` is not containment.
2. Use exact help/version forms, explicit positive argument grammars, independent
   hazard restrictions and documented behavior for unknown syntax. Avoid blanket
   `cargo *`, `rustup *` or compiler allowances.
3. Resolve optional settings during reviewed activation. No callback rereads a
   manifest to make a permission choice. Passing a precondition never grants
   permission by itself.
4. Reuse a tool's declared grammar for explicit wrapper routes; do not authorize
   arbitrary nested commands by adding a convenient wrapper allowance.
5. Maintain expected decisions separately from policy construction. Test both
   normalized argv and actual native shell boundaries, with Baseline composition.
6. Keep discovery, source preparation, signed publication, tool installation and
   project activation as distinct milestones.

Node's package-manager choice has no required Rust equivalent. Do not add a
mandatory toolchain, runner, directory layout or lockfile convention merely to
imitate that setup question.

## Proposed profiles

All allowances below apply only to the explicitly supported forms and executable
spellings. Development forms require cwd within an approved project write root;
additional access paths require existing operator review. These checks bound
invocation context, not everything executed code can read, write or contact.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact version/help; bounded compiler/toolchain identity queries | Allow | Allow | Allow |
| Listed project metadata/tree/manifest queries using trusted configuration | Allow | Allow | Allow |
| Build, check, Clippy, rustdoc generation, tests, doctests, bench and run | Allow | Allow | Ask |
| Listed formatting, compiler fixes and snapshot mutations | Allow | Allow | Ask |
| Listed local dependency edits, resolution, fetch and vendoring | Allow | Allow | Deny |
| Listed package creation and local release checks, including publish dry-run | Allow | Allow | Ask |
| Artifact cleanup, including `cargo clean` and coverage cleanup | Ask | Ask | Deny |
| Executable install/uninstall, including `cargo install --path .` | Ask | Ask | Deny |
| Registry upload, yank/unyank and package owner changes | Ask | Ask | Deny |
| Login/logout, credential/configuration commands and explicit tokens | Ask | Deny | Deny |
| Toolchain/component/target installation or removal, default/override changes, rustup self-management | Ask | Ask | Deny |
| Explicit execution/configuration overrides, arbitrary plugin commands, unlisted syntax | Ask | Ask | Deny |

Metadata can resolve dependencies, access registries and use configured
credentials. A no-dependency metadata form deserves its own rule but is not
proof of no subprocesses or no ambient configuration. Never print tokens in
guidance, fixtures, reports or snapshots.

Formatting checks and writes receive separate rule IDs even where their profile
decisions agree. Package verification and `publish --dry-run` execute build work;
the latter omits uploading but is not a read-only command. See the official
[publish contract](https://doc.rust-lang.org/cargo/commands/cargo-publish.html).

## Command inventory and grammar

### Cargo built-ins

Inventory public commands and built-in aliases against an explicitly recorded
Cargo version. Map each name to a modeled category or an explicit review rule;
an inventory entry does not imply Allow. Cover:

- Build/check/test/run/bench/doc and built-in aliases; package/workspace selection,
  features, targets, profiles, jobs, message formats, release/locked/offline/frozen
  modes and command-specific options.
- Metadata, tree, locate-project, pkgid, read-manifest and supported help/list
  forms; distinguish dependency resolution from narrow local inspection.
- New/init; default VCS behavior and explicit VCS selection; add/remove/update,
  generate-lockfile, fetch, vendor, fix and supported packaging forms.
- Clean, install/uninstall, publish, yank, owner, login/logout and other
  credential/configuration surfaces as separate restricted categories.
- `cargo rustc` and `cargo rustdoc`: selected development arguments can receive
  dedicated rules; arbitrary compiler pass-through starts with review.
- Unknown external subcommands and Cargo script/nightly execution modes retain
  review. A user-defined alias is executable configuration, not a new safe verb.

The grammar must understand leading options separately from subcommand options:
`cargo +TOOLCHAIN COMMAND`, supported global flags, option order, short aliases,
repeated values, attached values and the meaning of `--` for each command.
Do not implement this using a search for a subcommand anywhere in argv.

For test and run pass-through, document that arguments belong to trusted project
code. Clippy/rustfmt pass-through has its own finite grammar. An option-looking
test filter must not become a tool option accidentally, and a separator must not
hide an actual output/configuration override.

### Development extensions

Include deliberate coverage for `cargo fmt`, `cargo clippy`, `cargo nextest`,
`cargo deny`, `cargo audit`, `cargo llvm-cov` and `cargo insta` in the first pack.
For each, record the upstream version/docs and enumerate supported subcommands:

- nextest list/run and filter/profile/test-thread/failure/stress options;
  archive creation/extraction and self-management need distinct decisions.
- deny check and audit scans; advisory acquisition versus credential/network
  configuration overrides; audit fixes are dependency edits, not inspection.
- llvm-cov instrumentation, nextest/test/run and report/show-env forms;
  cleanup and external reports/directories are separate from ordinary runs.
- insta test, inspection, review, accept and reject; snapshot acceptance/deletion
  is mutation. The pack does not authorize accepting an output without review.

Initially give Miri, expand, watch, fuzz, flamegraph, machete, outdated, upgrade,
release, cross and other plugins explicit review coverage where inventoried.
Promote useful forms only after independent CLI inspection and fixtures. Do not
equate every `cargo-SUBCOMMAND` executable with its Cargo-mediated entry point:
some plugins receive different argv when dispatched by Cargo.

### Compiler, formatter and toolchain entry points

- `rustc` / `rustdoc`: exact identity and supported print forms; project source
  compilation/documentation only with reviewed input/output grammar. Rustdoc
  tests, compiler flags, linker loading, response files and stdin need explicit
  treatment. Direct compilation is code execution through proc macros/linkers.
- `rustfmt`: exact identity, check, formatting, supported stdin modes and config
  access. Separate `--print-config`, alternate config paths and output/emission
  modes; never treat every non-option token as the same file role.
- `rustup`: bounded queries such as installed toolchains/components/targets,
  active selection and executable location. Keep installation, override/default,
  links, update and self-uninstall outside query rules.
- `rustup run TOOLCHAIN cargo ...` and other expressly supported Rust tool routes
  reuse the underlying tool grammar. `rustup run TOOLCHAIN sh ...` and unknown
  nested executables remain reviewed. `--install` is a mutation, not transparent
  delegation.
- Debugger wrappers, rust-analyzer sessions and direct Clippy driver invocation
  remain reviewed unless independently modeled; they do not inherit permission
  merely by being distributed with Rust.

Rustup proxies and project toolchain selection can affect which program runs.
Automatic acquisition can occur when a selected toolchain is missing; an argv
permission is not a guarantee of no downloads or unchanged toolchain state.
See [proxies](https://rust-lang.github.io/rustup/concepts/proxies.html) and
[rustup environment controls](https://rust-lang.github.io/rustup/environment-variables.html).

## Executables, paths and ambient execution

Support bare tool names and documented system/package-manager locations first.
Also support the standard Cargo home proxy workflow without embedding a user's
home directory. Use reviewed local per-tool executable-list bindings if needed,
with bounded absolute entries ending in that tool's exact filename. Existing
list/string variables can resolve these to selectors before compilation; prove
that approach through admission and native fixtures before committing the API.
Unconfigured locations retain review. Never permit any file just because its
basename is `cargo`, nor publish a wildcard matching arbitrary users' homes.
Cover `.exe` and Windows paths only where the adapter/parser actually supports
them; report unverified platforms separately.

Distinguish these explicit path roles: cwd, manifest, new/init destination,
workspace/path dependencies, target/build directory, formatter input/config,
vendor directory, report/archive location and install root. A lexical relative
path check alone does not prove symlink containment. Outside, protected,
unavailable or unresolved targets must retain review or core refusal; no
Allow rule may claim a target proof that Shield cannot supply.

Current engine gap: the inspected `location/targets.rs` dispatch models fixed
file tools and Node syntax checks, with no Cargo/rustfmt target model. Its root
and symlink observation mechanisms exist, but cannot establish a Rust command's
file footprint merely by attaching a `targets` requirement. The legacy rustfmt
path/config guard is not present in that dispatcher. Before allowing explicit
Rust file/output forms, either add narrowly scoped resource extraction through
the existing generic evidence interface, or keep those forms reviewed. Ordinary
build permission still trusts implicit project/configuration effects; adding an
explicit operand model would not turn arbitrary build code into a bounded file
operation.

Inspect and restrict explicit `--config` forms, alternate configuration files,
`--manifest-path`, target/output locations, response files, `-Z` execution modes,
and rustfmt print/config options before enabling routine allowances. Restriction
must survive attached values, option order, short clusters and toolchain routes.
Do not make ordinary features, profiles or cross-compilation targets suspicious
merely because this workspace uses a narrower selection.

Cargo reads hierarchical configuration. Compiler/rustdoc wrappers, runners,
linkers, aliases, credential providers, build scripts and proc macros are part
of the trusted execution environment. `--locked` constrains resolution changes;
it does not prevent execution or all network activity. `--offline` does not
constrain network calls made by arbitrary build/test code. See official
[configuration](https://doc.rust-lang.org/cargo/reference/config.html),
[build scripts](https://doc.rust-lang.org/cargo/reference/build-scripts.html) and
[build options](https://doc.rust-lang.org/cargo/commands/cargo-build.html).

Known environment overrides include `CARGO_HOME`, `RUSTUP_HOME`,
`RUSTUP_TOOLCHAIN`, `RUSTUP_DIST_SERVER`, `RUSTC`, `RUSTDOC`, `RUSTC_WRAPPER`,
`RUSTC_WORKSPACE_WRAPPER`, `RUSTFLAGS`, `CARGO_ENCODED_RUSTFLAGS`,
`RUSTDOCFLAGS`, `CARGO_TARGET_DIR`, `CARGO_BUILD_*`, `CARGO_TARGET_*` and registry
credential/provider settings. Keep explicit injection reviewed; native shell
assignment uncertainty must not be weakened by the pack. Do not claim hooks can
fully observe or constrain the agent host's inherited environment.

## Optional configuration

Start with usable profile defaults and no mandatory project settings. Candidate
v1 additions, subject to grammar/admission fixtures:

- `require_locked`: optional boolean, unset/false imposes no additional gate;
  true requires `--locked` or `--frozen` on covered build/test/resolution forms.
  It does not apply to dependency editing commands whose purpose is to change
  the lockfile. It is a resolution rule, not execution isolation.
- Local executable lists described above, asked only when the normal forms do
  not cover an operator's installation. A configured path expands that tool's
  identity selector, never its operation decisions.

Use pack preconditions for any cross-cutting required option so a narrower
allowance cannot bypass it. Unset settings stay inactive, and configuration
changes require normal user review. Do not suggest a toolchain value merely
because a file named `rust-toolchain.toml` exists: current setup suggestions
test file existence, not its TOML contents. Toolchain pin enforcement can wait
for a separately specified requirement rather than inventing a partial check.

## Baseline composition and Make boundary

Baseline 0.6.0 already has concrete broad `build-cargo`,
`build-cargo-toolchain` and `project-tools` allowances, including clean, fix,
insta, deny and rustfmt. Its Make rule accepts targets and variable assignments.
Node's yielding unlisted fallbacks therefore cannot be copied blindly.

The Rust pack needs a regular, non-yielding per-tool unlisted review rule and
specific positive rules for supported forms. These keep unknown Rust syntax
reviewed even when Baseline's broad rule allows it. Hazard rules and preconditions
must be regular contributions too. Verify specificity within the Rust pack and
the strictest decision across packs with the production resolver. A generic
fallback alone is insufficient. Keep Baseline optional; no hard dependency is
needed solely for directory/file commands.

Do not add a Rust rule for `make test`, `make build` or any path-specific Make
target. Make executes recipes and variable expansion; even inspection/dry-run
forms can evaluate executable make syntax. Baseline currently trusts listed Make
syntax as project execution. The Rust pack cannot narrow a `make` invocation
into its nested Cargo operations, intercept unobserved descendants, or prevent a
Make recipe from installing software. Future task-runner policy belongs in its
own pack; any generic transitive enforcement belongs in Shield.

Consequently, this pack enables direct Rust workflows. Using it in a repository
that requires Make entry points still depends on separately reviewed task-runner
policy. Neither a Rust pack nor this plan completes migration from legacy hooks,
changes generated agent settings, grants device/cloud access, or installs Shield.

## Implementation sequence

1. Record upstream CLI versions and inventory. Inspect Cargo/rustup/rustfmt,
   nextest, deny/audit, llvm-cov and insta independently. Produce the exact
   positive option tables, restricted forms and public command inventory.
2. Prove current-engine admission and composition with a small independent
   fixture set: ordinary build/test; absolute Cargo proxy; toolchain route;
   cleanup; config override; unknown option/plugin; Baseline coexistence.
   Inventory path-observation gaps before granting target-dependent permission.
3. Implement registry sources: `scripts/build-rust-pack.mjs`, an independently
   maintained `scripts/build-rust-cases.mjs`, and focused `rust-pack.test.mjs`.
   Generate `packs/canonic/rust/0.1.0/{pack.yml,cases.json,commands.json,README.md,LICENSE}`.
   Declare only capabilities actually used and an engine range verified against
   the implementing Shield build; do not copy Node's range without checking.
4. If a resource or wrapper proof needs engine work, specify it in Shield's
   canonical feature contract and implement it generically with focused tests.
   Until then, keep that form reviewed and document the limit. No Rust
   Allow/Ask/Deny table belongs in engine code or adapters.
5. Add focused production-evaluator and native-hook fixtures, then the registry
   release/schema tests. Review profile monotonicity, matched IDs and public
   coverage docs. A passing argv test alone is insufficient.
6. Add authenticated command-discovery associations using existing catalog v2
   machinery, with only independently covered executable families. `cargo`,
   `rustc`, `rustdoc`, `rustfmt` and `rustup` are initial candidates. CLI plugin
   names need inventory coverage before advertisement. Never associate `make`
   with Rust simply because it can launch Cargo.
7. Review source artifacts before signing. Publication, catalog renewal/signing,
   binary installation, hook repair and live project activation remain explicit
   rollout work. Keep the roadmap unchecked until implementation is complete;
   track signed availability separately.

## Verification and acceptance

Maintain independent cases for all three profiles covering:

- Single package, virtual workspace, multiple independent packages, sibling path
  dependencies, selected features/targets/profiles, tests and doctests.
- Known bare and absolute executable forms, local binding/unset cases, rustup
  proxies, `+stable`, pinned versions and date-pinned nightly routes.
- Leading/trailing options, `--name=value`, short attached values/clusters,
  repeated options, separators, unknown options and missing option values.
- Project cwd, explicitly approved additional roots, outside/missing paths,
  symlink escapes, protected outputs and formatter config/print destinations.
- Distinct clean/install/publication/auth decisions; publish dry-run versus
  upload; package list versus verification; test no-run versus actual execution.
- Unknown plugins, custom aliases, arbitrary `rustup run`, direct plugin argv,
  response files, wrapper/config/env injection and stdin execution.
- nextest/coverage archive/report/cleanup and snapshot accept/reject boundaries.
- Locked-option gate on/off/unset, `--frozen` equivalence, malformed/repeated
  flags, and explicit dependency-edit exceptions if that setting ships.
- Rust alone, Rust with current Baseline, and Rust/Baseline/Node together;
  unknown options and hazards must not inherit Baseline's broad Cargo allowance.
  Explicit project custom-rule precedence remains Shield's documented contract.
- Native Claude/Codex Allow/Ask/Deny, host approval versus automatic fallback,
  redirections, shell cwd changes, wrapper/assignment uncertainty, history links
  and command suggestions. Never claim a callback result proves human approval.

Policy fixtures evaluate requests without executing submitted commands. Native
tests use owned temporary projects/caches and the existing native harness;
they need host access for PTYs/process boundaries. Real compiler smoke tests,
if selected separately, use harmless synthetic crates and isolated destinations;
never real credentials, uploads, global uninstall or device access.

Proposed focused validation after adding the named test files:

```sh
npm test -- --shield /absolute/path/to/shield scripts/rust-pack.test.mjs scripts/registry-release.test.mjs
npm test -- --shield /absolute/path/to/shield scripts/native/rust-native.test.mjs
```

Run the complete registry policy/publication suite before signing, using the
documented entry point. Run fresh native acceptance as its own category. Select
Shield Rust checks individually only if core implementation changes. No build,
test, release or project configuration change is needed to validate this plan.

Completion requires reviewed rules, independently expected decisions, explicit
coverage limits, production composition/native results, accurate capabilities
and compatibility bounds, MIT licensing and generic examples. Performance checks
must establish that the resulting compiled rules introduce no callback-time
manifest parsing, network acquisition or runtime configuration resolution.

## Evidence and remaining decisions

Focused verification completed 2026-10-23: 29 Shield policy-rule regressions and
four compiled-policy regressions, 261 stored Rust decision cases plus 81
explicit-path cases evaluated alone, with Baseline and with Baseline/Node,
240 native Claude/Codex cases across three profiles, and 16 registry schema
tests. Native
fixtures submit commands without executing them; no real Cargo build, live
registry upload or project migration is claimed by these results.

Review boundaries include topic-bearing Cargo help, whose alias resolution can
dispatch external commands, and mixed named/file target lists. Explicit custom
target files use checked read paths. Authentication restrictions identify the
operation rather than scanning package names or filters, and complete
restrictions are copied into supported toolchain routes. Shield's generic
`prefix-leading-v1` grammar handles declared global options before an operation;
its compiled index retains those rules as executable-wide candidates. The Rust
pack requires that capability as well as `argument-paths-v1`.

The inspected [Node source guide](../packs/canonic/node/0.1.0/README.md) is marked
prepared, not signed/published. The inspected Baseline source is
[`0.6.0/pack.yml`](../packs/canonic/baseline/0.6.0/pack.yml), with inherited broad
development rules in [`build-baseline-everyday.mjs`](../scripts/build-baseline-everyday.mjs).
[Command discovery and rollout](command-discovery.md) owns existing catalog
and client rollout instructions.

The source guide and generated grammar define current coverage. Optional local
executable bindings and explicit path checks have production/native fixtures.
The optional locked gate is deferred, and toolchain pin enforcement is outside
this release. Unlisted syntax, direct plugin dispatch, Make recipes and runtime
containment retain their documented boundaries. Full release engineering gates,
signed publication, platform acceptance beyond the tested host and live project
activation remain separate work. Public pack artifacts stay generic regardless
of which repository provides the first real workflow.
