# Baseline permissions 0.2.0

`canonic/baseline` supplies standard command and file permissions in 71 shared
rule bodies, reduced from the 149 bodies of 0.1.5. It requires Shield 0.1.1 or
later within the 0.1 series. Decisions, requirement branches, reasons, guidance,
credential exclusions and fallback behavior retain the reviewed 0.1.5 policy.

Identical argv policies share one body with an explicit `executable.one_of`
family. Only disjoint executable aliases with otherwise identical predicates and
metadata are combined. Bare names, `/bin/` and `/usr/bin/` aliases remain explicit;
there are no inferred wrappers or executable regular expressions. File rules and
tool-specific grammars remain separate. This uses existing structured v1 selectors,
not Git's invocation groups or command membership.

Shared families have `shared-` IDs. Their individual 0.1.5 rule IDs are listed as
`source_rule_ids` in [commands.json](commands.json) for audit. A rule override on
a shared ID applies to its whole explicit family; old individual IDs are not
aliases for that shared body. Review overrides when selecting this version.
Published older releases retain their original policy and IDs.

The [0.1.5 guide](../0.1.5/README.md) describes the permission profiles, supported
forms and path restrictions. This pack does not execute submitted commands or
establish sandbox containment.

## Validation and maintenance

`node scripts/build-baseline-compact-pack.mjs` builds this release from the same
reviewed source as 0.1.5. Generation of 0.1.5 remains byte-for-byte reproducible.
Tests reconstruct every original rule from the shared bodies and exact alias
membership. The production evaluator checks all 387 independent decision fixtures
and compares complete explanations after resolving family IDs to the relevant
source member and sorting match rows by that identity. Every matched decision,
applied flag, requirement fact and guidance field is compared. Both versions run
the 507 native hook and resource-path cases,
including outside paths, protected metadata, links and unavailable roots.

Policy, fixtures, inventory and license are versioned together. Licensed under MIT.
