# Git permissions 0.12.3

Requires Shield `>=0.58.0, <1.0.0`.

Loose and Recommended allow `git ls-tree` with explicit repository selectors
when the working directory and the supplied `--git-dir` and `--work-tree`
paths resolve inside the project. This includes listing tracked migration
filenames from a local remote-tracking ref in a Gate checkout:

```sh
git --git-dir=.gate/repos/public/.git --work-tree=. ls-tree --name-only origin/staging supabase/migrations/
```

Strict reviews explicit repository selection. Outside or protected paths,
repeated selectors and Git directory pointers require review in every profile.
The same checks apply to `git log` as in [0.12.2](../0.12.2/README.md).

Generate with `node scripts/build-git-allow-by-default.mjs 0.12.3`.
Validate with `npm test -- --shield /absolute/path/to/shield scripts/git-repository-paths.test.mjs`.
