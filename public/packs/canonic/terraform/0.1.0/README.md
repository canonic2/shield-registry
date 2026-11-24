# Terraform permissions 0.1.0

CLI permissions for `terraform`, reviewed against the official command
references on 2026-11-23. Requires Shield `>=0.53.0, <1.0.0`.
This pack supplies no MCP integration; Terraform's
separate MCP server, HCP APIs, wrappers and third-party OpenTofu servers are
outside this pack's scope.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Version and exact built-in command help | Allow | Allow | Allow |
| `fmt` with checked project paths | Allow | Allow | Ask |
| `init`, `get`, `validate`, `plan`, `console`, `graph`, provider commands | Ask | Ask | Ask |
| `output`, `show`, state inspection, metadata, workspace list/show/select/new | Ask | Ask | Ask |
| `apply`, `destroy`, `test`, `import`, `refresh`, taint/untaint, force-unlock | Ask | Ask | Deny |
| State mutations, workspace deletion, login/logout, shell completion installation/removal | Ask | Ask | Deny |
| Terraform Stacks | Ask | Ask | Deny |
| Unknown syntax, unchecked paths and recursive formatting | Ask | Ask | Ask |

## Effects and boundaries

Infrastructure is not a local sandbox. An apply or test can create, modify or
delete real resources; a saved plan does not establish consent. Planning can
execute provider plugins and external data programs, read credentials, contact
backends and write a plan file. Even validation loads executable provider
plugins. Initialization can install executable providers and migrate backend
state. These operations require review in every profile, including
`init -backend=false` and `plan -refresh=false`.

State and output inspection can disclose secrets, and provider commands can
read/write lock files or mirrors and contact registries. Console expressions
can read files. The pack cannot infer the selected account, backend, workspace,
credentials, provider behavior or paths embedded in configuration. Review covers
all these implicit effects and any explicit file or URL arguments. It does not
grant blanket access to a cloud account. Ask follows the host's approval or
fallback behavior and does not guarantee a prompt.

Formatting checks every explicit file/directory operand recursively against
approved write roots and excludes version control, Shield state, credentials
and agent settings. With no operand, the working directory must itself be an
approved unprotected write location. All formats conservatively require write
access, even `-check` and `-write=false`. Standard input asks because it is
not a filesystem path. Recursive formatting asks in every profile, including
when no operand names the default traversal root. Other display and boolean
options do not change permissions;
the option grammar locates operands, and unknown options are skipped rather
than maintained as an allowance list. Directory traversal through links remains
subject to Shield's path evidence; this is no OS-level filesystem confinement.

The documented `-chdir=DIR` form selects the effective working directory
through Shield's directory-option support. Relative formatting paths are checked
from that directory, and Strict infrastructure restrictions remain in force.
The malformed split spelling, arbitrary new global options and repeated selectors
ask. Environment variables such as
`TF_CLI_ARGS`, `TF_DATA_DIR`, credential settings and alternate CLI
configuration require host enforcement; they are not inspected by this pack.

Executable matching covers `terraform`, `/usr/bin/terraform`,
`/usr/local/bin/terraform` and `/opt/homebrew/bin/terraform`.
Matching a path does not authenticate its executable bytes.

## Command inventory

- `version`
- `fmt`
- `init`
- `get`
- `validate`
- `plan`
- `console`
- `graph`
- `output`
- `show`
- `providers`
- `providers schema`
- `providers lock`
- `providers mirror`
- `metadata functions`
- `state list`
- `state show`
- `state pull`
- `workspace list`
- `workspace show`
- `workspace select`
- `workspace new`
- `apply`
- `destroy`
- `test`
- `import`
- `refresh`
- `taint`
- `untaint`
- `force-unlock`
- `state`
- `state mv`
- `state rm`
- `state push`
- `state replace-provider`
- `workspace delete`
- `login`
- `logout`
- `modules`
- `stacks`

Unknown state subcommands retain the state mutation restriction. Other unknown
commands ask. The `modules` command asks, while Stacks operations retain the infrastructure-change restriction.
No retired interfaces have been removed from this first pack release.

## Evidence and reproduction

- [Official CLI reference](https://developer.hashicorp.com/terraform/cli/commands)
- [Formatting reference](https://developer.hashicorp.com/terraform/cli/commands/fmt)
- [Validation reference](https://developer.hashicorp.com/terraform/cli/commands/validate)
- [Test reference](https://developer.hashicorp.com/terraform/cli/commands/test)

Policy source: `scripts/iac-policy.mjs`. Independent expected decisions:
`scripts/iac-cases.mjs`. Generated artifacts include this guide, policy,
command inventory, license and all fixture files. No live infrastructure is
needed for validation.

Generate both packs with `node scripts/build-iac-packs.mjs`, or select
`terraform` as an argument. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/iac-packs.test.mjs`.
