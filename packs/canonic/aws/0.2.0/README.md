# AWS permissions 0.2.0

Requires Shield `>=0.20.0, <1.0.0`.

AWS CLI and bound MCP operation coverage, variables and connector definitions
follow [0.1.0](../0.1.0/README.md). Explicit profiles, blocked profiles, regions
and local emulator settings retain their original checks.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Listed metadata, identity and help | Allow | Allow | Allow |
| Account data, remote changes, execution, sessions and access administration | Allow | Ask | Ask |
| Destructive resource deletion | Ask | Ask | Deny |
| Secret values, decrypted credentials and explicit credential export | Ask | Deny | Deny |
| Local output files, scripts, transport overrides and unclassified requests | Ask | Ask | Ask |

Rules with local-file output keep review because the pack cannot establish their
destination's containment. A request may match more than one effect: Lambda
invoke with an output file therefore still asks in Loose. Sensitive configuration
retains its separate Allow/Ask/Ask decision. Region/profile gates can deny before
any profile allowance, including for MCP tools whose scope cannot be established.
Changing access is reviewable; returning credentials remains a disclosure boundary.
KMS access grants are distinguished from scheduling destruction of a key, which
retains the destructive decision.

Ask follows host approval or the configured fallback. Profiles do not inspect
executed Python or sandbox cloud/local descendants.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
