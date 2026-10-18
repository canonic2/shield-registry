# Git permission pack 0.5.0

`canonic/git` **0.5.0** is a compact-source release requiring Shield 0.1.1 or later
within the 0.1 series. It preserves the
reviewed permission behavior, guidance and rule identities of 0.4.1 across all
173 command names and 1,023 decision fixtures.

The source stores 110 rule bodies, 173 command members and one invocation group.
That group declares `[]`, `[--no-pager]` and `[-P]` as leading argument alternatives.
The engine retains shared bodies and reconstructs each matched identity for
evaluation evidence and exact rule lookup. It does not generate 837 rule copies.

The pack requires `structured-rules-v1`, `argument-rules-v1`,
`invocation-groups-v1` and `command-sets-v1`. Clients without these capabilities
refuse the artifact. Its [policy](pack.yml), [command inventory](commands.json)
and [decision fixtures](cases.json) are published together in the signed catalog.

## Permissions and boundaries

The [0.4.1 guide](../0.4.1/README.md#profiles) describes the unchanged profile
decisions, option coverage, examples and execution boundaries. Known destructive
families retain their restrictive baselines; unclassified requests ask. Custom
project rules can override pack decisions. This pack does not execute commands,
resolve Git aliases or establish sandbox containment.

Whole-policy comparison can establish identity for unchanged selected artifacts;
different shared invocation languages receive incomplete coverage unless a
supported proof applies. Request evaluation and exact matched-rule inspection
use the complete declared groups.

## Maintenance

`node scripts/build-git-compact-pack.mjs` builds this release directly from the
reviewed Git policy definitions. `build-git-pack.mjs` retains byte-for-byte
reproduction of 0.4.1. The compact test expands only its small independent
reference to verify all 837 original rules, then compares the production core's
1,023 complete fixture explanations with 0.4.1.

This source change has no measured native latency claim. Signing and publication
use the registry's validated release workflow. Licensed under MIT.
