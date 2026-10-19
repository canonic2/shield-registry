# Baseline permissions 0.2.2

`canonic/baseline` supplies standard command and file permissions in 71 shared
rule bodies. It requires Shield 0.1.7 or later within the 0.1 series.

## Ripgrep

Ordinary searches and filename listings work without extra flags:

```sh
rg -n PATTERN src
rg -g '*.rs' PATTERN src
rg --files -g '*.rs'
```

Shield trusts ambient ripgrep configuration. `--no-config` is optional when
config-free execution is desired. Shield evaluates submitted arguments and paths;
it does not inspect `RIPGREP_CONFIG_PATH` or check options injected by that file.
Explicit helpers, link following, hidden overrides and pattern files remain
outside the supported grammar.

Content searches can honor ignore files and globs in approved directories.
Shield conservatively accounts for hidden entries that these filters can expose.
Searches that could reach excluded credentials, Shield state, its cache or
sensitive agent settings remain protected. Narrow an ambiguous search directory.
The native check examines at most 1,024 metadata entries and 32 directory levels
without following descendant links or reading file contents. Filename listings
skip this content check; declared policy exclusions still apply.
`--no-ignore` without globs supplies a visible-only footprint when intended.
Policy checks do not establish OS isolation.

See the [profile and command guide](../0.1.5/README.md) for other commands and
[commands.json](commands.json) for shared family membership.

## Validation

`node scripts/build-baseline-search-pack.mjs --ambient-config` regenerates the
pack and independent fixtures. Six expectations explicitly admit ordinary
searches and listings without `--no-config`; historical releases retain their
original bytes. Production validation covers 387 decision fixtures and 603
native adapter and resource-path cases across three profiles. Licensed under MIT.
