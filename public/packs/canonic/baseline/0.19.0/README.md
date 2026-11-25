# Baseline permissions 0.19.0

This release adds Shield CLI and MCP permissions to [Baseline 0.18.0](../0.18.0/README.md).
It uses the same Shield engine range and policy capabilities.

## Shield CLI

All profiles allow `shield --version`, `shield -V` and help such as
`shield pack update --help`. Help accepts `--project .`. Shield's native hook
reserves operator CLI commands for people at the terminal. Agents use MCP for
project status, diagnostics, bundled guides, and policy and request workflows.

## Shield MCP

All profiles allow inspection, review preparation, and calls that open Shield's
own policy confirmation on a matching connection. Host-reviewed publication,
request authority, registry trust and administrative changes keep their Ask
decisions. Shield validates arguments and review ownership before asking.

| Decision | Tools |
| --- | --- |
| Allow inspection | `status`, `doctor`, `docs_list`, `docs_read`, `docs_search`, `history_list`, `history_show`, `pack_info`, `pack_list`, `pack_search`, `pack_show`, `policy_compare`, `policy_draft_list`, `policy_evaluate`, `policy_show`, `registry_list`, `request_list`, `request_show`, `rule_list`, `session_grant_list`, `session_grant_show`, `suggestion_list` |
| Allow preparation | `pack_add`, `pack_configure`, `pack_remove`, `pack_update`, `policy_defer`, `policy_draft_remove`, `policy_propose`, `policy_withdraw`, `review_defer`, `rule_add`, `rule_edit`, `rule_remove`, `session_grant_propose`, `session_grant_reconsider` |
| Allow Shield's form | `policy_review` with a nonempty proposal ID of at most 128 characters |
| Allow setup preview | `mcp_setup_preview` for the connected project |
| Ask | `disable`, `enable`, `history_configure`, `init`, `mcp_setup`, `policy_apply`, `policy_reject`, `protection_set`, `registry_add`, `registry_default`, `registry_remove`, `registry_trust`, `request_approve`, `request_deny`, `session_grant_approve`, `session_grant_revoke`, `setup`, setup preview with an explicit project, and unlisted tools |

Pack and rule tools can take `review: true` to open Shield's form after
preparation. For a separately prepared proposal, `policy_review` opens the
same form with its `proposal_id`. Applying the exact change requires acceptance
in the form. `policy_apply` keeps its host review. Missing or malformed
proposal IDs fall back to Ask.

`setup` covers initialization and repair, reuses saved agent choices and
requires human confirmation for changes. `init` is the first-run compatibility
tool and requires an explicit agent list. Registry discovery and trust review
keep their Ask decision, including the `review_ref` follow-up. The default
registry scope is project. `mcp_setup` supports explicit Claude and Codex
repair. A preview that names a project requires review, even
though it does not publish changes. Shield validates required and malformed
arguments before any action.

Connection matching uses stdio with an empty environment override and an exact
Shield launcher. It recognizes `shield mcp serve`,
`shield mcp serve --project .` and the generated
`shield mcp serve --project . --agent <agent>` launch for Codex, Claude Code,
Gemini CLI, Antigravity, Copilot CLI and OpenCode. Shield 0.54.0 still accepts the
corresponding legacy `shield __internal mcp` registration. The executable can
be the PATH name or a standard install path, including `~/.local/bin/shield`.
The local host resolves and starts the executable. Alternate configuration
arguments, extra environment, wrappers and HTTP connections require separate
review. Merely naming a server `shield` grants no permissions.

Shield setup manages the native MCP registration and its approvals. Baseline
supplies permission rules for matching connections evaluated by the pack.

Reviewed against Shield 0.55.0's CLI, MCP catalog, native operator guard and setup
launchers. Generate with `node scripts/build-baseline-shield.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-shield.test.mjs`.

Licensed under MIT.
