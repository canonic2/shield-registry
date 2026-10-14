# Baseline permissions 0.1.1

`canonic/baseline` supplies standard command and file defaults for an installation
with one pack. This source release requires Shield's `access-paths-v1` capability.
It contains 125 structured v1 rules and 267 independent decision fixtures.
The signed public catalog is maintained separately from this reviewed source.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed text/identity commands and bounded file inspection | Allow | Allow | Allow |
| Removal, copying, moving and typed writes in approved writable paths | Allow | Allow | Ask |
| Bounded mkdir/touch writes in approved writable paths | Allow | Allow | Ask |
| Removal/writes outside approved writable paths, or unverified resources | Deny | Deny | Deny |
| Protected metadata or removing an approved root itself | Deny | Deny | Deny |
| Unmodeled scripts, builds, search helpers, cloud and network operations | Ask | Ask | Ask |
| Listed privilege, device/destructive system and direct destructive cloud forms | Deny | Deny | Deny |

The project is the default readable and writable root. `rm` and `rmdir` are allowed
in Loose and Recommended **only inside approved writable roots**; Strict asks
there. Additional read-only directories never expand removal scope. All affected
operands must pass; one outside operand blocks the whole request.

## Additional paths

The operator adds native absolute directories to the project's `.shield/config.yml`:

```yaml
access_paths:
  read: [/path/to/reference]
  write: [/path/to/scratch]
```

Preserve the existing configuration fields and review the manual changes with
`shield policy`. Confirmed activation changes the bound roots and rebuilds the
compiled policy. Write roots also permit reads. The project stays included; a
hook request cannot provide or activate its own roots. At most 64 additional
directories are supported. Missing/unobservable configured roots block positive
location requirements. Native hook cwd stays within the project; use absolute
operands for additional roots.

Removal and writes exclude `.git`, `.shield`, `.claude`, `.codex`, and `.mcp.json`
under every writable root. Recursive removal/move also rejects ancestors of these
locations, including roots without currently existing metadata. A separate rule
preserves writable roots themselves, including roots nested in the project.
Removal of a symlink entry within an approved root can be allowed; following that
link to remove/read an outside descendant is denied. Existing ancestor links and
effective copy/move destinations are checked by Shield's operation model.

Reads exclude `.ssh`, `.aws`, `.config/gcloud` and `.kube` under each readable
root, following the common legacy credential-directory restrictions.

## Command coverage

Rules recognize bare command names and their `/bin/` and `/usr/bin/` spellings.
Submitted executable identity is unverified; arbitrary alternate installations
and renamed scripts remain outside these selectors.

- Bounded `cat`, `head`, `tail`, `wc` and nonrecursive `ls` read operands use the
  readable root union. Head/tail accept numeric `-n`/`-c` counts and a historical
  `-N` count as the first argument, with listed flags; `tail -F`, recursive listing
  and unknown options are denied. Cat/head/tail/wc without operands read stdin
  with the same listed options, as in `| head -50` or `| wc -l`. Shell
  redirections receive independent typed file checks; Shield itself allows
  `/dev/null` targets and numbered descriptor copies such as `2>&1`.
- `rm` accepts `-f`, `-i`, `-r`, `-R`, `-v` and `--` with nonempty operands.
  `rmdir` accepts plain operands and `--`. Unknown options deny. The pack uses
  portable short forms; GNU-only long options remain outside this release.
- `grep` accepts a positional pattern and explicit regular files within readable
  roots. Recursive grep, stdin, pattern files and unlisted options deny.
- `rg` accepts a positional pattern and explicit regular files or directories
  within readable roots. Use `rg --no-config --no-ignore PATTERN .` for the project
  or supply approved absolute directories. Configuration and ignore-file loading
  must be disabled; ignored visible files are consequently included. Directory
  searches skip hidden descendants and follow no descendant links. Listed short
  inspection flags, `--no-follow`, `--no-hidden` and `--` are supported. Hidden/follow
  overrides, unrestricted modes, globs, pattern files, helpers and implicit roots
  deny. Missing/unavailable roots, explicit excluded credential directories and outside
  symlink operands deny. Shield verifies the bounded footprint without walking
  the project; canonical aliases exposing protected directories remain blocked.
- `mkdir` accepts plain operands and `-p`; `touch` accepts plain operands and
  `-a`, `-m`, `-c`. Both use writable roots and metadata exclusions, allowing
  Loose/Recommended and asking Strict. Outside/mixed targets,
  unknown options and symlink escapes deny. mkdir operands containing `..` deny
  because parent creation can affect paths absent from the final resolved target.
  Touch reference/date options and its special `-` operand deny.
  For search and mkdir/touch, options precede operands. Use a leading `--` for
  literal option-like operands; trailing option-like tokens otherwise deny.
- Nonrecursive `cp` accepts `-i`, `-n`, `-v`: readable sources and writable
  destinations. `mv` accepts those flags: writable/removable sources and writable
  destinations, including replacement removal. Recursive copies and unlisted
  options deny rather than guessing their footprint.
- Typed file read/write/remove/copy/move requests use the same roots. Current
  native hooks reach bound Claude reads and analyzed shell redirections; they do
  not expose every typed file family. Full normalized-domain behavior belongs to
  Shield's core acceptance tests.
- `pwd`, selected `uname`, bare `date`, numeric `sleep`, text printing/path-name
  commands, empty constant commands, listed tool version checks and bounded
  `git status` are allowed. Git's broader workflows belong to `canonic/git`.
- Interpreters/build runners, shell scripts, unmodeled search tools and
  file mutation tools without verified target models, remote/cloud
  inspection and network clients require review. Direct listed destructive forms
  such as `aws s3 rm`, `kubectl delete`, `terraform destroy` and Docker prune deny.
  Global option rewrites of those forms require review unless another rule applies.

These are interception decisions, not operating-system containment or execution
attestation. A tool's environment/configuration, filesystem races and an agent
running an approved script can extend beyond inferred literal effects. Other packs
and custom rules participate in Shield's resolver and can change the outcome.
Claude can request approval; Codex's configured Ask fallback is separate. Choosing
Codex Allow fallback permits Ask, including unmatched requests. Deny still blocks.

## Review provenance and verification

The review examined eight available legacy project shell policies, filesystem
settings and the legacy `localFileCommandDecision`/`removableLocalFileDecision`
implementation. Nine historical snapshots from four repositories dated June 19,
August 4/16/17/22 and October 3/4, 2026 were also examined. Their common reads and
project file workflows informed this pack. Project-specific credentials, cloud
resources, script paths and consumer directory lists are not distributed.

The legacy common read families were cat/head/tail/ls/wc/grep/rg/sed/find. Older
policies broadly permitted project scripts; later policies used approved roots,
protected metadata, explicit removal modes and narrow cloud inspection forms.
Only operations whose paths Shield can currently verify receive baseline path
Allows. Builds/interpreters and unmodeled tools remain Ask; unsupported forms of
bounded tool families deny through their unmet requirements.

Regenerate and verify from the registry root:

```sh
node scripts/build-baseline-pack.mjs
node scripts/build-baseline-cases.mjs
node scripts/build-policy-schema.mjs
RG_BINARY=/absolute/path/to/rg SHIELD_BINARY=/absolute/path/to/shield npm test
```

`baseline-pack.test.mjs` checks reproducibility, schema/core admission, all profile
decisions, applied requirement facts and guidance. `baseline-native.py` creates
isolated projects/homes/cache roots, confirms real production initialization via
a PTY, prepares caches and launches a fresh hook process per request. It checks
447 native Claude/Codex cases across all profiles, including approved roots,
read-only roots, mixed targets, nested roots, symlinks, redirections and unavailable
roots. Submitted commands are data and never execute; fixture files remain intact.
Python is only the fixture driver. This is macOS acceptance; native Linux/Windows
coverage is not established by these runs.

The independent tool-contract probe runs ripgrep 15.2.0 against owned neutral
fixtures. It verifies hidden descendants, file/directory links, poisoned
configuration and ignore-file overrides. Submitted hook commands never execute;
this separate probe checks the modeled tool's actual traversal behavior.
The model follows ripgrep's [15.2.0 traversal implementation](https://github.com/BurntSushi/ripgrep/blob/15.2.0/crates/core/flags/hiargs.rs).
Run the registry tests with `RG_BINARY=/absolute/path/to/rg` as well as
`SHIELD_BINARY`; its observed native contract is macOS ripgrep 15.2.0.
