# Baseline permissions 0.3.0

Usable standard reads and local file operations within approved paths. Requires
Shield 0.1.8 or later within the 0.1 series. The pack stores 84 shared bodies.

## Everyday reads

These forms allow under all three profiles:

```sh
rg -n PATTERN src
rg --files -g '*.rs'
sed -n '1,200p' README.md
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

Sed supports print addresses/ranges, including `$`. Awk supports print statements
of numeric fields. Jq supports field/index selection and pipelines through keys,
keys_unsorted, length, type, sort, unique, values and tostring. Text filters can
also read standard input in pipelines. Inputs must be regular files within the
approved read roots; contained symlinks receive the same path checks.

Ambient tool configuration is trusted. `rg --no-config` is optional. Submitted
program files, helper execution, environment expressions, extra file loading,
sed edits and output-file options need review. These are scoped read forms,
not general permission to execute awk/sed programs or arbitrary jq filters.

Credential directories, outside paths and Shield's private state remain protected.
Ripgrep honors ignore files and globs in bounded approved directories. Its native
content check examines at most 1,024 metadata entries and 32 levels; narrow an
ambiguous search. Filename listings skip that content check. Explicit protected
state access remains blocked.

## Other operations

Approved local file writes, moves and removals allow in Loose/Recommended and ask
in Strict. Read/write roots and protected metadata exclusions remain enforced.
Recursive copies, unknown mutation options and unresolved targets remain blocked
where containment cannot be established. Build scripts, interpreters, dependency
installs, network/cloud operations, unlisted helpers and unknown operations retain
their review paths. Privilege/device operations and known destructive cloud/container
commands remain denied.

See the [usability review](https://github.com/canonic2/shield-registry/blob/main/docs/usability-review.md) for decisions and
remaining boundaries, and [commands.json](commands.json) for the rule inventory.

## Validation

`node scripts/build-usable-packs.mjs` reproduces this release and Git 0.6.0.
All 513 decision fixtures run through production Shield. The combined pack suite
also checks 261 fresh native requests across both agents and all profiles,
including Codex PermissionRequest Allow/Deny/Ask and missing-context abstention.
Historical releases remain immutable. Licensed under MIT.
