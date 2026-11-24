# Doppler permissions 0.1.0

Reviewed against [Doppler CLI 3.77.1](https://github.com/DopplerHQ/cli/releases/tag/3.77.1)
and [Doppler MCP server 1.0.5](https://www.npmjs.com/package/@dopplerhq/mcp-server/v/1.0.5),
including the OpenAPI specification bundled with that server. Requires Shield
`>=0.53.0, <1.0.0`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| CLI version and built-in help | Allow | Allow | Allow |
| CLI identity, project, environment, config and tag metadata in the project | Allow | Allow | Ask |
| CLI `secrets --only-names` in the project | Allow | Allow | Ask |
| MCP project, environment and config lists and details, and `secrets_names` | Allow | Allow | Ask |
| Secret values, downloads, templates, uploads, writes, token operations and dynamic-secret leases | Ask | Ask | Deny |
| CLI `run`, setup, login, logout, MFA, OIDC, local configuration, TUI, import, updates and deprecated `enclave` | Ask | Ask | Deny |
| Known CLI changes to projects, environments, configs, tags and workplace settings, and MCP API mutations | Ask | Ask | Deny |
| Explicit CLI connection, credential, scope or diagnostic overrides on metadata commands | Ask | Ask | Ask |
| CLI environment overrides of API or dashboard host, config directory, TLS or DNS settings when supplied in the request context | Ask | Ask | Deny |
| Other MCP reads, access confirmation, unknown commands or tools | Ask | Ask | Ask |

## CLI

Use `doppler secrets --only-names -p acme-app -c dev` to inspect keys.
Use the bare `--only-names` switch. If Shield cannot prove that this switch
is active, the call takes the secret-value decision. Doppler uses a separate
API endpoint for the names-only listing.

The pack allows automatic CLI metadata inspection from the project directory
and its subdirectories. The CLI resolves the active Doppler account and scope
and may perform its usual update check. Doppler tokens and the CLI's saved
configuration determine which projects and configs the process can see. Explicit
endpoint, credential-file, scope, TLS, custom DNS and diagnostic switches
require review. Temporary mounts, fallback files, file imports and subprocesses
follow the decision for their parent command.

Shield's shell analyzer asks about inline environment assignments. When the
host supplies the effective environment as policy evidence, the pack checks the
override variables in that context. The host controls inherited environment and
saved Doppler settings that are outside the request evidence.

## MCP

Register Doppler as a stdio server. Use `npx` from npm 7 or later, pin the
package version, and set the API base URL explicitly in the registered
environment. Supply the token through your host's credential configuration or
Doppler's supported keyring login.

```json
{
  "mcpServers": {
    "doppler": {
      "command": "npx",
      "args": ["-y", "@dopplerhq/mcp-server@1.0.5", "--read-only"],
      "env": {"DOPPLER_BASE_URL": "https://api.doppler.com"}
    }
  }
}
```

The binding also accepts the pinned launch without `--read-only` and with
Doppler's `--project` or `--config` flags after the package name. The server
and the API enforce their own scope. For automatic metadata decisions, pass
the required project, environment and config strings defined by the tool.
`--read-only` still exposes tools that return secret values. Those tools keep
the same pack decision for either launch. Wrappers, HTTP connections, other
package versions and alternate base URLs need separately reviewed policy.
Shield matches the registered launch fields. The host controls executable
identity, npm configuration, inherited environment and the token.

Generate with `node scripts/build-doppler-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/doppler-pack.test.mjs`.
