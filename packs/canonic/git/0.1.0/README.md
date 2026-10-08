# Git 0.1.0

This release provides literal-argument rules for a small set of Git forms.
See [Git 0.2.0](../0.2.0/README.md) for the complete command inventory and
option-aware policies. The executable matcher is the literal name `git`; wrappers and
absolute paths do not inherit its permissions. Agent interception and native
execution support are separate Shield capabilities.

| Literal request | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| `git status`, `git log`, `git diff` | Allow | Allow | Allow |
| `git commit` | Allow | Allow | Ask |
| `git push origin main` | Ask | Ask | Ask |
| `git push --force …`, `git push -f …` | Ask | Deny | Deny |
| `git reset --hard …` | Ask | Deny | Deny |
| Every unmatched form | Ask | Ask | Ask |

The pack does not establish a configured remote scope, so push asks even in loose.
Read and commit allowances describe only those exact argv forms. They do not
prove safe execution: Git can consult configuration and invoke helpers or hooks.
Install only for literal policy testing until the executing host establishes the
required resource/effect boundary. Unknown options, global options, alternate
force argument ordering, aliases and commands absent from the table ask.

No staging forms are allowed yet. No shell, filesystem containment or whole-tool
coverage is supplied by this pack. There are no dependencies or settings.

The pack uses `schema_version: 1` and `argv-v1`. Its structural definition is
[the policy schema](../../../../schemas/policy.schema.json); it enables neither
effect predicates nor dependencies.
