import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {awsCdkSamPack, commandInventory, engine, version} from './aws-cdk-sam-policy.mjs';
import {awsCdkSamCases} from './aws-cdk-sam-cases.mjs';
import {writePack, destinationOf} from './tool-pack.mjs';

export const directory = destinationOf(awsCdkSamPack());
export function guide() {
  return `# AWS CDK / SAM permissions ${version}

Requires Shield \`${engine}\`. Reviewed against the official CDK v2 and
SAM command references on 2026-11-23, including SAM CLI v1.174.0's root parser.
The source candidate provides CLI policy for \`cdk\` and \`sam\`.

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
change set. A cloud assembly path or \`--no-execute\` retains review because
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
\`--help\`; adding application or plugin overrides takes the review decision.
Matching standard Unix executable paths trusts their installation. Package
runner wrappers, Windows launchers and MCP servers use their own policy.
AWS CLI calls remain owned by \`canonic/aws\`.

## Inventory

${Object.entries(commandInventory).map(([name, commands]) => `- \`${name}\` — ${commands.map(command => `\`${command}\``).join(', ')}`).join('\n')}

All listed aliases are retained. Retirement requires evidence of the first
absent tool feature release and three subsequent published feature releases.
There are no retired interfaces removed from this first candidate.

## Sources and validation

- [CDK CLI reference](https://docs.aws.amazon.com/cdk/v2/guide/ref-cli-cmd.html)
- [SAM CLI reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [SAM packaging effects](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-package.html)
- [SAM validation effects](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-validate.html)
- [SAM root parser](https://github.com/aws/aws-sam-cli/blob/v1.174.0/samcli/cli/main.py)

Generate with \`node scripts/build-aws-cdk-sam-pack.mjs\`. Validate with
\`npm test -- --shield /absolute/path/to/shield scripts/aws-cdk-sam-pack.test.mjs\`.
Fixtures exercise the production evaluator without executing CDK/SAM or
contacting AWS. Live cloud and installed-tool acceptance require separate scope.
`;
}
export async function buildAwsCdkSamPack() {
  const pack = awsCdkSamPack();
  await writePack(pack);
  await writeFile(new URL('commands.json', directory), JSON.stringify({schema_version: 1,
    commands: ['cdk', 'sam'].map(name => ({name, rule_ids: pack.rules.filter(rule => rule.id.startsWith(`${name}-`)).map(rule => rule.id)}))}, null, 2) + '\n');
  await writeFile(new URL('cases.json', directory), JSON.stringify(awsCdkSamCases(), null, 2) + '\n');
  await writeFile(new URL('README.md', directory), guide());
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await buildAwsCdkSamPack();
