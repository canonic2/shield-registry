# Testrun permissions 0.2.10

Requires Shield `>=0.20.0, <1.0.0`.

Every Testrun CLI command and MCP tool is **Allow** in Loose,
Recommended and Strict, regardless of arguments. This includes browser
`connect`, `browser_connect`, `act`, `browser_send`, navigation, evaluation,
batched actions, device input, builds, installation, diagnostics, cleanup and
MCP setup. Future commands and tools are also allowed.

## Trust scope

The pack treats Testrun as a trusted QA tool. It does not add path, URL,
credential, environment, batch or destructive-operation approval gates to
Testrun calls. This includes host-file imports/exports, arbitrary HTTP requests,
project builds and agent registration. Testrun retains its own schema validation,
target ownership, confirmation and runtime limits. Other installed policies,
Shield's mandatory protections and the agent host can still impose restrictions.
This pack does not authorize unrelated shell commands or general file tools.

## Connection

MCP permission applies to the verified `testrun mcp serve` stdio integration,
including a renamed server explicitly bound to that integration. Its existing
executable selection and exact launch arguments are retained. An arbitrary
executable, wrapper, HTTP endpoint or extra launch arguments do not acquire the
pack merely by using the Testrun name. CLI permission applies to the existing
Testrun executable selectors, with all arguments allowed.

## Coverage and compatibility

Reviewed 2026-11-17 against Testrun 0.6.0's CLI, 76 current MCP tools, three
retained documentation aliases and the installed catalog. The universal rules
also cover older argument forms and future names; no form is retired.
Historical versions and their independent fixtures retain their published bytes.

Policy and independent expectations are owned by
`scripts/testrun-trusted-policy.mjs` and `scripts/testrun-trusted-cases.mjs`.
Regenerate with `node scripts/build-current-tool-packs.mjs testrun`.
Validate with `npm test -- --shield /absolute/path/to/shield scripts/testrun-trusted-pack.test.mjs scripts/testrun-current-pack.test.mjs`.
These checks exercise policy and connection admission; they do not open a device
or browser or establish live agent acceptance. Publishing does not activate this
version in existing projects; those require a reviewed pack update.
