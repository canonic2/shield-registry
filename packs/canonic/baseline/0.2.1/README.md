# Baseline permissions 0.2.1

`canonic/baseline` supplies standard command and file permissions in 71 shared
rule bodies. It requires Shield 0.1.6 or later within the 0.1 series.
Declared profile decisions, rule identities and credential exclusions match
0.2.0. Ripgrep guidance describes the current bounded resource model. Twelve
current-engine fixture expectations allow the newly modeled search forms;
published historical fixtures retain their original bytes.

## Ripgrep

Use `--no-config` to prevent configuration from adding helpers or link following.
Filename listings support ordinary glob filters:

```sh
rg --no-config --files -g '*.rs'
```

Content searches can honor ignore files and glob filters in approved directories:

```sh
rg --no-config -n PATTERN src
rg --no-config -g '*.rs' -n PATTERN src
```

Shield conservatively accounts for hidden entries when ignore-file negations or
globs could expose them. Content searches that could reach excluded credentials,
Shield state, its cache or sensitive agent settings remain protected. Narrow the
directory when the footprint is ambiguous or exceeds the bounded metadata check.
The native check examines at most 1,024 entries and 32 directory levels without
following descendant links or reading file contents. Filename listings do not
need that content check. Explicit protected-state access remains blocked.

`--no-ignore` without glob filters supplies a visible-only footprint when that is
the intended search. Helpers, link following, hidden overrides and pattern files
are outside the supported grammar. Policy checks do not establish OS isolation.

See the [profile and command guide](../0.1.5/README.md) for the other baseline
commands and [commands.json](commands.json) for shared family membership.

## Validation

`node scripts/build-baseline-search-pack.mjs` regenerates policy and copies the
independent decision fixtures with those twelve explicit updates, and copies
the unchanged command inventory and license.
Production validation covers all 387 decision fixtures and 549 native adapter
and resource-path cases across the three profiles. Published releases remain
immutable. Licensed under MIT.
