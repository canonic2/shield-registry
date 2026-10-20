# Baseline permissions 0.4.0

Usable standard reads and local file operations within approved paths. Requires
Shield 0.1.13 or later within the 0.1 series. The pack stores 87 shared bodies.

## Everyday reads

These forms allow under all three profiles:

```sh
rg -n PATTERN src
rg --files --hidden -g '!.git'
sed -n '1,200p' README.md
sed 's/token/<redacted>/g' config.json
awk -F: '{print $1, $2}' input.txt
jq -r '.name' package.json
jq '.items | length' input.json
sort -rn input.txt
uniq -c input.txt
cut -d: -f1,3 input.txt
diff -u before.txt after.txt
cmp -s before.txt after.txt
date '+%Y-%m-%dT%H:%M:%S'
df -h
```

Sed supports `p`, `d`, `y` and `s` scripts with line addresses/ranges, including `$`, using `/`, `|` or `#` delimiters, and `r` reads of named files within the read roots. Awk supports print statements
of numeric fields. Jq supports field/index selection and pipelines through keys,
keys_unsorted, length, type, sort, unique, values and tostring. Text filters can
also read standard input in pipelines. Inputs must be regular files within the
approved read roots; contained symlinks receive the same path checks.

Ambient tool configuration is trusted. `rg --no-config` is optional. Submitted
program files, helper execution, environment expressions, other file loading
and output-file options need review. These are scoped read forms,
not general permission to execute awk/sed programs or arbitrary jq filters.

Credential directories, outside paths and Shield's private state remain protected.
Ripgrep honors ignore files and globs in bounded approved directories. Its native
content check examines at most 1,024 metadata entries and 32 levels; narrow an
ambiguous search. Filename listings accept `--hidden` and skip that content check. Explicit `--hidden` content searches remain outside the supported model. Explicit protected
state access remains blocked.

## Edits and other operations

Sed edits files in place with `sed -i '' SCRIPT FILE`, GNU `sed -i SCRIPT FILE`
or `--in-place`, and writes named files with `w`, `W` or the `w` flag. Edited and
written files must be within the approved write roots and outside `.git` and
Shield's review state; inputs follow the read rules. These allow in
Loose/Recommended and ask in Strict. Backup suffixes, other delimiters, regex
addresses, blocks and `e` need review.

Approved local file writes, moves and removals allow in Loose/Recommended and ask
in Strict. Read/write roots, `.git` and Shield's review state and cache remain excluded.
Agent settings and Shield policy files are left to Shield's own protected-path
guard and the operator's `shield protection` choice, so other files under
`.claude/` and similar folders follow these rules.
Recursive copies, unknown mutation options and unresolved targets remain blocked
where containment cannot be established. Build scripts, interpreters, dependency
installs, network/cloud operations, unlisted helpers and unknown operations retain
their review paths. Privilege/device operations and known destructive cloud/container
commands remain denied.

See the [usability review](https://github.com/canonic2/shield-registry/blob/main/docs/usability-review.md) for decisions and
remaining boundaries, and [commands.json](commands.json) for the rule inventory.

## Validation

`node scripts/build-baseline-sed-edits.mjs` reproduces this release from 0.3.1.
All 648 decision fixtures run through production Shield.
Historical releases remain immutable. Licensed under MIT.
