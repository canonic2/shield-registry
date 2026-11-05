# Permission pack profile review

The maintained pack families are Baseline, Git, Node, Rust, AWS, GitHub, Gate,
Box and Testrun. Their reviewed releases distinguish routine work, privileged
operations requiring review, and concrete refusal boundaries. Published versions
are immutable; adopting these versions requires a reviewed update to an
installed policy.

All nine releases require Shield `>=0.20.0, <1.0.0`.

| Pack | Version | Corrected legitimate operations |
| --- | --- | --- |
| Baseline | 0.11.0 | Unsupported reader fallbacks ask; privilege/mount changes ask; disk list/info allows; container/cloud deletions are reviewable outside Strict |
| Git | 0.8.0 | Fetch/push, rebase, viewers, maintenance, clean worktree removal and configuration are reviewable; ordinary command rules outrank mixed command-set fallbacks |
| Node | 0.4.0 | Strict reviews dependency installs and edits; authentication/configuration, global operations and publication are reviewable; explicit credential reads stay denied |
| Rust | 0.2.0 | Strict reviews dependency edits/fetch/vendor, cleanup, installation, registry selection and plugin/override syntax |
| AWS | 0.2.0 | Strict allows listed metadata and reviews account data, changes, execution, sessions, access changes, local output and unknown operations |
| GitHub | 0.3.0 | Merges, administration and versioned remote edits use Allow/Ask/Ask; merged-branch cleanup follows merging |
| Gate | 0.2.0 | Fetch allows; push, setup, migration and policy acceptance are reviewable; explicit MCP project selection does not assume unused destructive arguments |
| Box | 0.2.0 | Setup, sync, discovery, agent conversations, raw execution and environment overrides are reviewable; project selection reflects actual resource-deletion arguments |
| Testrun | 0.2.0 | Setup, signing, inline builds, launch/build environment overrides and unknown operations are reviewable |

## Profile model

Listed reads generally allow in every profile. Routine project mutations allow
in Loose and Recommended and ask in Strict. Supported privileged operations
normally allow in Loose and ask in Recommended and Strict. Raw code, opaque
commands, partial token scans and unknown syntax can ask in every profile;
unknown is not itself a reason to deny. Conservative risk-token predicates
cannot establish Allow, so their review remains explicit.

Destructive forms generally ask in Loose and Recommended and deny in Strict.
Credential disclosure, destructive system operations, protected administration,
out-of-scope targets and failed explicit path proofs retain their concrete
refusals. AWS secret-returning operation classes retain their disclosure policy.
No change converts failed path, package-manager, profile, region or repository
preconditions into an allowance. Project-script review remains explicit.

MCP project-selection handling evaluates supplied arguments. For example, Gate
push with an explicit project asks; adding force-with-lease retains the
destructive decision. Box removal that keeps a checkout asks; deleting it retains
the destructive decision. CLI and matching MCP effects are exercised together.

Ask follows the integration's approval handling, including a configured Codex
fallback that can allow Ask without displaying a prompt. These profile choices
do not establish containment of executed code or individual human approval.

## Sources and verification

`scripts/build-reviewed-profiles.mjs` derives eight releases from their
maintained sources, preserving path requirements, on-unmet boundaries and
preconditions. It separates mixed operation groups where necessary. The shared
tool builder accepts version-specific category decisions while keeping the
published 0.1.0 Gate/Box/Testrun generators reproducible. GitHub's release uses
`scripts/build-github-usable-pack.mjs`.

Independent expectations are in `scripts/build-reviewed-profile-cases.mjs` and
`scripts/build-github-usable-cases.mjs`. Run focused policy verification with:

```sh
npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs
npm test -- --shield /absolute/path/to/shield scripts/reviewed-composition.test.mjs
npm test -- --shield /absolute/path/to/shield scripts/reviewed-boundaries.test.mjs
npm test -- --shield /absolute/path/to/shield scripts/github-usable-pack.test.mjs
```

The fixtures cover standalone decisions, all profiles, CLI/MCP neighbors,
Baseline composition, token disclosure, destructive options, manager selection
and cloud/repository boundaries. Structural assertions preserve existing path
and precondition definitions. Tests evaluate submitted requests; they execute no
GitHub merges, cloud operations, device actions or publication. New flags and
tool versions still need coverage; this review does not claim every possible
command form is recognized or that live agent approval succeeds.

Before raising the minimum to 0.20.0, focused verification passed with a Shield
0.19.0 development executable: 846 scenario/profile cases across the nine candidates, with targeted
Baseline composition checks (135 case evaluations, including the KMS boundary).
Existing checks were reused when their covered rules and inputs stayed unchanged.
Candidate reproduction, schema validation, preserved requirement/precondition
assertions and scoped whitespace checks passed.

Release validation with installed Shield 0.20.0 passed the full registry suite:
133 tests passed, 31 historical compatibility checks skipped, and no failures.
The release tool verified the nine new packs through the production evaluator,
signed catalog sequence 32, and authenticated the resulting publication while
preserving every retained release. Rust's policy uses compact JSON to fit the
existing 1 MiB artifact bound; parsed-policy reproduction and a size regression
check passed. Live agent, cloud, device and installation acceptance were not run.
