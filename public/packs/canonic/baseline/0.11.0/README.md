# Baseline permissions 0.11.0

Reviewed profiles for everyday host commands. Requires Shield `>=0.20.0, <1.0.0`
with the capabilities declared in `pack.yml`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Supported reads, metadata and disk `list`/`info` | Allow | Allow | Allow |
| Supported project file changes | Allow | Allow | Ask |
| Privilege escalation and mount changes | Ask | Ask | Ask |
| Docker removal, Kubernetes deletion, S3 removal, hostname changes | Ask | Ask | Deny |
| Unsupported cat/head/tail/wc/grep syntax | Ask | Ask | Ask |
| Credential disclosure, raw disk writes, filesystem destruction, infrastructure destruction | Deny | Deny | Deny |

Explicit file/path requirements remain enforced. An unsupported reader spelling
requires review; a recognized read outside approved roots or into excluded
credential paths denies. Process metadata keeps the rules from
[0.10.0](../0.10.0/README.md), including review for full arguments or environments.
Project scripts keep their existing review requirement. Asking about `sudo`
does not evaluate its child as a transparent command or grant lasting privilege.
Only disk inspection is allowed; disk modification remains protected.

The pack does not sandbox descendants. Ask follows host approval or the
configured fallback and does not promise a displayed prompt.

Generate with `node scripts/build-reviewed-profiles.mjs` and
`node scripts/build-reviewed-profile-cases.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/reviewed-profiles.test.mjs`.
