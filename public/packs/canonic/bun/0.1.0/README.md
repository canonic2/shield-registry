# Bun permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed using installed Bun 1.4.3 help,
[Bun 1.4.5 package-manager source](https://github.com/oven-sh/bun/blob/bun-v1.4.5/src/runtime/cli/package_manager_command.rs),
the [runtime reference](https://bun.com/docs/runtime),
[package-manager utilities](https://bun.com/docs/pm/cli/pm),
[installation](https://bun.com/docs/pm/cli/install) and
[bunx](https://bun.com/docs/pm/bunx).

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact Bun version, revision and help forms; `bunx --help` | Allow | Allow | Allow |
| Project-local `bun pm ls/list`, `bun list`, `pm bin`, lockfile hashes and trust-list inspection | Allow | Allow | Ask |
| Runtime files, script shorthand, `run`, eval/print, stdin, REPL, exec, tests and checks | Ask | Ask | Deny |
| Installs, dependency changes, init/create, builds, compilation and runtime upgrades | Ask | Ask | Deny |
| Publication, pack hooks, trust grants, links, patches, cache changes and version tags | Ask | Ask | Deny |
| Registry queries, audits, package diffs, licenses, package.json queries and other commands | Ask | Ask | Deny |
| Explicit paths, configuration, registry selection, global scope, preloads, profiling or debugging on listings | Ask | Ask | Deny |
| Package-runner operations, subject to a specialized pack | Ask | Ask | Deny |
| MCP calls | Ask | Ask | Ask |

## Local inspection

The automatic metadata rules apply from the project directory and its
subdirectories, away from protected folders. They cover dependency lists,
the local binary directory, lockfile hashes and trusted/untrusted dependency
lists. `pm untrusted` inspects the list; `pm trust` can execute scripts and
change trust settings, so it requires review.

Listing switches that only change output are accepted without individual
permission entries. Options selecting a working directory, configuration file,
environment file, registry, cache, global installation or executable input
require review. The conservative effect scan checks tokens, equals forms and
short clusters, including option-like text supplied as an operand or child
argument. Explicit `--cwd` is reviewed even when it points inside the project.

## Execution and dependency effects

Bun executes JavaScript/TypeScript, package scripts and tests. The runtime can
automatically acquire missing packages. Install and pack operations can run
project lifecycle scripts and trusted dependency scripts. Builds can execute
macros, read additional assets, download compilation targets and write output.
`--dry-run`, `--ignore-scripts`, `--no-install` and `--no-macros` keep the
operation's review decision. Review the invocation, implicit project inputs,
hooks, referenced paths and destination before approving it.

The host controls executable identity, workspace discovery, saved npm/Bun
configuration and inherited environment. An observed nonempty `BUN_OPTIONS`
requires review before a metadata allowance applies. Inline shell assignments
also ask through Shield's shell analysis. Bare executable names, `.exe` names
and standard Unix bin paths are included.

## Node and package-runner composition

This pack owns `bun` and `bunx`; Node retains its existing executables and
package-manager rules. Generic execution and package-runner reviews are
fallback rules. A package-specific pack can classify a wrapped command, such
as `bun x prisma migrate reset`. Explicit effect scans and known package or
project changes remain regular restrictions. The focused suite checks Node,
Baseline and Prisma composition, plus delegation to a narrowly modeled
project command.

The pack defines CLI permissions. MCP calls follow other installed policy or
unknown-request fallback. Validation uses decision fixtures. Live package
installation, application execution and publication have separate acceptance scope.

Generate with `node scripts/build-bun-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/bun-pack.test.mjs`.
