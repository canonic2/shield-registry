# Baseline permissions 0.14.0

Supports Shield `>=0.20.0, <1.0.0`.

`rg` searches are decided by the paths they read rather than a list of options.
Shield reads ripgrep options the way ripgrep does, anywhere before `--`, so
`rg -n PATTERN src -g '*.ts'` checks `src`, and options that only shape
matching or output, such as `--sort`, `-o`, `--json` or `-e PATTERN`, are
allowed. `-f` pattern files and `--ignore-file` files are checked like explicit
files, and `--hidden` searches check every existing entry below each folder.
Outside or protected paths, `--pre`, `--pre-glob`, `-z`, `--hostname-bin`,
`-L`/`--follow`, a `-` operand and options ripgrep does not define are
refused. `rg --version`, `--help` and `--type-list` are allowed. Shield builds
whose ripgrep model predates this release refuse the forms they cannot read,
as before.

These read-only commands are allowed in every profile:

- `ps` with `-o` fields that exclude the command line and environment, such as
  `ps -axo pid,ppid,comm`. Fields such as `command` or `args`, `ps aux` and
  default columns still ask, because command lines can hold credentials.
- `date` with `-u`, `-d`, `-v` and a `+FORMAT`. Setting the clock still asks.
- `pgrep` by name, user, parent or session. `-l`, `-a` and `--list-*`, which
  print command lines, and `-F` PID files still ask.
- `pg_isready` with its connection options.
- `jq` filters that read only their input, on standard input or files in
  approved paths, such as `jq '{head_sha,event}'`, `select`, `map`, `$name`
  variables, `-n` and `--arg NAME VALUE` (one `--arg` or `--argjson` on
  standard input). `env`, `$ENV`, `include`/`import`, program-path builtins,
  `-f`, `-L`, `--slurpfile`, `--rawfile` and `--args` still ask, and protected
  files are still refused.
- `docker ps`, `docker images`, `docker compose ps`/`ls`, `docker version`
  and `ls` of images, containers, networks, volumes and contexts. `--no-trunc`,
  `--format`, `docker info`, `inspect`, `logs`, `exec`, `run`, global
  options such as `-H` and every change still ask.

Other rules, profiles and cases match [0.13.0](../0.13.0/README.md).

Generate with `node scripts/build-baseline-everyday-reads.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/baseline-everyday-reads.test.mjs`.
Published previous releases retain their original bytes.

Licensed under MIT.
