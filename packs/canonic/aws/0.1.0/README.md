# AWS permissions 0.1.0

Public permission policy for the AWS CLI v2 (`aws`) and explicitly bound AWS MCP
connections. Requires Shield 0.10 with the capabilities declared in `pack.yml`,
including MCP integrations, connection facts and effective-field mappings.
Older builds refuse this pack. Installing policy does not install the AWS CLI or
configure credentials.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Help, version, caller identity, local profile listing and non-secret `configure get` | Allow | Allow | Allow |
| Metadata inspection: `describe-`, `list-`, `get-`, `batch-get-`, `search-` and similar, `s3 ls`, `logs tail` | Allow | Allow | Ask |
| Configuration that commonly embeds secrets: Lambda function configuration, ECS task definitions, EC2 user data | Allow | Ask | Ask |
| Customer data and records: DynamoDB scans and items, log events, query results, SQS messages, credential reports | Ask | Ask | Deny |
| Responses written to a local file: `s3 cp`/`sync`, `s3api get-object`, `lambda invoke` and every other `outfile` operation | Ask | Ask | Deny |
| Remote changes and execution: create, update, put, start, stop, tag, deploy, invoke, send, run, queries | Ask | Ask | Deny |
| Login, SSO and local configuration changes, `eks update-kubeconfig` | Ask | Ask | Deny |
| Secrets, decryption and credentials: Secrets Manager values, `ssm --with-decryption`, KMS decrypt, STS assume-role, login passwords and tokens | Ask | Deny | Deny |
| Deletion: delete, terminate, purge, `s3 rm`/`rb`/`mv`, `s3 sync --delete` | Ask | Deny | Deny |
| Access changes: IAM, SSO admin, Organizations and RAM changes; policies, permissions, grants, security-group rules, sharing, `s3 presign` | Ask | Deny | Deny |
| Followed log streams (`logs tail --follow`) | Ask | Ask | Ask |
| Certificate verification off or replaced, custom endpoints, unlisted syntax and unclassified operations | Ask | Ask | Deny |

Rules match `aws`, `/bin/aws`, `/usr/bin/aws`, `/usr/local/bin/aws` and
`/opt/homebrew/bin/aws`; other locations keep review.

## Setup questions

Adding the pack asks four optional questions. Each one left unset adds no check.

| Setting | Question | When set |
| --- | --- | --- |
| `profile` (saved locally) | Require agents to use one AWS profile? | Every agent `aws` command must pass `--profile` with that profile. |
| `blocked_profiles` | Block specific AWS profiles? Asked only when no profile is required. | Every agent `aws` command must pass `--profile` naming a profile outside the list. |
| `regions` | Restrict agents to specific AWS regions? | Every agent `aws` command must pass `--region` with one of the listed regions. |
| `local_endpoint` | Use a local AWS emulator endpoint? | Commands with exactly that `--endpoint-url` skip the profile and region checks and may change the emulator. |

Change answers later with `shield pack configure canonic/aws`, or noninteractively
with `--set profile=acme-read-only`, `--set 'blocked_profiles=["acme-prod"]'`,
`--set regions=eu-west-1,us-east-1` or `--set local_endpoint=http://localhost:4566`.

The profile and region checks deny before any other rule decides. A command that
passes them still gets its ordinary decision from the table, so a required
read-only profile does not turn deletions into Allow. Help, `--version` and
`configure list-profiles` pass the checks, since they reach no account.

Profiles and regions must be named on the command line. The AWS CLI prefers
`--profile` over `AWS_PROFILE` and credentials in the environment, and Shield
cannot see the environment an agent inherits, so a blocked default or ambient
profile could otherwise be used without notice. The checks find the options
anywhere in the command and in any abbreviation the CLI accepts, such as
`--prof acme-ro` or `--p=acme-ro`. A repeated option must satisfy the check
every time it appears.

## AWS MCP

Installing this pack does not create, enable or start an MCP server. In Shield's
project configuration, explicitly associate a connection with `hosted`, or use
`hosted-profile` to derive its connector profile from this pack's `profile`
variable. Both definitions use the reviewed CLI connector
`mcp-proxy-for-aws-cli@1.7.0` and the hosted us-east-1 endpoint. Setup installs
no connector or credentials. Other connector versions/shapes need their own
reviewed integration; a matching alias alone grants no pack permissions.

| MCP tool class | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Public documentation, skills and availability | Allow | Allow | Allow |
| Python `aws___run_script` execution | Ask | Ask | Deny |
| `aws___get_tasks` results | Ask | Ask | Deny |
| `aws___get_presigned_url` access grants | Ask | Deny | Deny |
| Unknown tools | Ask | Ask | Deny |

CLI inspection allowances do not classify Python scripts. The documented hosted
tool inventory is used; no `call_aws` command-field schema is assumed.

When `profile` is set, API calls require the same single explicit
`AWS_MCP_PROXY_PROFILES` launch setting. The profile mapping uses that known
default when `aws_profile` is omitted, and checks an explicit field even when
the default is allowed. Null, wrong types and disallowed profiles deny. This
describes the connector's signing profile, not a hard remote account boundary.
The reviewed connector's per-call switching middleware is enabled only with
multiple profiles; merely submitting `aws_profile` cannot establish a safe
profile for an ambient or mismatched connection.

`blocked_profiles` similarly requires one reviewed connector profile outside
the list; ambient or multi-profile connections cannot satisfy this restriction.
Setting `regions` blocks API/script/task and unknown tools because a connection's region
metadata cannot constrain all regions selected by Python. Knowledge tools keep
their own decisions. `local_endpoint` applies to CLI commands only.

Profile values supplied locally stay in Shield's private stdio launcher state;
they are not copied into shared host files. Connection changes require terminal
review and setup, followed by an agent restart. Current source-based coverage
does not establish live AWS authentication or hosted-schema acceptance.

Sources reviewed 2026-10-28:
[AWS tool reference](https://docs.aws.amazon.com/agent-toolkit/latest/userguide/understanding-mcp-server-tools.html)
and [connector 1.7.0](https://github.com/aws/mcp-proxy-for-aws/tree/v1.7.0).

## Local emulator

With `local_endpoint` set, for example to `http://localhost:4566` for LocalStack,
commands whose `--endpoint-url` is exactly that value are allowed in Loose and
Recommended and ask in Strict, deletions included. The value must name a
loopback address. Operations that write local files at a named path, change
this machine's configuration or start local processes keep their ordinary
decisions: for example `s3 cp`, `s3api get-object`, `configure set`,
`emr ssh`/`socks`/`get`/`put`, `ec2-instance-connect ssh`/`open-tunnel`,
`ssm start-session` and `ecs execute-command`. The exclusion is by operation
name, so `ddb put` to the emulator also keeps its ordinary decision. Any other
endpoint asks. When `--endpoint-url` is repeated, the CLI uses the last value,
and so do these checks; repeated `--profile` and `--region` values must each
pass.

## Classification

Operations are classified by the leading word of their name, taken from the
CLI's own command index for all 418 services. A word's class applies across
services, and listed exceptions can only make a decision stricter: when two
rules of equal specificity match, the stricter decision wins.

- Exceptions cover reads that return secrets or credentials, customer data,
  configuration that embeds secrets, and the 62 operations whose response the
  CLI writes to an `outfile` path. Every read operation's output was searched
  for credential-like member names and for documentation describing secrets in
  the response, such as a provider's `client_secret` inside free-form details,
  and each candidate was reviewed by hand. Fields AWS masks, and fields holding
  only a reference such as a secret's ARN, are not exceptions. Responses that
  include credentials only in some configurations ask in Recommended.
- Words with mixed meanings stay unclassified and ask: `generate`, `query`,
  `scan`, `select`, `translate`, `sign`, `retrieve`, `verify` (SES sends a
  verification email), `detect` (CloudFormation starts a drift run; Comprehend,
  Rekognition and Textract upload content for analysis), `compare` and
  `evaluate`.
- Reads by name that create, send or grant something are exceptions too:
  `cognito-identity get-id`, `get-user-attribute-verification-code`,
  `check-in-license`, and URLs that grant access to whoever holds them, such as
  presigned console, embed, attachment and stream URLs.
- `sqs receive-message` reads like inspection but hides messages from other
  consumers; it is classified as data.
- Disabled or replaced certificate verification and custom endpoints add
  review without softening a stricter decision: a deletion or secret read with
  `--no-verify-ssl` or another endpoint stays denied in Recommended.
- Option-dependent exceptions check the option anywhere in the command:
  `--with-decryption`, `--include-value(s)`, `--follow` and `s3 sync --delete`.

## Limits

- `file://` and `fileb://` parameter values read local files and send their
  contents to AWS. Rules do not inspect parameter values.
- `--cli-input-json` and `--cli-input-yaml` supply parameters Shield does not
  inspect. The operation name still decides, except where a decision depends on
  a parameter: SSM parameter reads and API Gateway key reads with JSON or YAML
  input get the same decision as `--with-decryption` or `--include-values`.
- `--debug` prints full requests and responses, which may include secrets
  returned by an otherwise allowed read.
- Inline assignments such as `AWS_CONFIG_FILE=… aws …` are reviewed by Shield
  itself, which asks for every inline environment assignment.
- The classification covers the CLI version whose command index it was taken
  from. Operations added later follow their leading word, or ask when it is
  unclassified.

## Composition

Baseline denies `aws s3 rm` and `aws s3 rb` at the start of a command in every
profile, so with Baseline installed those deny even in Loose. Baseline's generic
cloud review yields to this pack.

## Source maintenance

Reviewed command data lives in `scripts/aws-policy.mjs`. Generate policy and
inventory with `node scripts/build-aws-pack.mjs`, and independent expectations
with `node scripts/build-aws-cases.mjs`. Run focused production evaluation with:

```sh
npm test -- --shield /absolute/path/to/shield scripts/aws-pack.test.mjs scripts/aws-mcp.test.mjs
```

Review and sign through the documented registry release workflow; source
generation never publishes a catalog.

Licensed under MIT.
