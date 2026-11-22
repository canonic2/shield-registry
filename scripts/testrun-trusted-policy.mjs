import {hostPathCapabilities,hostPathCliRules,hostPathMcpRules} from './testrun-host-paths.mjs';

// Testrun is allowed by default for public use: arguments and profile add no
// approval boundary except host files, which must stay inside approved roots.
// Verified MCP launch identity remains unchanged.
export function trustedTestrunPack(previous) {
  const names=[...new Set(previous.rules.filter(rule=>rule.conditions.domain==='mcp'
    && typeof rule.conditions.tool==='string').map(rule=>rule.conditions.tool))];
  const executable=structuredClone(previous.rules.find(rule=>rule.id==='app-install').conditions.executable);
  return {
    schema_version:1,kind:'pack',id:'canonic/testrun',version:previous.version,
    description:'Allow every Testrun CLI command and verified MCP tool, including future operations, with caller-named host files kept inside approved roots.',
    license:previous.license,maintainers:previous.maintainers,engines:previous.engines,
    capabilities:[...new Set(['argument-rules-v1','fallback-rules-v1','mcp-integrations-v1','negated-selectors-v1','structured-rules-v1',
      ...hostPathCapabilities])].sort(),
    mcp_integrations:structuredClone(previous.mcp_integrations),
    rules:[
      {id:'cli-testrun',conditions:{domain:'argv',executable,arguments:{kind:'any'}},
        decision:{loose:'allow',recommended:'allow',strict:'allow'},reason:'Allow Testrun QA commands; host-file arguments have their own checks.'},
      ...hostPathCliRules(executable),
      ...names.map(tool=>({id:`mcp-${tool}`,conditions:{domain:'mcp',server:'testrun',tool},
        decision:{loose:'allow',recommended:'allow',strict:'allow'},reason:'Allow this Testrun QA tool; host-file arguments have their own checks.'})),
      ...hostPathMcpRules(),
      {id:'mcp-unlisted',fallback:true,conditions:{domain:'mcp',server:'testrun',tool:{not:{one_of:names}}},
        decision:'allow',reason:'Allow other tools from the verified Testrun server, including future QA operations.'},
    ],
  };
}

export function trustedTestrunGuide() {
  return `Testrun CLI commands and MCP tools are **Allow** in Loose, Recommended and
Strict, including future commands and tools, except where a call names a host
file. A host file inside the approved roots keeps the call Allow. A file outside
them, an empty or unresolvable path, or a path Shield cannot check asks in every
profile. This includes browser \`connect\`, \`browser_connect\`, \`act\`,
\`browser_send\`, navigation, evaluation, batched actions, device input, builds,
installation, diagnostics, cleanup and MCP setup.

## Host files

Reads must stay inside approved read roots; writes inside approved write roots.
Relative MCP paths are checked against the enrolled project.

| Interface | Reads | Writes |
| --- | --- | --- |
| \`browser_send\` request, each batch entry and each browser \`act\` action | \`path\` (\`storage_register\`, \`har_register\`, \`heap_import\`, \`page_add_script_tag\`, \`page_add_style_tag\`), \`response.path\` (\`callback_resolve\`), \`options.storageState\` given as a path, \`options.sourceFiles[]\`, \`options.clientCertificates[].certPath/keyPath/pfxPath\`, multipart \`file_path\` field paths | \`options.path\` (\`storage_export\`, \`http_context_storage_state\`), \`path\` and \`resourcesDir\` (\`har_capture_start\`), \`filePath\` and \`options.filePath\` (traces), \`options.recordHar.path\` |
| \`browser_connect\`, browser \`connect\` | \`context.storageState\` given as a path, \`context.clientCertificates[]\` files, \`mediaFixtures.microphonePath\` and \`mediaFixtures.cameraPath\` | \`context.recordHar.path\` |
| CLI \`connect\` and \`browser connect\` | \`--microphone-fixture\` and \`--camera-fixture\` | |
| \`app_install\`, CLI \`app install\` | \`path\` | |
| \`diagnostics_start\` source | \`path\`, \`reportDirectory\`, \`endpointFile\`, \`project\`, \`configFile\`, \`toolPath\` | |
| \`diagnostics_export\`, CLI \`diagnostics export --path\` | | \`path\` |
| Configuration, project and build tools and CLI options | \`root\`, \`project\`, \`config\`, project discovery \`paths[]\` and \`projects[].path\`, build \`config\`, \`inline.artifact.path\`, \`inline.xcode.project\` | \`config_init\` and \`project_init\` \`root\`/\`config\`, build \`root\`/\`project\`, CLI \`init\` without \`--dry-run\` |
| CLI \`browser fixture-register\` | file operand | |

Inline \`storageState\` objects, cookie and WebStorage operations
(\`context_cookies_*\`, \`page_web_storage_*\`), Cache Storage operations
(\`context_cache_storage_*\`), \`storage_apply\`, \`storage_forget\` and
\`storage_export\` without \`options.path\` change or read only Testrun-owned
browser state and stay Allow; Cache Storage reads can return secret-bearing
response bodies. \`storage_apply\` accepts both \`mode\` and the retired boolean
\`replace\`.

Arrays are checked entry by entry up to a bound: 4 trace source files, 2 client
certificates, 8 multipart fields, 8 discovery paths and 8 initialized projects.
A longer array asks, because Shield has no wildcard JSON Pointer to check the
rest. JSON passed to CLI commands such as \`browser send\`, \`act\`,
\`connect --context\`, \`build start --inline\` and \`diagnostics start --source\`
is opaque to Shield: when it names one of the host-file keys above, or contains
a \`\\u\` escape, the command asks. Use the MCP tools for checked paths.

## Trust scope

Apart from host files, the pack adds no URL, credential, environment, batch or
destructive-operation approval gates. This includes arbitrary HTTP requests,
project builds, app launch environments and agent registration. Each check
applies to the operations listed above, because other operations use the same
field names for other values, such as a cookie filter's \`options.path\`. A
future operation or tool therefore has no host-file check until a pack version
reviews it.
Testrun retains its own schema validation, target ownership, confirmation and
runtime limits. Other installed policies, Shield's mandatory protections and the
agent host can still impose restrictions. This pack does not authorize
unrelated shell commands or general file tools.

## Connection

MCP permission applies to the verified \`testrun mcp serve\` stdio integration,
including a renamed server explicitly bound to that integration. Its existing
executable selection and exact launch arguments are retained. An arbitrary
executable, wrapper, HTTP endpoint or extra launch arguments do not acquire the
pack merely by using the Testrun name. CLI permission applies to the existing
Testrun executable selectors.

## Coverage and compatibility

Reviewed 2026-11-18 against Testrun 0.9.0's CLI, 76 current MCP tools, three
retained documentation aliases and the installed catalog. The rules also cover
older argument forms, including the retired \`storage_apply\` \`replace\`
boolean, and future names; no form is retired.
Historical versions and their independent fixtures retain their published bytes.
Version 0.2.12 covers Chrome launch media fixtures in Testrun 0.12.0 source.
Both selected inputs must pass the usual read-root check.

Policy is owned by \`scripts/testrun-host-paths.mjs\` and
\`scripts/testrun-trusted-policy.mjs\`; independent expectations by
\`scripts/testrun-trusted-cases.mjs\`.
Regenerate with \`node scripts/build-current-tool-packs.mjs testrun\`.
Validate with \`npm test -- --shield /absolute/path/to/shield scripts/testrun-trusted-pack.test.mjs scripts/testrun-current-pack.test.mjs\`.
These checks exercise policy and connection admission; they do not open a device
or browser or establish live agent acceptance. Publishing does not activate this
version in existing projects; those require a reviewed pack update.
`;
}
