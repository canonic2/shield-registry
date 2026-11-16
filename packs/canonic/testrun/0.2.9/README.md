# Testrun permissions 0.2.9

Requires Shield `>=0.20.0, <1.0.0`.

The separately named read-only `*_preview` tools are Allow in Loose,
Recommended and Strict. They cannot apply changes or execute workflows, and
reject a caller-supplied dry-run argument. Current applying MCP tools also reject
that argument; use the preview identity for inspection. Rules for older binaries
retain their reviewed decisions. Approved-root and stdio
connection boundaries remain enforced; unknown tool names keep their fallback.

Reviewed 2026-11-15 against Testrun 0.6.0 source and installed catalog:
76 current MCP tools plus three retained documentation aliases. CLI
`project discover` is inspection, with explicit root/path selections checked
against approved read roots. Current list, UI, log and documentation interfaces
use opaque `cursor` and `limit`; pagination preserves each operation's decision.
Explicit-root checks accept other options without listing allowed output forms.
Initialization previews also check an explicit `--config` destination.
Bundled documentation reads embedded pages, not arbitrary host files.
Agent Kit setup remains a registration change; its preview/reset flags keep
the existing setup decisions and do not start the runtime.

Reviewed again 2026-11-16 against the installed Testrun 0.6.0 catalog and
CLI. `project_init` requires `root` and the `planDigest` that
`project_init_preview` returns; Testrun refuses creation when the selections no
longer match that plan. The digest is an opaque plan identity with no path,
host or execution effect, so creation keeps its Ask in every profile, and
explicit roots and configuration files keep their path checks. CLI
initialization is `testrun init`, with `--dry-run` as its read-only preview.

## Safety exception: explicit configuration paths

The published policy allows, for example, `config_show` with `root: "."`
and `config: "/outside/testrun.yml"`. Testrun's configuration loader reads the
explicit file and its sibling local overlay, independently of the selected
root. This is an unsafe Allow across the approved filesystem boundary.
CLI config/project/build selections now check explicit configuration files
and directory paths; MCP configuration consumers check `config` as a read
path. Configuration initialization checks write paths. Outside or unverifiable
paths Ask in all profiles; ordinary in-root decisions remain unchanged.
This tightening applies immediately rather than waiting for retirement.
Move the configuration under approved roots or review the external path.
Inline builds, environment overrides, opaque browser requests, host-file
transfers and diagnostic content retain their existing Ask/Deny boundaries.

## Retained compatibility

| Form | Replacement | First verified absence | Removal |
| --- | --- | --- | --- |
| `testrun_docs_list`, `testrun_docs_search`, `testrun_docs_read` | `docs_list`, `docs_search`, `docs_read` | Local 0.6.0, 2026-11-15 | Deferred; no qualifying shipped-release evidence |
| Collection/log/documentation `offset`, documentation `start_line` and CLI `--offset`/`--start-line` on the reviewed paged interfaces | Opaque `cursor` and `limit` | Local 0.6.0, 2026-11-15 | Deferred; no qualifying shipped-release evidence |
| `project_init` with `dryRun` | `project_init_preview` | Installed 0.6.0, 2026-11-16 | Deferred; no qualifying shipped-release evidence |

The aliases and older argument forms keep their exact reviewed decisions and
independent fixtures. Three subsequent published tool feature releases are
required before removal is eligible; local builds and pack versions do not count.
`project_init` with `dryRun: true` keeps its preview permission for older
binaries; the separately named `project_init_preview` cannot apply changes.
Current names and retained aliases have separate inventories.

Validate this review, published compatibility, transport matching and complete
current tool coverage with
`npm test -- --shield /absolute/path/to/shield scripts/testrun-current-pack.test.mjs`.




All other coverage, supported older interfaces and retirement constraints remain
as described in [0.2.8](../0.2.8/README.md). No coverage is retired.



Regenerate with `node scripts/build-current-tool-packs.mjs testrun` and validate
with `npm test -- --shield /absolute/path/to/shield scripts/current-tool-packs.test.mjs`.
