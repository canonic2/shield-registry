# Node permissions 0.5.0

Requires Shield `>=0.20.0, <1.0.0` with the declared capabilities. Coverage
follows [0.4.0](../0.4.0/README.md). This release allows the
everyday development loop by default and keeps reviewing code that is not
committed project code.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata and help, and read-only listings with any option | Allow | Allow | Allow |
| Project scripts, script shorthand such as `yarn format:check`, and project files run with `node` or `node --test` | Allow | Allow | Ask |
| Installing declared dependencies, removal and package.json edits | Allow | Allow | Ask |
| Adding or updating dependencies | Allow | Ask | Ask |
| Supported authentication and configuration command prefixes | Allow | Ask | Ask |
| Explicit reads of token/password/secret configuration keys | Deny | Deny | Deny |
| Inline code and preloads, files outside the project, registry packages run with `npx`, `pnpx`, `dlx` or `exec`, global/publication risk scans and unlisted syntax | Ask | Ask | Ask |

## Project scripts

`npm run`, `npm test`, `pnpm`/`yarn` script verbs and their `--dir`,
`--filter`, `-r`, `--workspace` and Corepack forms run committed project
scripts, so Loose and Recommended allow them. `yarn NAME` and `pnpm NAME` also
allow when `NAME` is not one of the manager's own commands, such as
`yarn format:check` or `yarn tsc --noEmit`; a manager option before the name, as
in `pnpm --silent lint:fix`, asks. Built-in commands such as `add`, `rebuild`,
`dlx`, `node`, `plugin` and `set` keep their own decisions.

`node FILE` allows a relative project file ending in `.js`, `.cjs`, `.mjs`,
`.ts`, `.cts` or `.mts`, including files in dot-folders such as
`.local-tools/sync.mjs`. Absolute paths and paths with `..` ask, as do `-e`,
`-p`, `-r` and `--import` anywhere in the request.

A project script runs whatever the project defines. Choose Strict, or add a
project rule, to review each script run.

## Read-only listings

`list`, `ls`, `why`, `outdated`, `info`, `explain`, `root` and `bin`, and
`yarn workspaces list`, accept any option in every profile, such as
`pnpm list --depth 0`. `--global` and registry overrides still ask.

The optional package-manager selection remains a boundary: choosing pnpm still
denies npm and Yarn operations, scripts included.

Generate with `node scripts/build-node-everyday.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/node-everyday.test.mjs`.
