// Reviewed Workbench 0.19 MCP surface. Authorization is intentionally Allow for
// every listed tool; the server still owns schemas, project trust and lifetimes.
export const version = '0.1.0';
export const tools = {
  view_show: 'Read the current canvas and its artboard targets.',
  view_set: 'Change the selected artboard in the last-used canvas.',
  annotation_list: 'Read the user’s annotations from the canvas.',
  config_show: 'List configured spaces, pages, scenarios, sizes and lenses.',
  page_screenshot: 'Render a target privately and capture its image.',
  page_console: 'Read a private page’s console entries.',
  page_snapshot: 'Read a private page’s structure and text.',
  page_check: 'Check builds, console errors and layout at selected sizes.',
  page_inspect: 'Inspect matching elements, boxes and computed styles.',
  page_sheet: 'Capture one page at several sizes.',
  page_compare: 'Compare two private targets or open page handles.',
  page_start: 'Start a private browser page for inspection or interaction.',
  page_list: 'List the MCP connection’s private page handles.',
  page_interact: 'Interact with a private page and run its project behavior.',
  page_stop: 'Close a private page handle.',
  docs_list: 'List the bundled Workbench documentation.',
  docs_search: 'Search the bundled Workbench documentation.',
  docs_read: 'Read a bundled Workbench documentation page.',
};

export function workbenchPack() {
  const names = Object.keys(tools);
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/workbench', version,
    description: 'Allow every current Workbench MCP tool, including canvas changes and private page interaction, across all profiles.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: '>=0.20.0, <1.0.0'},
    capabilities: ['fallback-rules-v1','mcp-integrations-v1','negated-selectors-v1','regex-v1','structured-rules-v1'],
    mcp_integrations: {
      workbench: {
        transport: 'stdio',
        fields: {
          '/command': {text: {regex: '^(?:workbench(?:\\.cmd)?|/usr/bin/workbench|/usr/local/bin/workbench|/opt/homebrew/bin/workbench|/(?:Users|home)/[A-Za-z0-9_][A-Za-z0-9_. -]*/\\.local/bin/workbench|[A-Za-z]:[\\\\/]Users[\\\\/][A-Za-z0-9_][A-Za-z0-9_. -]*[\\\\/]\\.local[\\\\/]bin[\\\\/]workbench\\.cmd)$'}},
          '/args': {exact: ['mcp','serve']},
        },
        defaults: {type: 'stdio', command: 'workbench', args: ['mcp','serve'], env: {}},
      },
    },
    rules: [
      ...Object.entries(tools).map(([tool, reason]) => ({
        id: `mcp-${tool}`, conditions: {domain: 'mcp', server: 'workbench', tool},
        decision: {loose: 'allow', recommended: 'allow', strict: 'allow'}, reason,
      })),
      {id: 'mcp-unlisted', fallback: true,
        conditions: {domain: 'mcp', server: 'workbench', tool: {not: {one_of: names}}},
        decision: 'ask', reason: 'Review tools outside the explicitly reviewed Workbench MCP surface.'},
    ],
  };
}
