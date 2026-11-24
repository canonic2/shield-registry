# AWS CDK / SAM permissions 0.1.0

Requires Shield `>=0.53.0, <1.0.0`. Reviewed against the official CDK v2 and
SAM command references on 2026-11-23, including SAM CLI v1.174.0's root parser.
The source candidate provides CLI policy for `cdk` and `sam`.

| Operation | Loose | Recommended | Strict |
| --- | --- | --- | --- |
| Exact version and built-in help requests | Allow | Allow | Allow |
| CDK synthesis, diff, listing, metadata, context, initialization and diagnostics | Ask | Ask | Deny |
| CDK bootstrap, deploy, watch, import, migration, refactor, rollback and asset publication | Ask | Ask | Deny |
| SAM build, validation, initialization, local invocation, event generation and local servers | Ask | Ask | Deny |
| SAM packaging, deployment, sync, publication, pipelines and remote invocation | Ask | Ask | Deny |
| SAM listing, logs, traces and remote test events | Ask | Ask | Deny |
| CDK destroy, orphan and garbage collection; SAM delete | Ask | Deny | Deny |
| Unlisted syntax and future commands for the matched executables | Ask | Ask | Deny |

## Effects and review

CDK executes the configured application and pre-synthesis build, and can load
plugins. Synthesis, listing and diff can execute code, perform context lookups,
write cloud assemblies and bundle assets. Diff can create a CloudFormation
change set. A cloud assembly path or `--no-execute` retains review because
credentials, assets and remote effects still require inspection. Watch and
hotswap can deploy continuously. Bootstrap changes IAM and other resources.

SAM build can invoke build backends, dependency managers and Docker. Local
invocation executes application code with selected files and credentials.
Local servers expose listeners. Validation with lint can load custom cfn-lint
rules. Packaging uploads template-referenced files to S3, including files
outside the project, and may create a bucket. Deploy, sync and publish change
remote state. Read operations can disclose stack outputs and application logs.

All operations with implicit paths, code execution or AWS access require
review, including dry runs and disabled-change-set execution. Review includes
explicit files, URLs, profiles, regions, role selection and inherited settings.
The pack grants no automatic file or network access for these operations.
Environment and configuration enforcement belongs to the host. Ask follows the
host's approval or fallback behavior.

The recognized global-option grammar locates the command through ordinary
option orderings. Options after the command retain its effect decision without
an option allowance list. Exact help forms contain only command words and
`--help`; adding application or plugin overrides takes the review decision.
Matching standard Unix executable paths trusts their installation. Package
runner wrappers, Windows launchers and MCP servers use their own policy.
AWS CLI calls remain owned by `canonic/aws`.

## Inventory

- `cdk` — `acknowledge`, `ack`, `bootstrap`, `context`, `deploy`, `destroy`, `diff`, `docs`, `doc`, `doctor`, `drift`, `flags`, `import`, `init`, `list`, `ls`, `metadata`, `migrate`, `notices`, `orphan`, `publish-assets`, `refactor`, `synthesize`, `synth`, `watch`, `rollback`, `gc`
- `sam` — `build`, `delete`, `deploy`, `init`, `list`, `list endpoints`, `list resources`, `list stack-outputs`, `local callback`, `local execution`, `local generate-event`, `local invoke`, `local start-api`, `local start-lambda`, `docs`, `logs`, `package`, `pipeline bootstrap`, `pipeline init`, `publish`, `remote callback`, `remote execution`, `remote invoke`, `remote test-event`, `sync`, `traces`, `validate`

All listed aliases are retained. Retirement requires evidence of the first
absent tool feature release and three subsequent published feature releases.
There are no retired interfaces removed from this first candidate.

## Sources and validation

- [CDK CLI reference](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd.html)
- [SAM CLI reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [SAM packaging effects](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-package.html)
- [SAM validation effects](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-validate.html)
- [SAM root parser](https://github.com/aws/aws-sam-cli/blob/v1.174.0/samcli/cli/main.py)

Generate with `node scripts/build-aws-cdk-sam-pack.mjs`. Validate with
`npm test -- --shield /absolute/path/to/shield scripts/aws-cdk-sam-pack.test.mjs`.
Fixtures exercise the production evaluator without executing CDK/SAM or
contacting AWS. Live cloud and installed-tool acceptance require separate scope.
