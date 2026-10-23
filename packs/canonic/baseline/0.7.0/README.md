# Baseline permissions 0.7.0

Everyday inspection and local file operations within approved paths, plus
declared build and quality-tool forms. Requires Shield 0.2 or 0.3.

## Project scripts

npm, pnpm and Yarn project scripts **Ask in every profile**, including familiar
names such as test, build, lint and dev, explicit `run` forms, and declared
workspace/filter/directory routes. A script name does not establish harmlessness.
Custom shorthand that has no rule also asks. Public packs do not collect
individual projects' script names or grant blanket script execution.

The agent should inspect the script definition, lifecycle hooks and arguments.
When its effects are appropriate for the task, it can propose a narrow project
rule through `shield_policy_propose`, explaining the effects in `agent_reason`,
then submit the returned exact `apply_arguments` to `shield_policy_apply` for
user review. Proposing does not approve the current command or activate policy.
Allowing one invocation in the host is distinct from changing project policy.

Dependency inspection forms such as npm ls/list/outdated/explain/why and
pnpm/Yarn list/why/outdated keep their declared Loose/Recommended Allow and
Strict Ask decisions. These inspection rules yield to more specific ecosystem
policy. Dependency installation, arbitrary package execution and publication
require review unless another installed pack or project rule decides them.

## Reads and lookups

Declared version/help and identity/lookups allow in every profile. Bounded
project readers include rg, sed, awk, jq, sort, cut, diff, cmp, nl, comm, paste,
column and pagers. File inputs must be regular files within approved read roots;
credential paths, private state and outside paths remain protected. Ordinary
stdin transformations allow. Unknown options, helper/program loading and
ambiguous footprints require review.

Ripgrep filename listings support hidden names; content searches keep their
existing bounded footprint checks. Ambient executable and tool configuration
remain trusted. These permissions are not a runtime sandbox.

## Writes, builds and checks

Declared local file writes, moves, removals, sed edits, tee output, links and
permission/ownership changes allow in Loose/Recommended and ask in Strict.
All required targets follow approved write/read roots; `.git` and Shield state
remain protected. Reference files and unmodeled traversal keep review. Shield's
native protected-path boundary separately controls policy and agent settings.

Declared Cargo, Go, Make and named quality-tool forms retain their existing
profile decisions: Loose/Recommended Allow, Strict Ask. These execute project
code and configuration; they do not establish containment. See
[commands.json](commands.json) for effective rule identities and pack.yml for
the exact grammar. Node project scripts are governed by the review boundary above.

## Refusals

Environment/secret dumps, privilege escalation, device/system administration and
listed destructive cloud/container forms deny in every profile. Unmodeled
operations retain review. Native unsupported-source and protected-path refusals
cannot be fixed by installing a permission pack.

## Validation

Generate policy, fixtures and inventory with
`node scripts/build-baseline-script-review.mjs`. The independent fixture changes
cover script review; other fixture outcomes remain unchanged. Run the focused
`scripts/baseline-script-review.test.mjs` through the documented `npm test -- --shield
/absolute/path/to/shield` runner. Published historical releases remain immutable.
Licensed under MIT.
