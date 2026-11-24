// Playwright 1.65.1 and main (1.66.0-next), reviewed 2026-11-24.
// Permission families describe effects; they are not option allowlists.
import {executableForms} from './tool-pack.mjs';

const common = [
  ['install', 'Browser acquisition, user cache updates and optional system dependency installation.'],
  ['install-deps', 'System package-manager execution and potentially privileged dependency changes, including simulation.'],
  ['uninstall', 'Browser cache removal across one or all Playwright installations.'],
  ...['open', 'cr', 'ff', 'wk', 'codegen', 'screenshot', 'pdf'].map(command => [command,
    'Browser execution, navigation and subresources, proxies/authentication, profile or storage state, and generated files.']),
  ['show-trace', 'Trace archives or URLs, embedded resources, browser execution and a local viewer server.'],
  ...['run-driver', 'run-server', 'launch-server', 'mcp'].map(command => [command,
    'Browser-control service, transport listeners, launch configuration and artifacts.']),
  ['mark-docker-image', 'Persistent Docker image metadata written for the runtime.'],
  ['cli', 'Delegated browser/session commands, page evaluation, file access and generated artifacts.'],
  ...['open', 'close', 'actions', 'action', 'requests', 'request', 'console', 'errors', 'snapshot',
    'screenshot', 'attachments', 'attachment', 'install-skill'].map(command => [`trace ${command}`,
    'Trace session lifecycle, potentially sensitive captured data, served snapshots, exports or agent configuration.']),
];
const test = [
  ['test', 'Project configuration and test imports, browser/server execution, target sites, snapshots and report artifacts. Listing still executes project code and can enter environment-selected watch mode.'],
  ['clear-cache', 'Project configuration execution and build/test cache removal.'],
  ['test-server', 'Project configuration and test-control server with an explicit bind address and port.'],
  ['show-report', 'Report directory/archive, browser launch and HTTP report serving.'],
  ['merge-reports', 'Report archive contents, imported reporters/configuration, embedded paths and generated reports.'],
  ['run-test-mcp-server', 'Browser/test MCP service, project configuration and stdio or HTTP transport.'],
  ['init-agents', 'Project configuration and generated agent instructions or settings.'],
  ['init-skills', 'Agent skill installation into persistent configuration.'],
];
export const playwrightTools = {
  playwright: {source: 'https://playwright.dev/docs/test-cli', operations: [...common, ...test]},
  'playwright-core': {source: 'https://github.com/microsoft/playwright/blob/v1.65.1/packages/playwright-core/src/cli/program.ts', operations: common},
};
const forms = name => [...executableForms(name), `/bin/${name}`];
const routine = {loose: 'allow', recommended: 'allow', strict: 'ask'};
const managers = ['yarn', 'yarnpkg', 'pnpm', 'pn'];

export function playwrightRules() {
  const rules = [];
  for (const [name, tool] of Object.entries(playwrightTools)) for (const wrapper of [false, true]) {
    const executable = {one_of: wrapper ? managers.flatMap(forms) : forms(name)};
    const base = wrapper ? [name] : [];
    const id = `playwright-${wrapper ? 'manager' : 'direct'}-${name}`;
    const add = (suffix, arguments_, decision, reason) => rules.push({id: `${id}-${suffix}`,
      conditions: {domain: 'argv', executable, arguments: arguments_}, decision, reason});
    // Non-fallback guards prevent package-manager shorthand or another pack's
    // broad development allowance from silently granting a browser workflow.
    add('review', wrapper ? {kind: 'prefix', values: base} : {kind: 'any'}, 'ask',
      'Review unclassified browser, file, network, credential, installation or session effects.');
    for (const [operation, reason] of tool.operations) add(operation.replaceAll(' ', '-'),
      {kind: 'prefix', values: [...base, ...operation.split(' ')]}, 'ask', reason);
    for (const [index, args] of [['--help'], ['-h'], ['--version'], ['-V']].entries()) add(`metadata-${index}`,
      {kind: 'exact', values: [...base, ...args]}, wrapper ? routine : 'allow',
      'Print built-in installed-tool metadata. Manager startup remains trusted project execution.');
    // These help paths exit in Commander before running the selected action.
    // The delegated cli and mcp parsers own their own startup and stay reviewed.
    for (const [operation] of tool.operations.filter(([operation]) => !['cli', 'mcp'].includes(operation)))
      add(`help-${operation.replaceAll(' ', '-')}`, {kind: 'exact', values: [...base, ...operation.split(' '), '--help']},
        wrapper ? routine : 'allow', 'Print built-in operation help without invoking its action.');

    // install --list and install --dry-run do not acquire a browser. with-deps
    // is processed BEFORE either branch, and must retain review even with
    // --list. install-deps --dry-run can invoke a system package manager too.
    add('acquisition-preview', {kind: 'options', prefix: [...base, 'install'],
      flags: ['--list', '--dry-run', '--with-deps'], values: [], operands: true,
      unknown_options: 'skip', require_any: ['--list', '--dry-run'], forbid: ['--with-deps']},
    wrapper ? routine : 'allow', 'List installed browser metadata or print download plans without acquisition or system dependency work.');
    add('system-dependencies', {kind: 'risk_tokens', prefix: [...base, 'install'],
      any_of: [{regex: '^--with-deps(?:=.*)?$'}]}, 'ask',
    'Dependency installation runs before install list/dry-run handling; review the system operation.');
  }
  return rules;
}
