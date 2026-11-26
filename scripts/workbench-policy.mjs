// Reviewed Workbench 0.24 MCP surface. Check caller-named image paths before
// allowing the verified server to use them.
export const version = '0.3.0';
export const shieldEngine = '>=0.55.0, <1.0.0';
export const imageFileTools = ['image_inspect','image_edit'];
const allow = {loose: 'allow', recommended: 'allow', strict: 'allow'};
const present = {not: {exact: null}};

function imagePath(pointer, root, each) {
  const path = {absolute: true, path: {within: {root}}, ...(each ? {each} : {})};
  return {
    requirements: {field_paths: {[pointer]: path}},
    on_unmet: {decision: 'ask', message: `Use an absolute image path inside a Shield-approved ${root} folder.`},
  };
}

export const tools = {
  view_show: 'Read the current canvas and its artboard targets.',
  view_set: 'Change the selected artboard in the last-used canvas.',
  annotation_list: 'Read the user’s annotations from the canvas.',
  config_show: 'List configured spaces, pages, scenarios, sizes and lenses.',
  page_screenshot: 'Capture a private page and optionally save the PNG in the project’s handoff folder.',
  page_console: 'Read a private page’s console entries.',
  page_snapshot: 'Read a private page’s structure and text.',
  page_check: 'Check builds, console errors and layout at selected sizes.',
  page_inspect: 'Inspect matching elements, boxes and computed styles.',
  page_sheet: 'Capture one page at several sizes.',
  page_compare: 'Compare two private targets or open page handles.',
  page_start: 'Start a private browser page that stays open for its MCP connection.',
  page_list: 'List the MCP connection’s private page handles.',
  page_interact: 'Interact with a private page and run its project behavior.',
  page_stop: 'Close a private page handle.',
  image_inspect: 'Read an image file’s format, size, transparency, padding and colours.',
  image_list: 'Render a page privately and list how its images fit their displayed sizes.',
  image_edit: 'Edit and encode an image, with optional mask files and a save destination.',
  docs_list: 'List the bundled Workbench documentation.',
  docs_search: 'Search the bundled Workbench documentation.',
  docs_read: 'Read a bundled Workbench documentation page.',
};

export function workbenchPack() {
  const names = Object.keys(tools);
  return {
    schema_version: 1, kind: 'pack', id: 'canonic/workbench', version,
    description: 'Allow Workbench MCP on a verified connection, with Shield-approved locations for image inputs and saved outputs.',
    license: 'MIT', maintainers: ['Canonic'], engines: {shield: shieldEngine},
    capabilities: ['access-paths-v1','fallback-rules-v1','field-negation-v1','field-path-arrays-v1','field-paths-v1','location-v1',
      'mcp-integrations-v1','negated-selectors-v1','regex-v1','requirements-v1','structured-rules-v1'],
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
        decision: allow, reason,
        ...(imageFileTools.includes(tool) ? imagePath('/file', 'read') : {}),
      })),
      {id: 'mcp-image-edit-masks', conditions: {domain: 'mcp', server: 'workbench', tool: 'image_edit', fields: {'/steps': present}},
        decision: allow, ...imagePath('/steps', 'read', '/mask/file'), reason: 'Check the image file named by every mask step.'},
      {id: 'mcp-image-edit-output', conditions: {domain: 'mcp', server: 'workbench', tool: 'image_edit', fields: {'/out': present}},
        decision: allow, ...imagePath('/out', 'write'), reason: 'Check where Workbench saves the edited images.'},
      {id: 'mcp-unlisted', fallback: true,
        conditions: {domain: 'mcp', server: 'workbench', tool: {not: {one_of: names}}},
        decision: 'allow', reason: 'Allow other tools from the verified Workbench server, such as tools added in later releases.'},
    ],
  };
}
