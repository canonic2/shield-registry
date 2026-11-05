// Reviewed Testrun CLI and MCP command data, from `testrun --help` for every
// subcommand and the published MCP tool schemas of testrun 0.x.
const inspect = ['config check', 'config show', 'config schema', 'build status', 'manager status', 'manager blockers',
  'manager operation show', 'doctor', 'status', 'observe', 'wait', 'target list', 'ui snapshot', 'ui find', 'ui read', 'app list',
  'control status', 'media status', 'volume get', 'preview status', 'recording status', 'browser list', 'browser doctor', 'browser status'];
const device = ['disconnect', 'cancel', 'task stop', 'developer-mode reveal', 'control acquire', 'control release', 'audio probe',
  'media send', 'volume set', 'network set', 'preview start', 'preview stop', 'recording start', 'recording stop', 'browser connect',
  'browser disconnect', 'browser cancel', 'app install'];
const words = text => text.split(' ');
// Every `build start` option, so the --project path check parses each spelling.
const buildOptions = {flags: ['--install', '--launch', '--replace', '--boot', '--no-wait'], operands: true,
  values: ['--submission-id', '--inline', '--project', '--set-env', '--configuration', '--variant', '--flavor', '--entry-point',
    '--mode', '--timeout-ms', '--launch-arg', '--launch-env']};
// A project inside the server's folder: `.` or relative segments that do not
// begin with a dot, so neither `..` nor an absolute or home path matches.
const relativeProject = '\\./?|(?:\\./)?[A-Za-z0-9_][A-Za-z0-9_.-]*(?:/[A-Za-z0-9_][A-Za-z0-9_.-]*)*/?';
// app_launch and app_restart pass `env` to the app; a simulator app is a host
// process, so DYLD_INSERT_LIBRARIES and similar variables run host code.
const launchEnvironment = 'App launch environment values can load code into a simulator app, which runs on the host.';

// Browser requests that act only inside Testrun's isolated browser. Requests
// that read or write host files, export browser storage, send arbitrary HTTP
// or combine several requests in a batch keep the tool's own decision.
// Navigation is listed separately: only web or relative URLs, which Testrun
// resolves against an HTTP(S) base, stay inside the browser; a file: URL would
// load a host file into the page.
export const browserOperations = ['page_snapshot', 'page_annotate', 'page_pdf', 'capture_compare', 'page_css', 'page_styles', 'page_read',
  'page_read_url', 'page_action', 'page_wait', 'frame_enter', 'page_screenshot', 'page_input', 'input_release',
  'page_emulate_media', 'context_clock', 'fixture_list', 'download_list', 'download_status', 'download_cancel',
  'download_delete', 'worker_list', 'evaluate', 'handle_read', 'handle_property', 'handle_properties', 'handle_dispose', 'handle_create',
  'diagnostics_start', 'diagnostics_stop', 'diagnostics_read', 'diagnostics_wait', 'events_read', 'events_wait', 'context_worker_list',
  'page_audit', 'preview_start', 'preview_status', 'preview_stop', 'recording_start', 'recording_status', 'recording_stop', 'page_resize',
  'context_list', 'page_list', 'context_select', 'context_close', 'page_select', 'page_close', 'page_create', 'callback_resolve'];

export const testrun = {
  name: 'testrun', title: 'Testrun', version: '0.1.0', engine: '>=0.18.0, <1.0.0',
  description: 'Testrun device and isolated-browser inspection and input, with separate decisions for builds that run custom commands, app removal, host file transfer and agent setup.',
  leading: {flags: ['--json'], values: ['--target']},
  shortOptions: {flags: [], values: []},
  extraCapabilities: ['regex-v1', 'field-negation-v1', 'argument-paths-v1', 'requirements-v1'],
  commands: [
    ...inspect.map(text => [words(text), 'inspect', 'Read device, browser, build or manager state without input.']),
    [['clipboard', 'read'], 'exposure', 'Read the simulator clipboard, which can hold copied secrets.'],
    [['connect'], 'device', 'Connect a test device or start an isolated browser.', [
      {id: 'setup', any: ['--setup', '--prepare-support'], category: 'change', reason: 'Install the signed XCTest runner or developer support on the device.'}]],
    [['act'], 'device', 'Drive the connected test device or isolated browser.'],
    ...device.map(text => [words(text), 'device', 'Drive the connected test device or isolated browser.']),
    [['browser', 'send'], 'change', 'Send an opaque browser request, which can include host file transfer or arbitrary HTTP.'],
    [['browser', 'fixture-register'], 'change', 'Register a host file for later browser upload.'],
    [['config', 'init'], 'routine', 'Create the optional build configuration.'],
    // A --project outside the approved project would run another folder's build commands.
    [['build', 'start'], 'routine', 'Run the project\'s configured build; this trusts project code as builds do.', [
      {id: 'project', any: ['--project'], values: ['--project'], category: 'routine', reason: 'Build an app project inside the approved project.',
        paths: {'--project': 'write'}, unmet: 'folder', grammar: buildOptions},
      {id: 'inline', any: ['--inline'], values: ['--inline'], category: 'execute', reason: 'Build from an inline profile, which can name any command.'},
      {id: 'environment', any: ['--set-env', '--launch-env'], values: ['--set-env', '--launch-env'], flags: ['--launch'], category: 'execute',
        reason: 'Override build or app-launch environment variables, which can change which programs run.'}]],
    [['build', 'cancel'], 'routine', 'Cancel a build.'],
    [['app', 'uninstall'], 'change', 'Remove an app and its data from the device.'],
    [['developer-support', 'install'], 'change', 'Install developer support on a physical iPhone.'],
    [['manager', 'retry'], 'change', 'Retry the manager\'s device releases.'],
    [['manager', 'stop'], 'change', 'Stop the device manager.'],
    [['manager', 'drain'], 'change', 'Drain and stop the device manager.'],
    [['mcp', 'serve'], 'stream', 'Serve MCP over standard input until it closes.'],
    [['mcp', 'setup'], 'integration', 'Change agent MCP registrations.'],
    [['signing', 'setup'], 'integration', 'Choose the default development signing team.'],
  ],
  // The CLI's actions argument is opaque JSON. Any mention of env, or a \u
  // escape that could spell it, keeps review.
  risks: [['act-environment', ['act'], [{regex: '(?s).*(env|\\\\u).*'}], 'execute', launchEnvironment]],
  exacts: [[['mcp', 'serve', '--check'], 'inspect', 'Print the MCP server identity and tool names without serving.']],
  mcpTools: Object.fromEntries([
    ...['build_status', 'config_check', 'config_schema', 'config_show', 'control_status', 'doctor', 'media_status', 'observe',
      'preview_status', 'recording_status', 'status', 'target_list', 'testrun_docs_list', 'testrun_docs_read', 'testrun_docs_search',
      'ui_find', 'ui_read', 'ui_snapshot', 'volume_get', 'wait', 'app_list', 'browser_doctor', 'browser_list', 'browser_status']
      .map(name => [name, ['inspect', 'Read device, browser, build or manager state without input.']]),
    ['clipboard_read', ['exposure', 'Read the simulator clipboard.']],
    // A batch holds at most 8 actions; each slot's env is checked.
    ['act', ['device', 'Drive the connected test device or isolated browser.', Array.from({length: 8}, (_, index) => ({
      id: `environment-${index}`, fields: {[`/actions/${index}/env`]: {not: {exact: {}}}}, category: 'execute', reason: launchEnvironment}))]],
    ...['app_install', 'audio_probe', 'browser_cancel', 'browser_connect', 'browser_disconnect', 'cancel', 'control_acquire',
      'control_release', 'developer_mode_reveal', 'disconnect', 'media_send', 'network_set', 'preview_start', 'preview_stop',
      'recording_start', 'recording_stop', 'volume_set']
      .map(name => [name, ['device', 'Drive the connected test device or isolated browser.']]),
    ['connect', ['device', 'Connect a test device or start an isolated browser.', [
      {id: 'setup', fields: {'/setup': {exact: true}}, category: 'change', reason: 'Install the signed XCTest runner.'},
      {id: 'prepare-support', fields: {'/prepareSupport': {exact: true}}, category: 'change', reason: 'Install developer support on the device.'}]]],
    ['browser_send', ['change', 'Send a browser request, which can include host file transfer or arbitrary HTTP.', [
      {id: 'isolated', fields: {'/request/operation': {text: {one_of: browserOperations}}}, category: 'device',
        reason: 'Act only inside the isolated browser.'},
      {id: 'context-settings', fields: {'/request/operation': {exact: 'context_configure'},
        '/request/setting/kind': {text: {one_of: ['offline', 'geolocation', 'permissions_clear']}}}, category: 'device',
        reason: 'Change simulated context settings or clear permissions; permission grants retain review.'},
      {id: 'navigate-web', fields: {'/request/operation': {exact: 'page_navigate'},
        '/request/navigation/url': {text: {regex: '(?i)https?://.*|[^:]*'}}}, category: 'device',
        reason: 'Navigate the isolated browser to a web or relative URL.'},
      {id: 'navigate-history', fields: {'/request/operation': {exact: 'page_navigate'},
        '/request/navigation/kind': {text: {one_of: ['reload', 'back', 'forward', 'set_content']}}}, category: 'device',
        reason: 'Reload, move through history or set page content in the isolated browser.'}]]],
    ['build_start', ['routine', 'Run the project\'s configured build.', [
      {id: 'project', fields: {'/project': {text: {not: {regex: relativeProject}}}}, category: 'folder',
        reason: 'A project outside the server\'s folder runs another folder\'s build commands; review where it is.'},
      {id: 'inline', fields: {'/inline': {not: {exact: null}}}, category: 'execute',
        reason: 'An inline profile can name an arbitrary command.'},
      ...['env', 'baseline', 'bindings', 'overrides/launch_env'].map(pointer => ({
        id: pointer.replaceAll('/', '-'), fields: {[`/${pointer}`]: {not: {exact: {}}}}, category: 'execute',
        reason: 'Caller-supplied environment values can change which programs run.'})),
    ]]],
    ['build_cancel', ['routine', 'Cancel a build.']],
    ['config_init', ['routine', 'Create the optional build configuration.']],
    ['app_uninstall', ['change', 'Remove an app and its data from the device.']],
    ['developer_support_install', ['change', 'Install developer support on a physical iPhone.']],
  ]),
};
