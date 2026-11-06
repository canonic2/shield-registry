# Current pack review — 2026-11-06

Scope: all nine current pack families, selected by invoking `update-pack` without
a pack argument. Historical versions are retained, not regenerated. The registry
started clean at `a39b353`. Its local signed catalog passed the production
publication checker at sequence 33, expiring 2027-02-03. The catalog blob also
matched GitHub's current `public/catalog.json` through its repository API.
That comparison is not a fresh Pages-deployment acceptance result.

## Outcome

| Pack | Published baseline | Prepared version | Outcome |
| --- | --- | --- | --- |
| canonic/baseline | 0.11.1 | unchanged | Bundled Workbench docs names remain covered; no new allowance needed in the reviewed surface. |
| canonic/git | 0.8.0 | unchanged | Existing command/path and destructive/credential boundaries retained; unlisted commands remain reviewable. |
| canonic/node | 0.4.0 | unchanged | Listed package-manager operations remain covered; newer script-approval commands retain unlisted-command review. |
| canonic/rust | 0.2.0 | unchanged | Reviewed Cargo/toolchain forms and explicit path restrictions retained; no new allowance justified. |
| canonic/aws | 0.2.0 | unchanged | Current global-option shape and declared verb/exception coverage reviewed; no expansion of service permissions. |
| canonic/github | 0.3.0 | unchanged | Current listed CLI/MCP coverage and repository restriction remain intentional; unlisted tools/methods retain review. |
| canonic/gate | 0.2.1 | 0.2.2 | Add rename/discard; review explicit dirty-worktree discard. |
| canonic/box | 0.2.1 | 0.2.2 | Add workflow plugins, config_sync and bounded workspace_prepare; cover remove/cleanup discard, managed sessions, deferred closure and conflicting recovery selectors. |
| canonic/testrun | 0.2.1 | 0.2.2 | Distinguish mobile actions from browser batches and align shared/legacy browser launch decisions. |

The prepared versions are unsigned and unpublished. `release.json` includes them
for the separate publication workflow; sequence and signed `public/` artifacts
are unchanged. Updating these sources does not activate a consuming project's
policy.

## Evidence and design

Canonic tool evidence came from the current checkout's CLI definitions, MCP
catalogs, argument normalization and tests: Gate's `src/cli.rs` and
`src/mcp/catalog.rs`, Box's CLI and plugin API/catalog, and Testrun's catalog,
managed mobile actions and browser public-verb translation. Agent Kit and MCP
Kit consumers retain the already supported short `docs_*` names.

Installed `mcp serve --check` probes provided a second read-only view. They were
not treated as the source contract: installed Gate 0.19.0 lacked the newer
source-level discard tool; installed Box 0.23.0 exposed the plugin tools.
Testrun's schema probe confirmed the published shared mobile/browser verbs.
No server, device, browser, manager or application was started by these probes.

New versioned builders extend frozen 0.2.1 sources. Existing generators and
published assets remain untouched. The current builder owns new operation
data; expected cases live separately in `current-tool-cases.mjs`. The new
inventories include their CLI rule IDs. Guides state the actual profiles and
conservative review boundaries.

CLI preview/mutation branches are disjoint because their argument matchers can
share a resolver rank: a weaker preview must not compete with an overlapping
mutation rule. Values of options such as `--confirm` and `--option` are consumed
before deciding whether `--dry-run` is present.

Testrun's shared `act` translates browser actions into browser requests. The old
generic input allowance would include host imports, storage export and HTTP.
The new policy checks every mobile action discriminator, keeps launch-environment
review, and asks on browser/unknown/oversized action batches. Explicitly targeted
CLI input conservatively asks because its JSON remains opaque. Shared and legacy
browser launch entry points now use the same review decision. A historical
fixture's obsolete `{type:"tap",x,y}` input was updated only in the successor's
cases to the current `{action:"tap",point:{x,y}}` shape.

Box and Testrun MCP matching now requires exactly `mcp serve`, as Gate already
did. Extra launch arguments cannot silently change the project underlying the
pack's policy assumptions. Known executable locations remain unchanged.

Box's `workspace_prepare` / `workspace prepare` continues a blocked checkout
under the same task identity without cleanup, arbitrary commands or branch
reset. It uses the ordinary routine profile decisions (Allow/Allow/Ask).
The MCP allowance requires a nonempty workspace and exact operation, generation
and request IDs; malformed or missing IDs and explicit projects require review.
Independent fixtures cover each profile, qualified projects and unknown tools.
The builder accepts an explicit `box` selection to preserve the other prepared
packs while regenerating this capability. Gate's added preparation/result
diagnostics change no tool name, argument or permission boundary.

The Box follow-up covers manager-owned exec/shell and closure from inside a
session against `docs/commands.md`, `docs/workspaces.md`, `src/mcp/catalog.rs`,
`src/mcp/commands.rs`, `src/mcp/tests.rs` and the workspace runtime command
fixtures. Arbitrary exec, shell and shortcuts retain Ask in every profile;
manager ownership does not narrow arbitrary execution effects. Deferred removal
retains Allow/Ask/Ask; immediate self-stop retains Ask, and deletion/discard still
uses Ask/Ask/Deny. Explicit discard is covered for both CLI commands and both
MCP tools, including invalid preview combinations. MCP recovery conflicts
between workspace and operation/generation require review. CLI conflict fixtures
retain the recovery decision: Box's argument validation rejects them before
effects. Pack tests establish policy decisions, not runtime rejection or session
cleanup. Published 0.2.1 and all unselected packs remain unchanged.

## External references and review limits

The unchanged third-party packs were reviewed against their declared coverage,
canonical sources and these official command references:

- [Git command reference](https://git-scm.com/docs/git).
- [npm command index](https://docs.npmjs.com/cli/v11/commands/),
  [pnpm approve-builds](https://pnpm.io/cli/approve-builds), and
  [Yarn command reference](https://yarnpkg.com/cli).
- [Cargo commands](https://doc.rust-lang.org/cargo/commands/cargo.html).
- [AWS CLI reference](https://docs.aws.amazon.com/cli/latest/reference/).
- [GitHub CLI reference](https://cli.github.com/manual/gh_help_reference) and
  [official GitHub MCP server](https://github.com/github/github-mcp-server).

This is a bounded compatibility and permission review. It does not enumerate
every current AWS service model, package-manager plugin or new vendor endpoint,
or infer that unlisted operations deserve Allow. Existing scope and fallback
policies remain deliberate. No live cloud account, agent-host prompt, mobile,
browser or cross-platform acceptance was run.

## Verification

Shield 0.21.0 evaluated the source packs through the real Rust admission and
decision interfaces. Selected commands, from the registry checkout:

```sh
node scripts/registry-release.mjs check public
node scripts/build-current-tool-packs.mjs
npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs
npm test -- --shield /absolute/path/to/shield scripts/docs-tool-packs.test.mjs scripts/reviewed-profiles.test.mjs scripts/github-usable-pack.test.mjs
```

The new-pack suite passed 9 tests without skips, including all prepared Box, Gate
and Testrun fixture cases across profiles and refusal of extra launch
arguments. The retained-pack focused suites passed 17 tests without skips.
These checks validate source admission, reproduction and policy decisions, not
execution containment or actual host prompt suppression. Release-wide checks,
signing and publication remain the separate publication workflow.

The Box session/closure follow-up reran the focused current-tool suite with
Shield 0.21.0: all 9 tests passed without skips, including the expanded Box
fixtures across all profiles. The authenticated local public catalog check
passed at sequence 33 (Box 0.2.1 published). Only the Box candidate was
regenerated; no live sessions or release-wide verification ran.
