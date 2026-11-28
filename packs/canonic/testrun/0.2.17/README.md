# Testrun permissions 0.2.17

Requires Shield `>=0.52.0, <1.0.0`.

Multipart file validation requires Shield's `field-path-arrays-v1`
capability. Shield builds without it can use the published
[Testrun 0.2.12 pack](../0.2.12/README.md).

Testrun CLI commands and MCP tools are **Allow** in Loose, Recommended and
Strict, including future commands and tools, except where a call names a host
file. A host file inside the approved roots keeps the call Allow. A file outside
them, an empty or unresolvable path, or a path Shield cannot check asks in every
profile. This includes browser `connect`, `browser_connect`, `act`,
`browser_send`, navigation, evaluation, batched actions, device input, builds,
installation, diagnostics, cleanup and MCP setup.

## Host files

Reads must stay inside approved read roots and writes inside approved write roots.
Browser `page_screenshot` through `browser_send` or `act`, and browser
`observe`, check `capture.outputPath` against approved write roots when supplied.
Use absolute paths for caller-named browser files and inline build file selectors
over MCP so Shield can check the same location Testrun uses. Shield evaluates
other relative MCP paths against the enrolled project.

| Interface | Reads | Writes |
| --- | --- | --- |
| `browser_send` request, each batch entry and each browser `act` action | `path` (`storage_register`, `har_register`, `heap_import`, `page_add_script_tag`, `page_add_style_tag`), `response.path` (`callback_resolve`), `options.storageState` given as a path, `options.sourceFiles[]`, `options.clientCertificates[].certPath/keyPath/pfxPath`, multipart `file_path` field paths | `options.path` (`storage_export`, `http_context_storage_state`), `path` and `resourcesDir` (`har_capture_start`), `filePath` and `options.filePath` (traces), `options.recordHar.path` |
| `browser_connect`, browser `connect` | `context.storageState` given as a path, `context.clientCertificates[]` files, `mediaFixtures.microphonePath`, `mediaFixtures.cameraPath`, `attachment.credentialPath` and `attachment.caPath` | `context.recordHar.path`, `profile.path` when `profile.kind` is `borrowed` |
| CLI `connect` and `browser connect` | `--microphone-fixture`, `--camera-fixture`, `--attachment-credential` and `--attachment-ca` | `--borrowed-profile` |
| `app_install`, CLI `app install` | `path` | |
| `diagnostics_start` source | `path`, `reportDirectory`, `endpointFile`, `project`, `configFile`, `toolPath`, absolute `deviceSet` for iOS simulator diagnostics | |
| `diagnostics_export`, CLI `diagnostics export --path` | | `path` |
| Configuration, project and build tools and CLI options | `root`, `project`, `config`, project discovery `paths[]` and `projects[].path`, build `config`, `inline.artifact.path`, `inline.artifact.glob`, `inline.xcode.project`, `inline.xcode.workspace` | `config_init` and `project_init` `root`/`config`, build `root`/`project`, CLI `init` without `--dry-run` |
| CLI `browser fixture-register` | file operand | |

Inline `storageState` objects, cookie and WebStorage operations
(`context_cookies_*`, `page_web_storage_*`), Cache Storage operations
(`context_cache_storage_*`), `storage_apply`, `storage_forget` and
`storage_export` without `options.path` change or read only Testrun-owned
browser state and stay Allow; Cache Storage reads can return secret-bearing
response bodies. `storage_apply` accepts both `mode` and the retired boolean
`replace`.

Shield checks all 128 multipart fields supported by Testrun, with text parts
requiring no path check. Separate limits apply to trace source files (4), client
certificates (2), discovery paths (8), and initialized projects (8). Longer
arrays ask. For JSON passed to CLI commands such as `browser send`, `act`,
`connect --context`, `build start --inline` and `diagnostics start --source`,
host-file keys and `\u` escapes can trigger approval. A `path` in a virtual
`directory_register` entry is allowed. Use the MCP tools for checked paths.

## Trust scope

Apart from host files, the pack adds no URL, credential, environment, batch or
destructive-operation approval gates. This includes arbitrary HTTP requests,
project builds, app launch environments and agent registration. Each check
applies to the operations listed above, because other operations use the same
field names for other values, such as a cookie filter's `options.path`. A
future operation or tool therefore has no host-file check until a pack version
reviews it.
Testrun retains its own schema validation, target ownership, confirmation and
runtime limits. Other installed policies, Shield's mandatory protections and the
agent host can still impose restrictions. This pack does not authorize
unrelated shell commands or general file tools.

## Executable and connection

MCP permission applies to the verified `testrun mcp serve` stdio integration,
including a renamed server explicitly bound to that integration. The launch
arguments are exactly `mcp serve`. On macOS and Linux, the standard
`~/.local/bin/testrun` installation also matches by its absolute path under
`/Users` or `/home`. The same host-file rules apply when the CLI is invoked
by that path. On Windows, use `testrun.exe` on
PATH as the stdio command. A wrapper, HTTP endpoint, extra launch arguments,
or an absolute Windows command falls outside this integration.

The CLI also recognizes `testrun.exe` on PATH. To invoke it by its absolute
Windows path, review a machine-local `windows_executable` binding with
`shield pack configure canonic/testrun`. That path gets the same host-file
checks as the bare command.

## Coverage and compatibility

Reviewed against Testrun 0.20.0 source and its read-only MCP catalog.
The 76 current tool names, three retained documentation aliases and reviewed
stdio integration are covered. Borrowed profiles use the write-root check
because the browser can update them. Attachment credentials and CAs use the
read-root check. Named retained profiles, installed channel selection, and
extension, WebMCP and PWA operations using owned references remain Allow across
the three profiles. Compatibility cases cover the older `storage_apply`
`replace` boolean and retired documentation names.

Physical iOS Activity Monitor capture uses Testrun's explicit
`allowSystemTrace` opt-in. The existing host-file rules cover native trace
imports and explicit executable overrides in each profile.
Compact browser status, explicit details and bounded waits stay Allow.
Perfetto buffer size, fill policy and start acknowledgement stay Allow without
changing checks on caller-selected files. For a custom simulator device set,
send an absolute approved path with MCP `diagnostics_start`. Pack 0.2.16 left
this path unchecked. Testrun passes the selected directory to Xcode's
simulator tools, which read the set for the diagnostic capture. The CLI asks
when `--source` JSON names a device set because Shield cannot check the path
inside that argument. The default device set stays Allow.

Testrun 0.15.0 is the first verified build whose `project_init_preview`
input schema omits `planDigest`. Pass the returned digest to `project_init`
when applying. Older preview inputs retain the same read-root rules.
Retirement is deferred until three subsequent published Testrun feature
releases follow the first published release verified to omit the field.

Policy is owned by `scripts/testrun-host-paths.mjs` and
`scripts/testrun-trusted-policy.mjs`; independent expectations by
`scripts/testrun-trusted-cases.mjs`.
Regenerate with `node scripts/build-current-tool-packs.mjs testrun`.
Validate with `npm test -- --shield /absolute/path/to/shield scripts/testrun-trusted-pack.test.mjs scripts/testrun-current-pack.test.mjs`.
These checks exercise policy and connection admission; they do not open a device
or browser or establish live agent acceptance. Publishing does not activate this
version in existing projects; those require a reviewed pack update.
