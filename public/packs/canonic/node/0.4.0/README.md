# Node permissions 0.4.0

Requires Shield `>=0.20.0, <1.0.0` with the declared capabilities. Node and
package-manager grammars follow [0.3.1](../0.3.1/README.md), with
reviewable profiles for dependency, host and registry operations.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata and help | Allow | Allow | Allow |
| Installing declared dependencies, removal and package.json edits | Allow | Allow | Ask |
| Adding or updating dependencies | Allow | Ask | Ask |
| Supported authentication and configuration command prefixes | Allow | Ask | Ask |
| Explicit reads of token/password/secret configuration keys | Deny | Deny | Deny |
| Global/publication risk scans, project scripts, inline code, package execution and unlisted syntax | Ask | Ask | Ask |

The optional package-manager selection remains a boundary: choosing pnpm still
denies npm/Yarn operations. Explicit Corepack routes retain the underlying
manager's decisions. Script names and dependency names do not establish
credential disclosure. Configuration reads that explicitly name credential keys
are distinguished from ordinary registry queries and configuration changes.

Dependency installs can execute lifecycle scripts. Project scripts and arbitrary
execution still require review; the pack does not infer their safety from names
such as build or test. Ask uses the host's approval flow or configured fallback.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
