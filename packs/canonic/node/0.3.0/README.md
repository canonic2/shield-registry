# Node permissions 0.3.0

Supports Shield `>=0.7.0, <1.0.0`.

The recommended profile asks before dependencies change by name or version:
`npm install NAME`, `npm i NAME`, `pnpm add NAME`, `yarn add NAME` and the
`update`, `upgrade` and `up` commands, in every npm, pnpm, Yarn and Corepack
form. Those commands download packages an agent chose and can run their code
during install or on first import. Installing what `package.json` and the
lockfile already declare (`npm install`, `npm ci`, `pnpm install`,
`yarn install`) stays allowed, as do `uninstall`, `remove` and `rebuild`.
The loose profile allows all of them and the strict profile denies them, as in
0.2.0.

Each earlier install rule is split by command: the declared install keeps its
identity, and `-add`, `-update` and `-remove` rules cover the rest. Other
rules, profiles and cases match [0.2.0](../0.2.0/README.md); the recommended
cases that add named packages now expect Ask.

Generate with `node scripts/build-node-dependency-review.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/node-dependency-review.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
