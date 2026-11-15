// Reviewed Workbench 0.21 MCP surface. Every tool of the verified Workbench
// server is Allow regardless of arguments, including tools not listed here; the
// list documents coverage. The server still owns schemas, project trust and lifetimes.
export const version = '0.2.0';
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
  image_inspect: 'Read an image file’s format, size, transparency, padding and colours.',
  image_list: 'Render a page privately and list how its images fit their displayed sizes.',
  image_edit: 'Edit and encode an image, keeping results in Workbench’s own folder unless out is given.',
  docs_list: 'List the bundled Workbench documentation.',
  docs_search: 'Search the bundled Workbench documentation.',
  docs_read: 'Read a bundled Workbench documentation page.',
};

export function workbenchPack() {
  const names = Object.keys(tools);
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/workbench', version,
    description: 'Allow every Workbench MCP tool, including canvas changes, private page interaction and image editing, on a verified Workbench connection.',
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
        decision: 'allow', reason: 'Allow other tools from the verified Workbench server, such as tools added in later releases.'},
    ],
  };
}
