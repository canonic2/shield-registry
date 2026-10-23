# Baseline permissions 0.6.0

Everyday commands, project builds and tests, and local file operations within
approved paths. Harmful forms are denied rather than left for review: secret and
environment dumps, privilege escalation, device and system administration, and
known destructive cloud/container commands. Requires Shield 0.2.0 or later
within the 0.2 series. The pack stores 140 rules.

## Everyday reads and lookups

These forms allow under all three profiles:

```sh
rg -n PATTERN src
rg --files --hidden -g '!.git'
sed -n '1,200p' README.md
sed 's/token/<redacted>/g' config.json
awk -F: '{print $1, $2}' input.txt
jq -r '.name' package.json
sort -rn input.txt
diff -u before.txt after.txt
test -f README.md && echo present
type rg; which node; command -v rg; whoami; id -u; hostname -s; ulimit -n
realpath src; readlink -f link
du -sh src; stat README.md; file README.md; df -h
tree -L 2 -I node_modules
lsof -i :3000
nl -ba README.md; column -t -s, data.csv; paste -d, a.txt b.txt; comm -12 a.txt b.txt
less -N README.md; cat data.csv | column -t -s,
seq 1 10; expr 1 + 2; echo '2^10' | bc -l
```

Sed supports `p`, `d`, `y` and `s` scripts with line addresses/ranges, including `$`, using `/`, `|` or `#` delimiters, and `r` reads of named files within the read roots. Awk supports print statements
of numeric fields. Jq supports field/index selection and pipelines through keys,
keys_unsorted, length, type, sort, unique, values and tostring. Text filters can
also read standard input in pipelines. Inputs must be regular files within the
approved read roots; contained symlinks receive the same path checks.

`nl`, `comm`, `paste`, `column` and the `less`/`more` pagers read files
like `cat`, within the read roots and outside credential folders; `bc` reads
standard input only. Pager options that write files, such as `less -o`, ask.
`command -v`/`-V` and `ulimit` queries allow; setting a limit asks. `tree` options that
write or read lists (`-o`, `--fromfile`), `file -z`/`-m` and unlisted
`du`/`stat` options ask.

Ambient tool configuration is trusted. `rg --no-config` is optional. Submitted
program files, helper execution, environment expressions, other file loading
and output-file options need review. These are scoped read forms,
not general permission to execute awk/sed programs or arbitrary jq filters.

Credential directories, outside paths and Shield's private state remain protected.
Ripgrep honors ignore files and globs in bounded approved directories. Its native
content check examines at most 1,024 metadata entries and 32 levels; narrow an
ambiguous search. Filename listings accept `--hidden` and skip that content check. Explicit `--hidden` content searches remain outside the supported model. Explicit protected
state access remains blocked.

## Builds, checks and tests

Building, checking, formatting and testing the project run its own code, which
the agent can already edit. These allow in Loose/Recommended and ask in Strict:

```sh
cargo build; cargo test --locked; cargo +nightly fmt; cargo clippy -- -D warnings
go test ./...; go vet ./...; go mod tidy
make; make -j8 test; make -C packages/acme build; make test-focus FILTER=acme
npm test; npm run build -- --watch; npm --prefix packages/site run build; npm -w acme test
pnpm test; pnpm --dir packages/site run check; pnpm -r build; pnpm --filter acme lint
yarn test; yarn workspace acme build; yarn --cwd packages/site dev
tsc --noEmit; eslint .; prettier --check .; vitest run; jest; pytest -q; ruff check
```

Cargo covers build, check, test, run, bench, clippy, fmt, doc, tree, metadata,
nextest, llvm-cov, clean, fix, insta and deny. Go covers build, test, vet, fmt,
run, list, doc, generate and `mod tidy/download/verify/graph/why`. npm covers
run, test, start, ls, outdated and explain; pnpm and yarn cover run, test, start,
ls, why, outdated and the build, lint, typecheck, format, check and dev scripts.
Directory options (`make -C`, `npm --prefix`, `pnpm --dir`, `yarn --cwd`)
must name relative folders without `..` or hidden segments.

Dependency installs and additions, publishing, `npm exec`, `pnpm exec`/`dlx`,
`npx`, `uv run`, `cargo install`, `go install`/`get`, other makefiles and
global tool options before the subcommand keep review. Interpreters (`node`,
`python3`, `bun`, shells) keep review: Shield asks for them before policy.

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
where containment cannot be established.

`tee FILE`, `ln`, `chmod` and `chown` follow the write rules: every file they
write, link or change, including everything below a `-R` folder, must be within
the approved write roots and outside `.git` and Shield's state. A hard link
shares its source's contents, so its source must also pass the read rules; a
symbolic link stores only a path, and reading through it is checked later.
Reference files and link-following `-L`/`-H` traversal ask.

Network/cloud operations, `open`,
unlisted helpers and unknown operations retain their review paths.

## Denied

These deny under every profile:

```sh
printenv; env; env -0                     # environment dumps
security find-generic-password -w ...     # keychain secrets
gh auth token
hostname NEW-NAME
sudo ...; su; doas ...
dd ...; mkfs ...; diskutil ...; mount ...; shutdown ...
docker system prune; kubectl delete ...; terraform destroy; aws s3 rm ...
```

See the [usability review](https://github.com/canonic2/shield-registry/blob/main/docs/usability-review.md) for decisions and
remaining boundaries, and [commands.json](commands.json) for the rule inventory.

## Validation

`node scripts/build-baseline-path-models.mjs` reproduces this release from 0.5.0.
All 1023 decision fixtures run through production Shield.
Historical releases remain immutable. Licensed under MIT.
