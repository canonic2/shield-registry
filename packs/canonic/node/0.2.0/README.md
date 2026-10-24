# Node permissions 0.2.0

Supports Shield `>=0.7.0, <1.0.0`, which implements `directory-options-v1`.

This release declares the options that only choose the folder a tool works in:
`--prefix`, `--dir`, `-C`, `--cwd`.
When no rule decides a command as written, Shield matches it as the same command
run from the chosen folder, so one project rule such as `npm start` with
`cwd within project` covers `npm --prefix /path/to/project start` too, and a
folder outside the project still needs review.

The rules that repeated npm, pnpm and Yarn rules for `--prefix`, `--dir`,
`-C` and `--cwd` are removed; the plain rules decide those commands in the
chosen folder. Corepack forms keep their rules, because the option follows the
package manager's name there.

Shield checks a project-folder rule only on a folder that exists, so an install
into a folder that does not exist yet asks; the earlier cases that install into
an absent `packages/web` now expect Ask.

Other rules, profiles and the command inventory are unchanged from
0.1.2; see its [profile and coverage guide](../0.1.2/README.md).
The cases add the declared forms.

Generate with `node scripts/build-directory-options.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/directory-options.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
