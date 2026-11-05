// Independent operation-level expectations, including neighboring refusals.
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const allow = ['allow', 'allow', 'allow'];
const routine = ['allow', 'allow', 'ask'];
const privileged = ['allow', 'ask', 'ask'];
const destructive = ['ask', 'ask', 'deny'];
const review = ['ask', 'ask', 'ask'];
const deny = ['deny', 'deny', 'deny'];
const dependency = ['allow', 'ask', 'ask'];
const profiles = ['loose', 'recommended', 'strict'];

const cli = {
  baseline: [
    ['pwd', ['pwd'], allow],
    ['cat', ['cat', 'README.md'], allow],
    ['cat-unsupported', ['cat', '--future', 'README.md'], review],
    ['grep-unsupported', ['grep', '--future', 'Acme', 'README.md'], review],
    ['grep', ['grep', '-nF', 'Acme', 'README.md'], allow],
    ['disk-list', ['diskutil', 'list'], allow],
    ['disk-info', ['diskutil', 'info', '-plist', 'disk0'], allow],
    ['sudo', ['sudo', 'make', 'install'], review],
    ['unmount', ['umount', '/Volumes/Acme'], review],
    ['docker-cleanup', ['docker', 'rm', 'acme-test'], destructive],
    ['docker-image-cleanup', ['docker', 'rmi', 'acme/test'], destructive],
    ['kubectl-delete', ['kubectl', 'delete', 'pod', 'acme'], destructive],
    ['cloud-delete', ['aws', 's3', 'rm', 's3://acme/example'], destructive],
    ['secret', ['cat', '.aws/credentials'], deny],
    ['outside', ['cat', '/outside/secret'], deny],
    ['environment', ['printenv'], deny],
    ['keychain', ['security', 'find-generic-password', '-w'], deny],
    ['raw-disk', ['dd', 'if=/dev/zero', 'of=/dev/disk0'], deny],
    ['erase-disk', ['diskutil', 'eraseDisk', 'APFS', 'Acme', 'disk0'], deny],
    ['absolute-erase-disk', ['/usr/sbin/diskutil', 'eraseDisk', 'APFS', 'Acme', 'disk0'], deny],
    ['destroy-infrastructure', ['terraform', 'destroy'], deny],
  ],
  git: [
    ['status', ['git', 'status', '--short'], allow],
    ['add', ['git', 'add', 'src'], routine],
    ['fetch', ['git', 'fetch', 'origin'], privileged],
    ['push', ['git', 'push', 'origin', 'main'], privileged],
    ['rebase', ['git', 'rebase', 'main'], privileged],
    ['amend', ['git', 'commit', '--amend', '-m', 'Fix'], review],
    ['viewer', ['git', 'difftool'], privileged],
    ['maintenance', ['git', 'maintenance', 'run'], privileged],
    ['worktree-remove', ['git', 'worktree', 'remove', 'acme'], privileged],
    ['worktree-force', ['git', 'worktree', 'remove', '--force', 'acme'], destructive],
    ['submodule-init', ['git', 'submodule', 'update', '--init'], privileged],
    ['config-edit', ['git', 'config', '--edit'], review],
    ['credential-admin', ['git', 'credential', 'reject'], privileged],
    ['credential-disclosure', ['git', 'credential', 'fill'], deny],
    ['credential-store-disclosure', ['git', 'credential-store', 'get'], deny],
    ['ref-create', ['git', 'update-ref', 'refs/heads/acme', 'HEAD'], privileged],
    ['ref-delete', ['git', 'update-ref', '-d', 'refs/heads/acme'], destructive],
    ['replacement', ['git', 'replace', 'HEAD~1', 'HEAD'], privileged],
    ['replacement-delete', ['git', 'replace', '-d', 'HEAD~1'], destructive],
    ['index-checkout', ['git', 'checkout-index', 'src/app.ts'], privileged],
    ['index-checkout-force', ['git', 'checkout-index', '--force', 'src/app.ts'], destructive],
    ['read-tree', ['git', 'read-tree', 'HEAD'], privileged],
    ['read-tree-reset', ['git', 'read-tree', '--reset', 'HEAD'], destructive],
    ['pack-inspection', ['git', 'pack-redundant', '--all'], privileged],
    ['reflog-expire', ['git', 'reflog', 'expire', '--all'], destructive],
    ['discard', ['git', 'reset', '--hard'], destructive],
    ['force-push', ['git', 'push', '--force', 'origin', 'main'], destructive],
    ['unknown', ['git', 'future'], review],
  ],
  node: [
    ['metadata', ['npm', 'view', 'zod', 'version'], allow],
    ['install', ['npm', 'ci'], routine],
    ['add', ['npm', 'install', 'zod'], dependency],
    ['pnpm-install', ['pnpm', 'install', '--frozen-lockfile'], routine],
    ['pnpm-add', ['pnpm', 'add', 'zod'], dependency],
    ['yarn-install', ['yarn', 'install'], routine],
    ['corepack-install', ['corepack', 'npm', 'ci'], routine],
    ['publish', ['npm', 'publish'], review],
    ['global-install', ['npm', 'install', '-g', 'typescript'], review],
    ['login', ['npm', 'login'], privileged],
    ['config-registry', ['npm', 'config', 'get', 'registry'], privileged],
    ['config-token', ['npm', 'config', 'get', '_authToken'], deny],
    ['corepack-config-token', ['corepack', 'npm', 'config', 'get', '_authToken'], deny],
    ['pnpm-config-token', ['pnpm', 'config', 'get', '_authToken'], deny],
    ['corepack-pnpm-config-token', ['corepack', 'pnpm', 'config', 'get', '_authToken'], deny],
    ['pnpm-directory-token', ['pnpm', '--dir', '.', 'config', 'get', '_authToken'], deny],
    ['corepack-directory-token', ['corepack', 'pnpm', '--dir', '.', 'config', 'get', '_authToken'], deny],
    ['npm-global-token', ['npm', '--global', 'config', 'get', '_authToken'], deny],
    ['nonsecret-global-config', ['npm', '--global', 'config', 'get', 'registry'], review],
    ['script', ['npm', 'run', 'build'], review],
    ['inline', ['node', '-e', 'console.log(1)'], review],
    ['package-exec', ['npx', 'acme-tool'], review],
    ['unknown', ['npm', 'future'], review],
  ],
  rust: [
    ['metadata', ['cargo', 'metadata', '--format-version', '1'], allow],
    ['build', ['cargo', 'build', '--locked'], routine],
    ['add', ['cargo', 'add', 'serde'], routine],
    ['fetch', ['cargo', 'fetch', '--locked'], routine],
    ['vendor', ['cargo', 'vendor', 'vendor'], routine],
    ['toolchain-fetch', ['cargo', '+stable', 'fetch'], routine],
    ['rustup-fetch', ['rustup', 'run', 'stable', 'cargo', 'fetch'], routine],
    ['clean', ['cargo', 'clean'], review],
    ['install', ['cargo', 'install', 'acme-tool'], privileged],
    ['login', ['cargo', 'login'], privileged],
    ['registry', ['cargo', 'fetch', '--registry', 'acme'], review],
    ['topic-help', ['cargo', 'help', 'test'], review],
    ['unknown', ['cargo', 'future'], review],
    ['protected-output', ['cargo', 'build', '--target-dir', '.shield'], deny],
    ['outside-output', ['cargo', 'build', '--target-dir', '/outside/build'], deny],
  ],
  aws: [
    ['metadata', ['aws', 'ec2', 'describe-instances'], allow],
    ['logs', ['aws', 'logs', 'get-log-events', '--log-group-name', 'acme', '--log-stream-name', 'web'], privileged],
    ['data', ['aws', 'dynamodb', 'scan', '--table-name', 'Acme'], privileged],
    ['deploy', ['aws', 'cloudformation', 'deploy', '--stack-name', 'acme', '--template-file', 'template.yml'], privileged],
    ['create', ['aws', 'ec2', 'create-vpc', '--cidr-block', '10.0.0.0/16'], privileged],
    ['execute', ['aws', 'lambda', 'invoke', '--function-name', 'acme', 'out.json'], review],
    ['policy', ['aws', 'iam', 'attach-role-policy', '--role-name', 'acme', '--policy-arn', 'arn:aws:iam::aws:policy/ReadOnlyAccess'], privileged],
    ['presign', ['aws', 's3', 'presign', 's3://acme/example'], privileged],
    ['key-grant', ['aws', 'kms', 'create-grant', '--key-id', 'acme'], privileged],
    ['key-destruction', ['aws', 'kms', 'schedule-key-deletion', '--key-id', 'acme'], destructive],
    ['sso', ['aws', 'sso', 'login'], privileged],
    ['delete', ['aws', 'ec2', 'terminate-instances', '--instance-ids', 'i-0123'], destructive],
    ['purge', ['aws', 'sqs', 'purge-queue', '--queue-url', 'https://example.com/acme'], destructive],
    ['secret', ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme'], ['ask', 'deny', 'deny']],
    ['secret-endpoint', ['aws', 'secretsmanager', 'get-secret-value', '--secret-id', 'acme', '--endpoint-url', 'https://example.com'], ['ask', 'deny', 'deny']],
    ['export-credentials', ['aws', 'configure', 'export-credentials'], ['ask', 'deny', 'deny']],
    ['download', ['aws', 's3', 'cp', 's3://acme/example', 'out.txt'], review],
    ['unknown', ['aws', 'future', 'operation'], review],
  ],
  gate: [
    ['status', ['gate', 'status'], allow],
    ['fetch', ['gate', 'fetch', 'origin'], allow],
    ['push', ['gate', 'push', 'origin', 'main'], privileged],
    ['push-force', ['gate', 'push', '--force-with-lease=abc', 'origin', 'main'], destructive],
    ['setup', ['gate', 'mcp', 'setup', '--agent', 'codex'], privileged],
    ['setup-preview', ['gate', 'mcp', 'setup', '--dry-run'], allow],
    ['sync', ['gate', 'sync'], privileged],
    ['migrate', ['gate', 'migrate', '--apply'], privileged],
    ['unknown', ['gate', 'future'], review],
  ],
  box: [
    ['status', ['box', 'status'], allow],
    ['run', ['box', 'run', 'web'], routine],
    ['exec', ['box', 'exec', 'npm', 'test'], review],
    ['exec-help', ['box', '--json', '--', 'npm', '--help'], review],
    ['setup', ['box', 'setup'], privileged],
    ['sync', ['box', 'config', 'sync'], privileged],
    ['discovery', ['box', 'mcp', 'tool', 'list', 'acme'], privileged],
    ['message', ['box', 'conversation', 'message', 'acme', '--prompt', 'Continue'], privileged],
    ['logout', ['box', 'mcp', 'auth', 'logout', 'acme'], privileged],
    ['headers', ['box', 'mcp', 'auth', 'headers', 'acme'], deny],
    ['cleanup', ['box', 'workspace', 'cleanup', 'acme', '--all'], destructive],
    ['export-secret', ['box', 'content', 'export', '--output', '.aws/credentials'], deny],
    ['unknown', ['box', 'future'], review],
  ],
  testrun: [
    ['doctor', ['testrun', 'doctor'], allow],
    ['build', ['testrun', 'build', 'start', '--project', '.'], routine],
    ['build-environment', ['testrun', 'build', 'start', '--project', '.', '--set-env', 'PATH=/acme/bin'], review],
    ['setup', ['testrun', 'mcp', 'setup'], privileged],
    ['signing', ['testrun', 'signing', 'setup'], privileged],
    ['unknown', ['testrun', 'future'], review],
  ],
};

const tools = {
  gate: [
    ['fetch', 'fetch', {}, allow], ['push', 'push', {}, privileged],
    ['push-project', 'push', {project: '/acme/other'}, review],
    ['push-project-force', 'push', {project: '/acme/other', force_with_lease: 'abc'}, destructive],
    ['commit-project', 'commit', {project: '/acme/other'}, review],
    ['sync', 'sync', {}, privileged], ['sync-preview', 'sync', {dry_run: true}, allow],
    ['unknown', 'future', {}, review],
  ],
  box: [
    ['exec', 'exec', {command: ['npm', 'test']}, review],
    ['message', 'conversation_message', {prompt: 'Continue'}, privileged],
    ['remove-project', 'workspace_remove', {project: '/acme/other'}, review],
    ['remove-project-data', 'workspace_remove', {project: '/acme/other', delete_checkout: true}, destructive],
    ['cleanup-preview', 'workspace_cleanup', {dry_run: true}, allow],
    ['cleanup', 'workspace_cleanup', {}, destructive], ['unknown', 'future', {}, review],
  ],
  testrun: [
    ['build', 'build_start', {project: '.', profile: 'debug'}, routine],
    ['build-environment', 'build_start', {project: '.', env: {PATH: '/acme/bin'}}, review],
    ['build-inline', 'build_start', {project: '.', inline: {command: ['npm', 'test']}}, review],
    ['device-action', 'act', {actions: [{type: 'tap', x: 5, y: 5}]}, routine],
    ['unknown', 'future', {}, review],
  ],
};

export function reviewedCases(name) {
  const cases = [];
  const add = (label, request, expected, extra = {}) => profiles.forEach((profile, i) => cases.push({
    name: `${label}-${profile}`, profile, ...request, ...extra, expected: expected[i],
  }));
  for (const [label, argv, expected] of cli[name]) add(label, {argv}, expected);
  for (const [label, tool, arguments_, expected] of tools[name] ?? []) add(`mcp-${label}`, {
    mcp: {[name]: {transport: {type: 'defaults', pack: `canonic/${name}`, integration: name},
      agents: {codex: name}, packs: {[`canonic/${name}`]: name}}},
    input: {kind: 'mcp', server: name, tool, arguments: arguments_, original_input: {}},
  }, expected);
  if (name === 'node') {
    add('selected-manager', {argv: ['pnpm', 'install']}, routine, {variables: {package_manager: 'pnpm'}});
    add('wrong-manager', {argv: ['npm', 'ci']}, deny, {variables: {package_manager: 'pnpm'}});
  }
  if (name === 'aws') {
    for (const [label, argv, variables, expected] of [
      ['required-profile', ['aws', 'ec2', 'describe-instances'], {profile: 'acme-ro'}, deny],
      ['matching-profile', ['aws', '--profile', 'acme-ro', 'ec2', 'describe-instances'], {profile: 'acme-ro'}, allow],
      ['blocked-profile', ['aws', '--profile', 'acme-prod', 'ec2', 'describe-instances'], {blocked_profiles: ['acme-prod']}, deny],
      ['wrong-region', ['aws', '--region', 'eu-west-1', 'ec2', 'describe-instances'], {regions: ['us-east-1']}, deny],
    ]) add(label, {argv}, expected, {variables});
    for (const [label, tool, arguments_, expected, variables] of [
      ['knowledge', 'aws___search_documentation', {search_phrase: 'S3'}, allow],
      ['script', 'aws___run_script', {script: 'print(1)'}, review],
      ['tasks', 'aws___get_tasks', {}, privileged],
      ['presign', 'aws___get_presigned_url', {}, privileged],
      ['unknown', 'aws___future', {}, review],
      ['profile-default', 'aws___run_script', {}, review, {profile: 'acme-ro'}],
      ['profile-wrong', 'aws___run_script', {aws_profile: 'acme-admin'}, deny, {profile: 'acme-ro'}],
      ['profile-null', 'aws___run_script', {aws_profile: null}, deny, {profile: 'acme-ro'}],
      ['region-unverified', 'aws___run_script', {region: 'us-east-1'}, deny, {regions: ['us-east-1']}],
    ]) {
      const integration = variables?.profile ? 'hosted-profile' : 'hosted';
      add(`mcp-${label}`, {
        mcp: {hosted: {transport: {type: 'defaults', pack: 'canonic/aws', integration},
          agents: {codex: 'aws'}, packs: {'canonic/aws': integration}}},
        input: {kind: 'mcp', server: 'hosted', tool, arguments: arguments_, original_input: {}},
      }, expected, variables ? {variables} : {});
    }
  }
  return cases;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {revisions} = await import('./build-reviewed-profiles.mjs');
  for (const [name, [, version]] of Object.entries(revisions))
    await writeFile(new URL(`../packs/canonic/${name}/${version}/cases.json`, import.meta.url),
      JSON.stringify({schema_version: 1, cases: reviewedCases(name)}, null, 2) + '\n');
}
