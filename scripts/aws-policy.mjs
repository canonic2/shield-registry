// Reviewed AWS CLI v2 command data for the AWS pack. Names are the CLI's own
// service commands and kebab-case operations, taken from its command index and
// botocore models; see the pack guide for the inventory method.

// The complete global option set. argparse resolves abbreviations against it,
// so every grammar accepting abbreviations declares all of it, including the
// options that weaken transport security, which rules then restrict.
export const globalFlags = ['--debug', '--no-verify-ssl', '--no-paginate', '--no-sign-request', '--no-cli-pager',
  '--cli-auto-prompt', '--no-cli-auto-prompt', '--version'];
export const globalValues = ['--endpoint-url', '--output', '--query', '--profile', '--region', '--color', '--ca-bundle',
  '--cli-read-timeout', '--cli-connect-timeout', '--cli-binary-format'];

// Leading words of service operations, by effect. Words not listed, such as
// generate, query, scan, translate or sign, stay unlisted and keep review, as do
// verify, detect, compare and evaluate: they send messages, start detection
// runs, record events or upload content for analysis as often as they read.
export const verbClasses = {
  inspect: ['describe', 'list', 'get', 'batch-get', 'search', 'lookup', 'view', 'check', 'validate', 'estimate', 'preview',
    'simulate', 'calculate', 'count', 'discover', 'is', 'head'],
  change: ['create', 'update', 'put', 'tag', 'untag', 'associate', 'disassociate', 'modify', 'add', 'remove', 'enable',
    'disable', 'register', 'deregister', 'set', 'import', 'export', 'accept', 'reject', 'restore', 'attach', 'detach',
    'copy', 'reboot', 'start', 'stop', 'restart', 'resume', 'pause', 'suspend', 'cancel', 'publish', 'upload', 'apply',
    'confirm', 'activate', 'deactivate', 'replace', 'reset', 'allocate', 'assign', 'unassign', 'provision', 'promote',
    'failover', 'switchover', 'merge', 'request', 'retry', 'move', 'rename', 'schedule', 'transfer', 'upgrade', 'deploy',
    'subscribe', 'unsubscribe', 'archive', 'unarchive', 'complete', 'notify', 'post', 'purchase', 'renew', 'refresh',
    'increase', 'decrease', 'batch-put', 'batch-update', 'batch-create', 'batch-write', 'batch-associate',
    'batch-disassociate', 'batch-import', 'change'],
  destroy: ['delete', 'batch-delete', 'terminate', 'purge', 'release', 'deprovision', 'close', 'redact', 'rebuild',
    'backtrack', 'dispose', 'abort', 'discard', 'flush', 'clear'],
  access: ['authorize', 'revoke', 'grant', 'share', 'unshare', 'deauthorize', 'rotate', 'regenerate'],
  execute: ['invoke', 'execute', 'run', 'send', 'submit', 'test', 'commit', 'begin', 'converse', 'chat', 'redrive'],
};

export const verbReasons = {
  inspect: 'Read resource metadata from the account; listed exceptions cover secrets, credentials, customer data and local files.',
  change: 'Create, update, start or stop remote resources in the account.',
  destroy: 'Delete or irreversibly end remote resources.',
  access: 'Grant, revoke or rotate access to remote resources.',
  execute: 'Run code, queries, messages or commands in the account.',
};

// Services whose changes all grant, remove or administer access.
export const accessServices = ['iam', 'sso-admin', 'identitystore', 'organizations', 'ram'];
// Changes anywhere whose operation names concern policies, permissions, grants,
// sharing or credentials.
export const accessOperation = '(?:create|put|attach|update|add|set|modify|replace|associate|delete|remove|detach|disassociate|reset)-[a-z0-9-]*(?:polic(?:y|ies)|permissions?|grants?|acl|access-keys?|login-profile|public-access-block|resource-share|ssh-public-key|service-specific-credential|signing-certificate|snapshot-attribute|image-attribute|security-group-(?:ingress|egress))(?:-[a-z0-9-]+)?';

// Exceptions by category: service → operations. Same-rank rules resolve to the
// stricter decision, so an exception can only tighten a verb's decision.
export const operations = {
  secret: {
    secretsmanager: ['get-secret-value', 'batch-get-secret-value', 'get-random-password'],
    kms: ['decrypt', 'generate-data-key', 'generate-data-key-pair', 'derive-shared-secret', 'generate-random', 'get-parameters-for-import'],
    sts: ['assume-role', 'assume-role-with-saml', 'assume-role-with-web-identity', 'assume-root', 'get-session-token', 'get-federation-token'],
    sso: ['get-role-credentials'],
    'sso-oidc': ['create-token', 'create-token-with-iam', 'register-client'],
    ecr: ['get-login-password', 'get-authorization-token'],
    'ecr-public': ['get-login-password', 'get-authorization-token'],
    codeartifact: ['get-authorization-token', 'login'],
    codecommit: ['credential-helper'],
    eks: ['get-token'],
    'eks-auth': ['assume-role-for-pod-identity'],
    rds: ['generate-db-auth-token'],
    dsql: ['generate-db-connect-auth-token', 'generate-db-connect-admin-auth-token'],
    redshift: ['get-cluster-credentials', 'get-cluster-credentials-with-iam'],
    'redshift-serverless': ['get-credentials'],
    ec2: ['get-password-data', 'create-key-pair', 'export-client-vpn-client-configuration',
      'describe-verified-access-trust-providers', 'describe-vpn-connections'],
    lightsail: ['get-instance-access-details', 'get-relational-database-master-user-password', 'download-default-key-pair',
      'create-bucket-access-key', 'get-bucket-access-keys', 'create-container-service-registry-login'],
    'cognito-identity': ['get-credentials-for-identity', 'get-open-id-token', 'get-open-id-token-for-developer-identity'],
    'cognito-idp': ['initiate-auth', 'admin-initiate-auth', 'respond-to-auth-challenge', 'admin-respond-to-auth-challenge',
      'get-tokens-from-refresh-token', 'describe-user-pool-client', 'describe-identity-provider', 'get-identity-provider-by-identifier'],
    'workspaces-web': ['get-identity-provider'],
    amplifybackend: ['get-backend-auth'],
    'bedrock-agentcore': ['get-resource-api-key', 'get-resource-oauth2-token', 'get-workload-access-token',
      'get-workload-access-token-for-jwt', 'get-workload-access-token-for-user-id'],
    chime: ['get-bot', 'list-bots'],
    'chime-sdk-meetings': ['get-attendee', 'list-attendees'],
    dataexchange: ['get-asset', 'get-job', 'list-jobs', 'list-revision-assets'],
    finspace: ['get-kx-connection-string'],
    'kinesis-video-signaling': ['get-ice-server-config'],
    mediapackage: ['describe-channel', 'list-channels'],
    iotwireless: ['get-wireless-device'],
    appsync: ['list-api-keys', 'create-api-key'],
    apigateway: ['create-api-key'],
    wafv2: ['list-api-keys'],
    iot: ['create-keys-and-certificate', 'get-registration-code'],
    snowball: ['get-job-unlock-code'],
    iotsecuretunneling: ['open-tunnel', 'rotate-tunnel-access-token'],
    acm: ['export-certificate'],
    'payment-cryptography': ['export-key'],
    'payment-cryptography-data': ['decrypt-data', 'generate-pin-data', 'translate-key-material', 'translate-pin-data'],
    macie2: ['get-sensitive-data-occurrences'],
    glue: ['get-connection', 'get-connections'],
    datazone: ['get-environment-credentials', 'get-connection', 'list-connections', 'get-iam-portal-login-url'],
    codepipeline: ['get-job-details', 'get-third-party-job-details', 'list-webhooks'],
    storagegateway: ['describe-chap-credentials'],
    gamelift: ['get-compute-access', 'get-compute-auth-token', 'get-instance-access', 'request-upload-credentials', 'get-game-session-log-url'],
    lakeformation: ['assume-decorated-role-with-saml', 'get-temporary-glue-partition-credentials', 'get-temporary-glue-table-credentials'],
    'emr-containers': ['get-managed-endpoint-session-credentials'],
    emr: ['get-cluster-session-credentials', 'get-on-cluster-app-ui-presigned-url', 'get-persistent-app-ui-presigned-url'],
    'finspace-data': ['get-programmatic-access-credentials', 'get-external-data-view-access-details'],
    mwaa: ['create-cli-token', 'create-web-login-token'],
    grafana: ['create-workspace-api-key', 'create-workspace-service-account-token'],
    ivs: ['get-stream-key', 'get-channel', 'batch-get-channel', 'get-stream-session'],
    connect: ['get-federation-token'],
    'license-manager': ['get-access-token'],
    ssm: ['get-access-token'],
    s3api: ['create-session'],
    s3control: ['get-data-access'],
    'pca-connector-scep': ['get-challenge-password'],
    'route53domains': ['retrieve-domain-auth-code'],
    sagemaker: ['create-presigned-domain-url', 'create-presigned-notebook-instance-url', 'create-presigned-mlflow-tracking-server-url'],
    quicksight: ['generate-embed-url-for-registered-user', 'generate-embed-url-for-anonymous-user', 'get-dashboard-embed-url', 'get-session-embed-url'],
    // URLs that grant access to whoever holds them.
    auditmanager: ['get-evidence-file-upload-url', 'get-assessment-report-url'],
    connectparticipant: ['get-authentication-url'],
    'security-ir': ['get-case-attachment-download-url', 'get-case-attachment-upload-url'],
    mturk: ['get-file-upload-url'],
    m2: ['get-signed-bluinsights-url'],
    'kinesis-video-archived-media': ['get-hls-streaming-session-url', 'get-dash-streaming-session-url'],
    'lexv2-models': ['describe-bot-recommendation', 'get-test-execution-artifacts-url'],
    amplify: ['get-artifact-url'],
    workmail: ['assume-impersonation-role'],
    deadline: ['assume-fleet-role-for-read', 'assume-fleet-role-for-worker', 'assume-queue-role-for-read', 'assume-queue-role-for-user', 'assume-queue-role-for-worker'],
    cloudfront: ['sign'],
  },
  data: {
    dynamodb: ['scan', 'query', 'get-item', 'batch-get-item', 'transact-get-items'],
    dynamodbstreams: ['get-records'],
    athena: ['get-query-results'],
    logs: ['get-log-events', 'filter-log-events', 'get-query-results', 'get-log-record', 'get-log-object'],
    cloudtrail: ['lookup-events', 'get-query-results'],
    sqs: ['receive-message'],
    kinesis: ['get-records'],
    'timestream-query': ['query'],
    kendra: ['query'],
    'redshift-data': ['get-statement-result', 'get-statement-result-v2'],
    codecommit: ['get-file'],
    'cognito-idp': ['admin-get-user', 'list-users'],
    iam: ['get-account-authorization-details', 'get-credential-report'],
    ec2: ['get-console-output', 'get-console-screenshot'],
    rds: ['download-db-log-file-portion'],
    elasticbeanstalk: ['retrieve-environment-info'],
    ssm: ['get-command-invocation', 'list-command-invocations'],
    // get-activity-task also claims the task it returns.
    stepfunctions: ['get-execution-history', 'describe-execution', 'get-activity-task'],
    kinesisanalytics: ['discover-input-schema'],
    kinesisanalyticsv2: ['discover-input-schema'],
    qconnect: ['get-next-message'],
    mailmanager: ['get-archive-message'],
    'iot-data': ['get-retained-message'],
    'chime-sdk-messaging': ['get-channel-message'],
    pinpoint: ['get-in-app-messages'],
    guardduty: ['get-findings'],
    securityhub: ['get-findings'],
    connect: ['get-contact-attributes', 'search-contacts'],
    'customer-profiles': ['search-profiles'],
    cloudsearchdomain: ['search'],
    'backupsearch': ['list-search-job-results'],
    lambda: ['get-layer-version'],
    sts: ['decode-authorization-message'],
  },
  exposure: {
    lambda: ['get-function', 'get-function-configuration', 'list-functions', 'list-versions-by-function'],
    ecs: ['describe-task-definition', 'describe-tasks'],
    ec2: ['describe-instance-attribute', 'describe-launch-template-versions', 'describe-spot-fleet-requests'],
    autoscaling: ['describe-launch-configurations'],
    batch: ['describe-job-definitions', 'describe-jobs'],
    apprunner: ['describe-service'],
    elasticbeanstalk: ['describe-configuration-settings'],
    amplify: ['get-app', 'list-apps', 'get-branch', 'list-branches'],
    codebuild: ['batch-get-projects', 'batch-get-builds', 'batch-get-build-batches', 'batch-get-sandboxes'],
    cloudformation: ['get-template'],
    datapipeline: ['get-pipeline-definition'],
    emr: ['describe-cluster'],
    glue: ['get-job', 'get-jobs', 'batch-get-jobs'],
    mwaa: ['get-environment'],
    sagemaker: ['describe-training-job'],
    ssm: ['get-automation-execution'],
    appconfig: ['get-hosted-configuration-version'],
    elbv2: ['describe-listeners', 'describe-rules'],
    fsx: ['describe-file-systems'],
    dms: ['describe-endpoints'],
    firehose: ['describe-delivery-stream'],
    cloudhsmv2: ['describe-clusters'],
    appstream: ['describe-directory-configs'],
    ds: ['describe-directories'],
    grafana: ['describe-workspace', 'list-workspaces'],
    pinpoint: ['get-gcm-channel', 'get-baidu-channel'],
    'chime-sdk-identity': ['describe-app-instance-user-endpoint'],
    taxsettings: ['get-tax-registration', 'list-tax-registrations'],
  },
  // Operations whose response the CLI writes to a local `outfile` the command names.
  download: {
    apigateway: ['get-export', 'get-sdk'],
    apigatewayv2: ['export-api'],
    appconfig: ['get-configuration', 'get-hosted-configuration-version'],
    appconfigdata: ['get-latest-configuration'],
    appsync: ['get-introspection-schema'],
    'bedrock-agentcore': ['invoke-agent-runtime'],
    'bedrock-runtime': ['invoke-model'],
    cloudfront: ['get-function'],
    codeartifact: ['get-package-version-asset'],
    codeguruprofiler: ['get-profile'],
    datazone: ['get-lineage-event'],
    ebs: ['get-snapshot-block'],
    'geo-maps': ['get-glyphs', 'get-sprites', 'get-static-map', 'get-style-descriptor', 'get-tile'],
    glacier: ['get-job-output'],
    'iot-data': ['get-thing-shadow', 'update-thing-shadow', 'delete-thing-shadow'],
    iotwireless: ['get-position-estimate', 'get-resource-position'],
    'kinesis-video-archived-media': ['get-clip', 'get-media-for-fragment-list'],
    'kinesis-video-media': ['get-media'],
    lakeformation: ['get-work-unit-results'],
    lambda: ['invoke'],
    'lex-runtime': ['post-content', 'put-session'],
    'lexv2-runtime': ['put-session', 'recognize-utterance'],
    location: ['get-map-glyphs', 'get-map-sprites', 'get-map-style-descriptor', 'get-map-tile'],
    medialive: ['describe-input-device-thumbnail'],
    'mediastore-data': ['get-object'],
    'medical-imaging': ['get-image-frame', 'get-image-set-metadata'],
    'neptune-graph': ['execute-query'],
    neptunedata: ['execute-gremlin-explain-query', 'execute-gremlin-profile-query', 'execute-open-cypher-explain-query'],
    omics: ['get-read-set', 'get-reference'],
    polly: ['synthesize-speech'],
    s3api: ['get-object', 'get-object-torrent', 'select-object-content'],
    'sagemaker-geospatial': ['get-tile'],
    'sagemaker-runtime': ['invoke-endpoint'],
    schemas: ['get-code-binding-source'],
    tnb: ['get-sol-function-package-content', 'get-sol-function-package-descriptor', 'get-sol-network-package-content', 'get-sol-network-package-descriptor'],
    workmailmessageflow: ['get-raw-message-content'],
  },
  execute: {
    ssm: ['start-session', 'start-automation-execution'],
    ecs: ['execute-command', 'run-task'],
    'ec2-instance-connect': ['ssh', 'open-tunnel'],
    athena: ['start-query-execution'],
    logs: ['start-query'],
    states: ['start-execution', 'start-sync-execution'],
    stepfunctions: ['start-execution', 'start-sync-execution'],
    codebuild: ['start-build'],
    glue: ['start-job-run'],
    emr: ['ssh', 'socks', 'get', 'put', 'add-steps'],
    cloudshell: ['create-session'],
  },
  // Reads by name that create, send or check out something.
  change: {
    'cognito-identity': ['get-id'],
    'cognito-idp': ['get-user-attribute-verification-code'],
    'license-manager': ['check-in-license'],
  },
  access: {
    'ec2-instance-connect':['send-ssh-public-key', 'send-serial-console-ssh-public-key'],
    kms: ['create-grant', 'schedule-key-deletion'],
    route53domains: ['transfer-domain-to-another-aws-account'],
  },
};

export const operationReasons = {
  secret: 'Return or create secrets, decrypted data, credentials or tokens.',
  data: 'Return customer data, records, logs or command output.',
  exposure: 'Return configuration that commonly embeds secrets, such as environment variables or user data.',
  download: 'Write the response to a local file the command names.',
  execute: 'Run code, queries or interactive sessions in the account.',
  change: 'Create an identity, send a verification code or check in a license, though the name reads as a query.',
  access:'Grant access, share resources or schedule key deletion.',
};

// Customizations outside the service models: [id, operation tokens, category, reason].
export const customizations = [
  ['eks-update-kubeconfig', ['eks', 'update-kubeconfig'], 'session', 'Write cluster credentials into the local kubeconfig.'],
  ['cloudformation-package', ['cloudformation', 'package'], 'change', 'Upload local artifacts to S3 and write a template file.'],
  ['cloudformation-deploy', ['cloudformation', 'deploy'], 'change', 'Create or update a stack.'],
  ['deploy-push', ['deploy', 'push'], 'change', 'Upload an application revision.'],
  ['deploy-host-agent', ['deploy', {one_of: ['install', 'uninstall']}], 'access', 'Install or remove the CodeDeploy agent on this machine.'],
  ['ddb-put', ['ddb', 'put'], 'change', 'Write items to a table.'],
  ['ddb-select', ['ddb', 'select'], 'data', 'Read items from a table.'],
  ['configure-mfa-login', ['configure', 'mfa-login'], 'session', 'Prompt for an MFA code and store temporary credentials.'],
];

// Customizations that start local processes or connect to hosts other than the
// endpoint: EMR runs SSH/SCP to the cluster, EC2 Instance Connect runs OpenSSH
// or a local tunnel, and SSM/ECS sessions launch the Session Manager plugin.
export const localProcessOperations = ['ssh', 'socks', 'get', 'put', 'open-tunnel', 'start-session', 'execute-command'];
// Operation names that write local files at a path the command names, change
// this machine or start local processes; the local emulator allowance excludes
// them. Exclusion is by operation name in any service.
export const localFileOperations = [...new Set(['cp', 'mv', 'sync', 'update-kubeconfig', 'package', 'install', 'uninstall',
  'login', 'logout', 'set', 'import', 'sso', 'sso-session', 'add-model', 'export-credentials', 'mfa-login', 'credential-helper',
  ...localProcessOperations, ...Object.values(operations.download).flat()])];
// Command groups that act on this machine's configuration, also excluded.
export const localServices = ['configure', 'history', 'sso', 'login', 'logout', 'cli-dev'];

// `aws configure get` names whose values are credentials.
export const secretSetting = '(?i).*(?:secret|session_token|security_token|password|credential).*';

const profileName = {regex: '[A-Za-z0-9][A-Za-z0-9_.@+-]*'};
export const variables = {
  profile: {type: 'string', description: 'Required AWS CLI profile and bound MCP API profile. MCP requires the same single reviewed connector profile; ambient credentials cannot satisfy the gate.',
    layer: 'local', match: profileName, max_length: 128,
    setup: {question: 'Require agents to use one AWS profile?', unset: 'Any profile', value: 'Only this profile', placeholder: 'acme-read-only'}},
  blocked_profiles: {type: 'list', description: 'AWS profiles agents must never use. CLI commands must name another profile; bound MCP API calls require a single reviewed connector profile outside this list.',
    items: {type: 'string', match: profileName, max_length: 128}, max_items: 32,
    setup: {question: 'Block specific AWS profiles?', unset: 'No blocked profiles', value: 'Block these profiles',
      placeholder: 'acme-prod, acme-admin', ask_when: [{var: 'profile', set: false}]}},
  regions: {type: 'list', description: 'Allowed AWS CLI operation regions, required through --region. Bound MCP API calls are blocked because launch metadata cannot prove Python script or task-result regions.',
    items: {type: 'string', match: {regex: '[a-z]{2}(?:-[a-z]+)+-[0-9]+'}, max_length: 32}, max_items: 32,
    setup: {question: 'Restrict agents to specific AWS regions?', unset: 'Any region', value: 'Only these regions', placeholder: 'us-east-1, eu-west-1'}},
  local_endpoint: {type: 'string', description: 'Local AWS emulator endpoint, such as LocalStack. Commands with exactly this --endpoint-url skip the profile and region checks and may change the emulator.',
    match: {regex: 'https?://(?:localhost|127\\.0\\.0\\.1|\\[::1\\])(?::[0-9]{1,5})?/?'}, max_length: 64,
    setup: {question: 'Use a local AWS emulator endpoint?', unset: 'No local endpoint', value: 'This endpoint', placeholder: 'http://localhost:4566'}},
};
