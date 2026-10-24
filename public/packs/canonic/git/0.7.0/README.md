# Git permissions 0.7.0

Supports Shield `>=0.7.0, <1.0.0`, which implements `directory-options-v1`.

This release declares the options that only choose the folder a tool works in:
`-C`.
When no rule decides a command as written, Shield matches it as the same command
run from the chosen folder, so one project rule such as `npm start` with
`cwd within project` covers `npm --prefix /path/to/project start` too, and a
folder outside the project still needs review.

Other rules, profiles and the command inventory are unchanged from
0.6.5; see its [profile and coverage guide](../0.6.5/README.md).
The cases add the declared forms.

Generate with `node scripts/build-directory-options.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/directory-options.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
