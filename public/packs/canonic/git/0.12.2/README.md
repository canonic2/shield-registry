# Git permissions 0.12.2

Requires Shield `>=0.58.0, <1.0.0`.

Loose and Recommended allow `git --git-dir=.git --work-tree=. log --oneline`
when the working directory and both explicit paths resolve inside the project.
Either selector works alone. Both accept a separate value or an equals sign.
An initial `-C` changes the base for relative paths. Strict reviews explicit
repository selection.

Outside or protected paths, Git directory pointers, repeated selectors, file
output, external diff and text conversion options require review. The path
check covers the submitted selectors. Git still loads the selected repository's
configuration and object storage as usual.

Other commands follow [0.12.1](../0.12.1/README.md).

Generate with `node scripts/build-git-allow-by-default.mjs 0.12.2`.
Validate with `npm test -- --shield /absolute/path/to/shield scripts/git-repository-paths.test.mjs`.
