// Independent expected outcomes; do not derive expectations from policy rules.
import {writeFile} from 'node:fs/promises';

const allow = ['allow', 'allow', 'allow'];
const inspect = ['allow', 'allow', 'ask'];
const exposure = ['allow', 'ask', 'ask'];
const review = ['ask', 'ask', 'deny'];
const privileged = ['ask', 'deny', 'deny'];
const stream = ['ask', 'ask', 'ask'];
const emulator = ['allow', 'allow', 'ask'];
const profiles = ['loose', 'recommended', 'strict'];

const scenarios = [
  // Local forms.
  ['version', ['aws', '--version'], allow],
  ['help', ['aws', 'help'], allow],
  ['service-help', ['aws', 'ec2', 'help'], allow],
  ['operation-help', ['aws', 'ec2', 'describe-instances', 'help'], allow],
  ['caller-identity', ['aws', 'sts', 'get-caller-identity'], allow],
  ['caller-identity-profile', ['aws', 'sts', 'get-caller-identity', '--profile', 'acme-dev', '--output', 'json'], allow],
  ['configure-list', ['aws', 'configure', 'list', '--profile', 'acme-dev'], allow],
  ['configure-list-profiles', ['aws', 'configure', 'list-profiles'], allow],
  ['configure-get-region', ['aws', 'configure', 'get', 'region', '--profile', 'acme-dev'], allow],
  ['configure-get-secret', ['aws', 'configure', 'get', 'aws_secret_access_key'], privileged],
  ['configure-get-token', ['aws', 'configure', 'get', 'aws_session_token', '--profile', 'acme-dev'], privileged],
  ['configure-export', ['aws', 'configure', 'export-credentials', '--profile', 'acme-dev'], privileged],
  ['configure-set', ['aws', 'configure', 'set', 'region', 'eu-west-1'], review],
  ['configure-interactive', ['aws', 'configure'], review],
  ['sso-login', ['aws', 'sso', 'login', '--profile', 'acme-dev'], review],
  // Inspection, with global options in every position and abbreviated.
  ['describe-instances', ['aws', 'ec2', 'describe-instances'], inspect],
  ['describe-filters', ['aws', 'ec2', 'describe-instances', '--filters', 'Name=tag:env,Values=dev', '--query', 'Reservations[].Instances[].InstanceId'], inspect],
  ['leading-globals', ['aws', '--profile', 'acme-dev', '--region', 'eu-west-1', '--output', 'json', 'ec2', 'describe-vpcs'], inspect],
  ['leading-abbreviated', ['aws', '--prof', 'acme-dev', '--reg=eu-west-1', 'ec2', 'describe-vpcs'], inspect],
  ['list-buckets', ['aws', 's3api', 'list-buckets'], inspect],
  ['list-objects', ['aws', 's3api', 'list-objects-v2', '--bucket', 'acme-bucket', '--prefix', 'logs/'], inspect],
  ['s3-ls', ['aws', 's3', 'ls', 's3://acme-bucket/', '--recursive'], inspect],
  ['ecr-describe', ['aws', 'ecr', 'describe-images', '--repository-name', 'acme-web'], inspect],
  ['ecs-list', ['aws', 'ecs', 'list-services', '--cluster', 'acme'], inspect],
  ['cloudformation-describe', ['aws', 'cloudformation', 'describe-stacks', '--stack-name', 'acme-web'], inspect],
  ['iam-get-role', ['aws', 'iam', 'get-role', '--role-name', 'acme-deploy'], inspect],
  ['batch-get', ['aws', 'codecommit', 'batch-get-repositories', '--repository-names', 'acme'], inspect],
  ['logs-tail', ['aws', 'logs', 'tail', '/acme/web', '--since', '1h'], inspect],
  ['ssm-get-parameter', ['aws', 'ssm', 'get-parameter', '--name', '/acme/web/url'], inspect],
  ['unknown-leading-option', ['aws', '--acme-unknown', 'ec2', 'describe-instances'], review],
  // Configuration that commonly embeds secrets.
  ['lambda-configuration', ['aws', 'lambda', 'get-function-configuration', '--function-name', 'acme-web'], exposure],
  ['lambda-list', ['aws', 'lambda', 'list-functions'], exposure],
  ['task-definition', ['aws', 'ecs', 'describe-task-definition', '--task-definition', 'acme-web'], exposure],
  // Data, downloads and secrets.
  ['dynamodb-scan', ['aws', 'dynamodb', 'scan', '--table-name', 'acme-users'], review],
  ['dynamodb-get-item', ['aws', 'dynamodb', 'get-item', '--table-name', 'acme-users', '--key', '{"id":{"S":"1"}}'], review],
  ['logs-filter', ['aws', 'logs', 'filter-log-events', '--log-group-name', '/acme/web', '--filter-pattern', 'ERROR'], review],
  ['sqs-receive', ['aws', 'sqs', 'receive-message', '--queue-url', 'https://sqs.example.com/1/acme'], review],
  ['get-object', ['aws', 's3api', 'get-object', '--bucket', 'acme-bucket', '--key', 'a.txt', 'a.txt'], review],
  ['lambda-invoke', ['aws', 'lambda', 'invoke', '--function-name', 'acme-web', 'out.json'], review],
  ['s3-download', ['aws', 's3', 'cp', 's3://acme-bucket/a.txt', './a.txt'], review],
  ['s3-upload', ['aws', 's3', 'cp', './a.txt', 's3://acme-bucket/a.txt'], review],
  ['s3-sync', ['aws', 's3', 'sync', './site', 's3://acme-bucket/site'], review],
  ['credential-report', ['aws', 'iam', 'get-credential-report'], review],
  ['secret-value', ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme/db'], privileged],
  ['secret-batch', ['aws', 'secretsmanager', 'batch-get-secret-value', '--secret-id-list', 'acme/db'], privileged],
  ['ssm-decryption', ['aws', 'ssm', 'get-parameter', '--name', '/acme/db/password', '--with-decryption'], privileged],
  ['ssm-decryption-abbreviated', ['aws', 'ssm', 'get-parameters-by-path', '--path', '/acme', '--with-decr'], privileged],
  ['kms-decrypt', ['aws', 'kms', 'decrypt', '--ciphertext-blob', 'fileb://secret.bin'], privileged],
  ['assume-role', ['aws', 'sts', 'assume-role', '--role-arn', 'arn:aws:iam::123456789012:role/acme', '--role-session-name', 'acme'], privileged],
  ['ecr-login', ['aws', 'ecr', 'get-login-password', '--region', 'eu-west-1'], privileged],
  ['eks-token', ['aws', 'eks', 'get-token', '--cluster-name', 'acme'], privileged],
  ['rds-token', ['aws', 'rds', 'generate-db-auth-token', '--hostname', 'db.example.com', '--port', '5432', '--username', 'acme'], privileged],
  ['ec2-password', ['aws', 'ec2', 'get-password-data', '--instance-id', 'i-0123456789abcdef0'], privileged],
  ['apigateway-key-values', ['aws', 'apigateway', 'get-api-keys', '--include-values'], privileged],
  ['apigateway-keys', ['aws', 'apigateway', 'get-api-keys'], inspect],
  // Responses that carry a provider secret, key or token.
  ['cognito-identity-provider', ['aws', 'cognito-idp', 'describe-identity-provider', '--user-pool-id', 'eu-west-1_ACME', '--provider-name', 'Google'], privileged],
  ['cognito-provider-by-identifier', ['aws', 'cognito-idp', 'get-identity-provider-by-identifier', '--user-pool-id', 'eu-west-1_ACME', '--idp-identifier', 'acme'], privileged],
  ['vpn-pre-shared-keys', ['aws', 'ec2', 'describe-vpn-connections'], privileged],
  ['agentcore-api-key', ['aws', 'bedrock-agentcore', 'get-resource-api-key', '--workload-identity-token', 'x', '--resource-credential-provider-name', 'acme'], privileged],
  ['pipeline-webhooks', ['aws', 'codepipeline', 'list-webhooks'], privileged],
  ['build-batches', ['aws', 'codebuild', 'batch-get-build-batches', '--ids', 'acme:1'], exposure],
  ['activity-task', ['aws', 'stepfunctions', 'get-activity-task', '--activity-arn', 'arn:aws:states:eu-west-1:123456789012:activity:acme'], review],
  // Read-looking names with side effects.
  ['ses-verify-email', ['aws', 'ses', 'verify-email-identity', '--email-address', 'ops@example.com'], review],
  ['stack-drift', ['aws', 'cloudformation', 'detect-stack-drift', '--stack-name', 'acme'], review],
  ['comprehend-detect', ['aws', 'comprehend', 'detect-sentiment', '--text', 'hello', '--language-code', 'en'], review],
  ['compare-faces', ['aws', 'rekognition', 'compare-faces', '--source-image', 'S3Object={Bucket=b,Name=a.jpg}', '--target-image', 'S3Object={Bucket=b,Name=b.jpg}'], review],
  ['license-check-in', ['aws', 'license-manager', 'check-in-license', '--license-consumption-token', 'x'], review],
  ['cognito-get-id', ['aws', 'cognito-identity', 'get-id', '--identity-pool-id', 'eu-west-1:acme'], review],
  ['verification-code', ['aws', 'cognito-idp', 'get-user-attribute-verification-code', '--access-token', 'x', '--attribute-name', 'email'], review],
  ['embed-url', ['aws', 'quicksight', 'get-dashboard-embed-url', '--aws-account-id', '123456789012', '--dashboard-id', 'acme', '--identity-type', 'IAM'], privileged],
  ['stream-url', ['aws', 'kinesis-video-archived-media', 'get-hls-streaming-session-url', '--stream-name', 'acme'], privileged],
  ['schema-sample', ['aws', 'kinesisanalyticsv2', 'discover-input-schema', '--service-execution-role', 'arn:aws:iam::123456789012:role/acme'], review],
  ['validate-template', ['aws', 'cloudformation', 'validate-template', '--template-body', 'file://stack.yml'], inspect],
  ['domain-availability', ['aws', 'route53domains', 'check-domain-availability', '--domain-name', 'example.com'], inspect],
  ['user-pool-metadata',['aws', 'cognito-idp', 'describe-user-pool', '--user-pool-id', 'eu-west-1_ACME'], inspect],
  // JSON or YAML input can set the same parameters, so it is treated alike.
  ['ssm-input-json', ['aws', 'ssm', 'get-parameter', '--cli-input-json', '{"Name":"/acme/db/password","WithDecryption":true}'], privileged],
  ['ssm-input-yaml', ['aws', 'ssm', 'get-parameters-by-path', '--cli-input-yaml', 'file://params.yml'], privileged],
  ['ssm-input-abbreviated', ['aws', 'ssm', 'get-parameter', '--cli-input-js=file://params.json'], privileged],
  ['apigateway-input-json', ['aws', 'apigateway', 'get-api-keys', '--cli-input-json', '{"includeValues":true}'], privileged],
  // Remote changes and execution.
  ['create-bucket', ['aws', 's3api', 'create-bucket', '--bucket', 'acme-bucket'], review],
  ['s3-mb', ['aws', 's3', 'mb', 's3://acme-bucket'], review],
  ['put-object', ['aws', 's3api', 'put-object', '--bucket', 'acme-bucket', '--key', 'a.txt', '--body', 'a.txt'], review],
  ['update-service', ['aws', 'ecs', 'update-service', '--cluster', 'acme', '--service', 'web', '--force-new-deployment'], review],
  ['start-instances', ['aws', 'ec2', 'start-instances', '--instance-ids', 'i-0123456789abcdef0'], review],
  ['tag-resource', ['aws', 'lambda', 'tag-resource', '--resource', 'arn:aws:lambda:eu-west-1:123456789012:function:acme', '--tags', 'env=dev'], review],
  ['cloudformation-deploy', ['aws', 'cloudformation', 'deploy', '--template-file', 'stack.yml', '--stack-name', 'acme'], review],
  ['update-kubeconfig', ['aws', 'eks', 'update-kubeconfig', '--name', 'acme'], review],
  ['ssm-session', ['aws', 'ssm', 'start-session', '--target', 'i-0123456789abcdef0'], review],
  ['ssm-command', ['aws', 'ssm', 'send-command', '--document-name', 'AWS-RunShellScript', '--targets', 'Key=tag:env,Values=dev'], review],
  ['ecs-exec', ['aws', 'ecs', 'execute-command', '--cluster', 'acme', '--task', 'abc', '--interactive', '--command', '/bin/sh'], review],
  ['athena-query', ['aws', 'athena', 'start-query-execution', '--query-string', 'SELECT 1'], review],
  ['unclassified-verb', ['aws', 'translate', 'translate-text', '--text', 'hello', '--source-language-code', 'en', '--target-language-code', 'fr'], review],
  ['unknown-service-shape', ['aws', 'acme'], review],
  // Deletion and access.
  ['delete-stack', ['aws', 'cloudformation', 'delete-stack', '--stack-name', 'acme'], privileged],
  ['terminate', ['aws', 'ec2', 'terminate-instances', '--instance-ids', 'i-0123456789abcdef0'], privileged],
  ['delete-object', ['aws', 's3api', 'delete-object', '--bucket', 'acme-bucket', '--key', 'a.txt'], privileged],
  ['batch-write', ['aws', 'dynamodb', 'batch-write-item', '--request-items', 'file://items.json'], review],
  ['batch-delete', ['aws', 'iot', 'batch-delete-thing-group', '--thing-group-names', 'acme'], privileged],
  ['s3-rm', ['aws', 's3', 'rm', 's3://acme-bucket/a.txt'], privileged],
  ['s3-rb', ['aws', 's3', 'rb', 's3://acme-bucket', '--force'], privileged],
  ['s3-mv', ['aws', 's3', 'mv', 's3://acme-bucket/a.txt', 's3://acme-bucket/b.txt'], privileged],
  ['s3-sync-delete', ['aws', 's3', 'sync', './site', 's3://acme-bucket/site', '--delete'], privileged],
  ['s3-sync-delete-leading', ['aws', '--profile', 'acme-dev', 's3', 'sync', '--delete', './site', 's3://acme-bucket/site'], privileged],
  ['s3-presign', ['aws', 's3', 'presign', 's3://acme-bucket/a.txt'], privileged],
  ['iam-attach', ['aws', 'iam', 'attach-role-policy', '--role-name', 'acme', '--policy-arn', 'arn:aws:iam::aws:policy/AdministratorAccess'], privileged],
  ['iam-create-user', ['aws', 'iam', 'create-user', '--user-name', 'acme'], privileged],
  ['iam-access-key', ['aws', 'iam', 'create-access-key', '--user-name', 'acme'], privileged],
  ['bucket-policy', ['aws', 's3api', 'put-bucket-policy', '--bucket', 'acme-bucket', '--policy', 'file://policy.json'], privileged],
  ['security-group', ['aws', 'ec2', 'authorize-security-group-ingress', '--group-id', 'sg-0123', '--protocol', 'tcp', '--port', '22', '--cidr', '0.0.0.0/0'], privileged],
  ['lambda-permission', ['aws', 'lambda', 'add-permission', '--function-name', 'acme', '--statement-id', 'x', '--action', 'lambda:InvokeFunction', '--principal', '*'], privileged],
  ['snapshot-sharing', ['aws', 'ec2', 'modify-snapshot-attribute', '--snapshot-id', 'snap-0123', '--attribute', 'createVolumePermission', '--operation-type', 'add', '--group-names', 'all'], privileged],
  ['revoke', ['aws', 'ec2', 'revoke-security-group-ingress', '--group-id', 'sg-0123', '--protocol', 'tcp', '--port', '22', '--cidr', '0.0.0.0/0'], privileged],
  // Long-running and cross-cutting options.
  ['logs-follow', ['aws', 'logs', 'tail', '/acme/web', '--follow'], stream],
  ['logs-follow-abbreviated', ['aws', 'logs', 'tail', '/acme/web', '--fol'], stream],
  ['live-tail', ['aws', 'logs', 'start-live-tail', '--log-group-identifiers', 'arn:aws:logs:eu-west-1:123456789012:log-group:/acme'], review],
  ['no-verify-ssl', ['aws', 'ec2', 'describe-instances', '--no-verify-ssl'], review],
  ['no-verify-ssl-leading', ['aws', '--no-verify', 'ec2', 'describe-instances'], review],
  ['ca-bundle', ['aws', 's3', 'ls', '--ca-bundle', '/acme/ca.pem'], review],
  ['custom-endpoint', ['aws', 's3', 'ls', '--endpoint-url', 'https://storage.example.com'], review],
  ['custom-endpoint-abbreviated', ['aws', '--endpoint=https://storage.example.com', 's3', 'ls'], review],
  // Transport options never soften a stricter operation decision.
  ['secret-no-verify-ssl', ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme/db', '--no-verify-ssl'], privileged],
  ['secret-custom-endpoint', ['aws', '--endpoint-url', 'https://secrets.example.com', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme/db'], privileged],
  ['delete-ca-bundle', ['aws', 'cloudformation', 'delete-stack', '--stack-name', 'acme', '--ca-bundle', '/acme/ca.pem'], privileged],
  ['access-custom-endpoint', ['aws', 'iam', 'attach-role-policy', '--role-name', 'acme', '--policy-arn', 'arn:aws:iam::aws:policy/ReadOnlyAccess', '--endpoint-url=https://iam.example.com'], privileged],
  ['s3-rm-custom-endpoint', ['aws', '--endpoint-url', 'https://storage.example.com', 's3', 'rm', 's3://acme-bucket/a.txt'], privileged],
  ['change-no-verify-ssl', ['aws', 'ecs', 'update-service', '--cluster', 'acme', '--service', 'web', '--no-verify-ssl'], review],
  ['absolute-executable', ['/usr/local/bin/aws', 'ec2', 'describe-instances'], inspect],
  ['homebrew-executable', ['/opt/homebrew/bin/aws', 's3', 'ls'], inspect],
  ['unknown-executable-path', ['/acme/bin/aws', 'ec2', 'describe-instances'], ['ask', 'ask', 'ask']],
];

const cases = scenarios.flatMap(([name, argv, decisions]) => profiles
  .map((profile, i) => ({name: `${name}-${profile}`, profile, argv, expected: decisions[i]})));

// Variable matrix. Gates deny regardless of profile; passing requests keep the
// ordinary decision of the operation.
const describe = ['aws', 'ec2', 'describe-instances', '--filters', 'Name=tag:env,Values=dev'];
const remove = ['aws', 'cloudformation', 'delete-stack', '--stack-name', 'acme'];
const matrix = [
  // [name, variables, argv tail added to describe, expected decisions]
  ['profile-missing', {profile: 'acme-ro'}, describe, ['deny', 'deny', 'deny']],
  ['profile-match', {profile: 'acme-ro'}, [...describe, '--profile', 'acme-ro'], inspect],
  ['profile-match-leading', {profile: 'acme-ro'}, ['aws', '--profile=acme-ro', ...describe.slice(1)], inspect],
  ['profile-match-abbreviated', {profile: 'acme-ro'}, [...describe, '--prof', 'acme-ro'], inspect],
  ['profile-other', {profile: 'acme-ro'}, [...describe, '--profile', 'acme-admin'], ['deny', 'deny', 'deny']],
  ['profile-second', {profile: 'acme-ro'}, [...describe, '--profile', 'acme-ro', '--p', 'acme-admin'], ['deny', 'deny', 'deny']],
  ['profile-after-separator', {profile: 'acme-ro'}, [...describe, '--', '--profile', 'acme-ro'], ['deny', 'deny', 'deny']],
  ['profile-delete', {profile: 'acme-ro'}, [...remove, '--profile', 'acme-ro'], privileged],
  ['profile-help', {profile: 'acme-ro'}, ['aws', 'ec2', 'help'], allow],
  ['profile-version', {profile: 'acme-ro'}, ['aws', '--version'], allow],
  ['profile-list-profiles', {profile: 'acme-ro'}, ['aws', 'configure', 'list-profiles'], allow],
  ['blocked-missing', {blocked_profiles: ['acme-prod', 'acme-admin']}, describe, ['deny', 'deny', 'deny']],
  ['blocked-other', {blocked_profiles: ['acme-prod', 'acme-admin']}, [...describe, '--profile', 'acme-dev'], inspect],
  ['blocked-named', {blocked_profiles: ['acme-prod', 'acme-admin']}, [...describe, '--profile', 'acme-prod'], ['deny', 'deny', 'deny']],
  ['blocked-abbreviated', {blocked_profiles: ['acme-prod', 'acme-admin']}, [...describe, '--pro=acme-admin'], ['deny', 'deny', 'deny']],
  ['blocked-second', {blocked_profiles: ['acme-prod']}, [...describe, '--profile', 'acme-dev', '--profile', 'acme-prod'], ['deny', 'deny', 'deny']],
  ['region-missing', {regions: ['eu-west-1']}, [...describe, '--profile', 'acme-dev'], ['deny', 'deny', 'deny']],
  ['region-match', {regions: ['eu-west-1', 'us-east-1']}, [...describe, '--region', 'us-east-1'], inspect],
  ['region-abbreviated', {regions: ['eu-west-1']}, [...describe, '--reg', 'eu-west-1'], inspect],
  ['region-other', {regions: ['eu-west-1']}, [...describe, '--region', 'ap-south-1'], ['deny', 'deny', 'deny']],
  ['profile-and-region', {profile: 'acme-ro', regions: ['eu-west-1']}, [...describe, '--profile', 'acme-ro', '--region', 'eu-west-1'], inspect],
  ['profile-without-region', {profile: 'acme-ro', regions: ['eu-west-1']}, [...describe, '--profile', 'acme-ro'], ['deny', 'deny', 'deny']],
  // Local emulator: exact endpoint skips gates and allows changes; other
  // endpoints, local file writes and unconfigured projects keep review.
  ['emulator-change', {local_endpoint: 'http://localhost:4566'}, ['aws', '--endpoint-url', 'http://localhost:4566', 's3', 'mb', 's3://acme-bucket'], emulator],
  ['emulator-delete', {local_endpoint: 'http://localhost:4566'}, ['aws', 'dynamodb', 'delete-table', '--table-name', 'acme', '--endpoint-url=http://localhost:4566'], emulator],
  ['emulator-gated', {local_endpoint: 'http://localhost:4566', profile: 'acme-ro', regions: ['eu-west-1']}, ['aws', 'sqs', 'create-queue', '--queue-name', 'acme', '--endpoint-url', 'http://localhost:4566'], emulator],
  ['emulator-download', {local_endpoint: 'http://localhost:4566'}, ['aws', '--endpoint-url', 'http://localhost:4566', 's3', 'cp', 's3://acme-bucket/a.txt', './a.txt'], review],
  ['emulator-outfile', {local_endpoint: 'http://localhost:4566'}, ['aws', '--endpoint-url', 'http://localhost:4566', 's3api', 'get-object', '--bucket', 'b', '--key', 'k', 'out'], review],
  ['emulator-other-endpoint', {local_endpoint: 'http://localhost:4566'}, ['aws', '--endpoint-url', 'http://localhost:4567', 's3', 'mb', 's3://acme-bucket'], review],
  ['emulator-gated-remote', {local_endpoint: 'http://localhost:4566', profile: 'acme-ro'}, ['aws', 'sqs', 'create-queue', '--queue-name', 'acme'], ['deny', 'deny', 'deny']],
  ['emulator-secret-other-endpoint', {local_endpoint: 'http://localhost:4566'}, ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme', '--endpoint-url', 'https://secrets.example.com'], privileged],
  ['emulator-secret', {local_endpoint: 'http://localhost:4566'}, ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme', '--endpoint-url', 'http://localhost:4566'], emulator],
  // The CLI uses the last --endpoint-url, so the last value decides.
  ['emulator-then-other', {local_endpoint: 'http://localhost:4566'}, [...describe, '--endpoint-url', 'http://localhost:4566', '--endpoint-url', 'https://example.com'], review],
  ['emulator-then-other-abbreviated', {local_endpoint: 'http://localhost:4566'}, ['aws', '--endpoint-url', 'http://localhost:4566', ...describe.slice(1), '--endp=https://example.com'], review],
  ['other-then-emulator', {local_endpoint: 'http://localhost:4566'}, [...describe, '--endpoint-url', 'https://example.com', '--endpoint-url', 'http://localhost:4566'], emulator],
  ['emulator-then-other-secret', {local_endpoint: 'http://localhost:4566'}, ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme', '--endpoint-url', 'http://localhost:4566', '--endpoint-url', 'https://example.com'], privileged],
  ['emulator-then-other-gated', {local_endpoint: 'http://localhost:4566', profile: 'acme-ro'}, [...describe, '--endpoint-url', 'http://localhost:4566', '--endpoint-url', 'https://example.com'], ['deny', 'deny', 'deny']],
  ['other-then-emulator-gated', {local_endpoint: 'http://localhost:4566', profile: 'acme-ro'}, [...describe, '--endpoint-url', 'https://example.com', '--endpoint-url', 'http://localhost:4566'], emulator],
  ['emulator-then-other-create',{local_endpoint: 'http://localhost:4566'}, ['aws', '--endpoint-url', 'http://localhost:4566', 'sqs', 'create-queue', '--queue-name', 'acme', '--endpoint-url', 'https://example.com'], review],
  // Commands that start local processes or reach other hosts keep their decisions.
  ...[
    ['emr', 'get', '--cluster-id', 'j-ACME', '--key-pair-file', 'acme.pem', '--src', '/home/hadoop/out.txt', '--dest', './out.txt'],
    ['emr', 'put', '--cluster-id', 'j-ACME', '--key-pair-file', 'acme.pem', '--src', './in.txt'],
    ['emr', 'ssh', '--cluster-id', 'j-ACME', '--key-pair-file', 'acme.pem'],
    ['emr', 'socks', '--cluster-id', 'j-ACME', '--key-pair-file', 'acme.pem'],
    ['ec2-instance-connect', 'ssh', '--instance-id', 'i-0123456789abcdef0'],
    ['ec2-instance-connect', 'open-tunnel', '--instance-id', 'i-0123456789abcdef0', '--local-port', '2222'],
    ['ssm', 'start-session', '--target', 'i-0123456789abcdef0'],
    ['ecs', 'execute-command', '--cluster', 'acme', '--task', 'abc', '--interactive', '--command', '/bin/sh'],
  ].map(args => [`emulator-${args[0]}-${args[1]}`, {local_endpoint: 'http://localhost:4566'},
    ['aws', '--endpoint-url', 'http://localhost:4566', ...args], review]),
  ['emulator-unset', {}, ['aws','--endpoint-url', 'http://localhost:4566', 's3', 'mb', 's3://acme-bucket'], review],
];
for (const [name, variables, argv, decisions] of matrix) profiles.forEach((profile, i) =>
  cases.push({name: `${name}-${profile}`, profile, ...(Object.keys(variables).length ? {variables} : {}), argv, expected: decisions[i]}));

await writeFile(new URL('../packs/canonic/aws/0.1.0/cases.json', import.meta.url), JSON.stringify({schema_version: 1, cases}, null, 2) + '\n');
