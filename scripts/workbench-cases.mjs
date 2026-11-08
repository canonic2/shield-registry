// Independent expected requests. Keep these explicit rather than importing the
// policy’s inventory or generating expectations from its decisions.
const target = {page: 'pages/jobs.html', space: 'acme', scenario: 'empty'};
export const requests = [
  ['view_show', {}],
  ['view_set', {target}],
  ['annotation_list', {}],
  ['config_show', {}],
  ['page_screenshot', {target, save: true}],
  ['page_console', {target}],
  ['page_snapshot', {target}],
  ['page_check', {target, sizes: ['mobile','laptop']}],
  ['page_inspect', {target, selector: 'button'}],
  ['page_sheet', {target, sizes: ['mobile','laptop']}],
  ['page_compare', {a: target, b: {...target, scenario: 'loading'}}],
  ['page_start', {target}],
  ['page_list', {}],
  ['page_interact', {page: 'pg_acme', steps: [{action: 'click', target: {selector: 'button'}}]}],
  ['page_stop', {page: 'pg_acme'}],
  ['docs_list', {}],
  ['docs_search', {query: 'scenarios'}],
  ['docs_read', {path: 'agent-tools.md'}],
];

export function binding(transport = {type: 'defaults', pack: 'canonic/workbench', integration: 'workbench'}, server = 'workbench') {
  return {[server]: {transport, agents: {codex: server}, packs: {'canonic/workbench': 'workbench'}}};
}

export function workbenchCases() {
  const cases = [];
  for (const profile of ['loose','recommended','strict']) {
    for (const [tool, arguments_] of requests) {
      for (const [variant, args] of [['request', arguments_], ['empty', {}], ['malformed', {target: 42, page: null, steps: 'invalid'}]]) {
        cases.push({name: `${tool}-${variant}-${profile}`, profile, mcp: binding(),
          input: {kind: 'mcp', server: 'workbench', tool, arguments: args, original_input: {}}, expected: 'allow'});
      }
    }
    for (const tool of ['future_tool','current_view','workbench_docs_read','page_interact_shell','VIEW_SHOW']) {
      cases.push({name: `unknown-${tool}-${profile}`, profile, mcp: binding(),
        input: {kind: 'mcp', server: 'workbench', tool, arguments: {}, original_input: {}}, expected: 'ask'});
    }
    for (const command of ['workbench','/usr/local/bin/workbench','/opt/homebrew/bin/workbench',
      '/Users/acme/.local/bin/workbench','/home/acme/.local/bin/workbench',
      'workbench.cmd','C:\\Users\\Acme\\.local\\bin\\workbench.cmd']) {
      cases.push({name: `transport-${cases.length}-${profile}`, profile,
        mcp: binding({type: 'stdio', command, args: ['mcp','serve'], env: {}}),
        input: {kind: 'mcp', server: 'workbench', tool: 'page_interact', arguments: {}, original_input: {}}, expected: 'allow'});
    }
    cases.push({name: `alias-${profile}`, profile, mcp: binding(undefined, 'canvas'),
      input: {kind: 'mcp', server: 'canvas', tool: 'view_set', arguments: {target}, original_input: {}}, expected: 'allow'});
    for (const argv of [['workbench','mcp','setup','--yes'], ['workbench','manager','stop'], ['workbench','view','set','pages/jobs.html']]) {
      cases.push({name: `cli-uncovered-${cases.length}-${profile}`, profile, argv, expected: 'ask'});
    }
  }
  return {schema_version: 1, cases};
}
