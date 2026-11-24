import {executableForms} from './tool-pack.mjs';

export const version = '0.1.0';
export const engine = '>=0.53.0, <1.0.0';
const review = {loose: 'ask', recommended: 'ask', strict: 'deny'};
const destructive = {loose: 'ask', recommended: 'deny', strict: 'deny'};

// Parsing declarations locate command words. They never establish an allowance
// for application code, template references, plugins, credentials or cloud targets.
const cdkBooleans = ['--asset-metadata', '--ci', '--debug', '--ec2creds', '--ignore-errors', '--json',
  '--lookups', '--no-color', '--notices', '--path-metadata', '--staging', '--strict', '--trace', '--version-reporting'];
const leading = {
  cdk: {flags: ['--verbose', '-v', '-i', '-j', ...cdkBooleans.map(name => `--no-${name.slice(2)}`)],
    optional_values: cdkBooleans,
    values: ['--app', '-a', '--build', '--ca-bundle-path', '--context', '-c', '--output', '-o', '--plugin', '-p', '--profile', '--proxy', '--role-arn', '-r'],
    interleaved: true},
  sam: {flags: ['--debug', '--beta-features', '--no-beta-features'], values: ['--profile', '--region'], interleaved: true},
};

export const commandInventory = {
  cdk: ['acknowledge', 'ack', 'bootstrap', 'context', 'deploy', 'destroy', 'diff', 'docs', 'doc', 'doctor',
    'drift', 'flags', 'import', 'init', 'list', 'ls', 'metadata', 'migrate', 'notices', 'orphan',
    'publish-assets', 'refactor', 'synthesize', 'synth', 'watch', 'rollback', 'gc'],
  sam: ['build', 'delete', 'deploy', 'init', 'list', 'list endpoints', 'list resources', 'list stack-outputs',
    'local callback', 'local execution', 'local generate-event', 'local invoke', 'local start-api', 'local start-lambda',
    'docs', 'logs', 'package', 'pipeline bootstrap', 'pipeline init', 'publish', 'remote callback', 'remote execution',
    'remote invoke', 'remote test-event', 'sync', 'traces', 'validate'],
};

export function awsCdkSamPack() {
  const rules = [];
  for (const [name, commands] of Object.entries(commandInventory)) {
    const executable = {one_of: executableForms(name)};
    const rule = (id, arguments_, decision, reason, extra = {}) => ({id: `${name}-${id}`,
      conditions: {domain: 'argv', executable, arguments: arguments_}, decision, reason, ...extra});
    const helpForms = [['--version'], ['--help'], ['-h']];
    for (const values of helpForms) rules.push(rule(`info-${values.join('-')}`, {kind: 'exact', values}, 'allow', 'Print built-in help or the installed version.'));
    for (const command of commands) {
      const deletes = name === 'cdk' ? ['destroy', 'orphan', 'gc'].includes(command) : command === 'delete';
      rules.push(rule(command.replaceAll(' ', '-'), {kind: 'prefix', values: command.split(' '), leading: leading[name]},
        deletes ? destructive : review, deletes
          ? 'Review resource deletion, detachment or asset garbage collection.'
          : 'Review application or builder execution, implicit files, credentials, remote reads and cloud mutations.'));
      rules.push(rule(`help-${command.replaceAll(' ', '-')}`, {kind: 'exact', values: [...command.split(' '), '--help']},
        'allow', 'Print built-in command help without invoking the operation.'));
    }
    rules.push(rule('unclassified', {kind: 'any'}, review,
      'Review unclassified syntax, wrappers and configuration effects. Strict refuses execution.', {fallback: true}));
  }
  return {schema_version: 1, kind: 'pack', id: 'canonic/aws-cdk-sam', version,
    description: 'AWS CDK and SAM CLI permissions for reviewed application execution, local workflows, packaging and infrastructure changes.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: engine},
    capabilities: ['structured-rules-v1', 'argument-rules-v1', 'prefix-leading-v1', 'interleaved-leading-v1', 'fallback-rules-v1'], rules};
}
