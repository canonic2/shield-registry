// Host files that Testrun reads or writes for a caller, from the Testrun 0.9.0
// catalog schemas, `browser::api::prepare_host_paths_with` and the CLI's clap
// definitions. Every Testrun operation stays Allow; a caller-named host path
// must resolve inside the approved read or write roots, or the call asks.
// Expected decisions live separately in testrun-trusted-cases.mjs.
const allow = {loose:'allow', recommended:'allow', strict:'allow'};
const ask = {loose:'ask', recommended:'ask', strict:'ask'};
// Any present string, including an empty one; objects, arrays and null never match.
const anyString = {text:{regex:'(?s).*'}};
const present = {not:{exact:null}};
const within = root => ({relative_to:'project', path:{within:{root}}});
const message = {read:'Name a host file inside the approved read roots.',
  write:'Name a host file inside the approved write roots.'};
const reason = {read:'Testrun reads this host file.', write:'Testrun writes this host file.'};

// Fields of one browser request, relative to that request, with the operations
// that treat them as host files. Other operations use the same names for other
// things, such as a cookie filter's `options.path`, so each check is scoped.
const browserFields = [
  ['/path','read',['storage_register','har_register','heap_import','page_add_script_tag','page_add_style_tag']],
  ['/path','write',['har_capture_start']],
  ['/resourcesDir','write',['har_capture_start']],
  ['/response/path','read',['callback_resolve']],   // route_fulfill body file
  // A string is a state file; an inline object is not a path and never matches.
  ['/options/storageState','read',['context_create','http_context_create']],
  ['/filePath','write',['trace_stop']],
  ['/options/path','write',['storage_export','http_context_storage_state']],
  ['/options/filePath','write',['trace_start']],
  ['/options/recordHar/path','write',['context_create']],
];
// Arrays have no wildcard pointer, so entries are checked by index up to a
// bound, and a longer array asks because its remaining entries go unchecked.
const certificates = {array:'/options/clientCertificates', items:['/certPath','/keyPath','/pfxPath'], checked:2};
const browserArrays = [
  {array:'/options/sourceFiles', items:[''], checked:4, operations:['trace_start']},  // at most 16
  {...certificates, operations:['context_create','http_context_create']},           // at most 16
  {array:'/request/body/fields', items:['/path'], checked:8, operations:['http_fetch']},  // multipart, at most 128
  {array:'/options/body/fields', items:['/path'], checked:8, operations:['http_fetch_request']},
];
const slug = pointer => pointer.replace(/^\//,'').replaceAll('/','-').toLowerCase() || 'item';

function pathRule(id, tool, pointer, access, fields = {}) {
  return {id, conditions:{domain:'mcp', server:'testrun', tool, fields:{...fields, [pointer]:anyString}},
    decision:allow, requirements:{field_paths:{[pointer]:within(access)}},
    on_unmet:{decision:'ask', message:message[access]}, reason:reason[access]};
}
function arrayRules(prefix, tool, base, {array, items, checked}, fields = {}) {
  const rules = [];
  for (let index = 0; index < checked; index++) for (const item of items)
    rules.push(pathRule(`${prefix}-${slug(`${array}/${index}${item}`)}`, tool, `${base}${array}/${index}${item}`, 'read', fields));
  rules.push({id:`${prefix}-${slug(array)}-overflow`,
    conditions:{domain:'mcp', server:'testrun', tool, fields:{...fields, [`${base}${array}/${checked}`]:present}},
    decision:ask, reason:`Entries after the first ${checked} are not checked for host files.`});
  return rules;
}
function browserRequestRules(tool, base, selector) {
  const prefix = `path-${tool}-${slug(base)}`;
  const scope = operations => ({[`${base}/${selector}`]:{text:{one_of:operations}}});
  return [
    ...browserFields.map(([pointer, access, operations]) =>
      pathRule(`${prefix}-${slug(pointer)}-${access}`, tool, base + pointer, access, scope(operations))),
    ...browserArrays.flatMap(({operations, ...array}) => arrayRules(prefix, tool, base, array, scope(operations))),
  ];
}
function toolRules(tool, fields) {
  return fields.map(([pointer, access]) => pathRule(`path-${tool}-${slug(pointer)}`, tool, pointer, access));
}

const configuration = ['config_check','config_show','config_schema','project_list','project_show',
  'project_status','project_start','project_open','project_discover','project_init_preview'];
const contextFields = tool => [
  ...toolRules(tool, [['/context/storageState','read'], ['/context/recordHar/path','write'],
    ['/mediaFixtures/microphonePath','read'], ['/mediaFixtures/cameraPath','read']]),
  // Launch context options sit directly under /context, not under /options.
  ...arrayRules(`path-${tool}-context`, tool, '/context', {...certificates, array:'/clientCertificates'}),
];

export function hostPathMcpRules() {
  return [
    ...browserRequestRules('browser_send', '/request', 'operation'),
    ...Array.from({length:8}, (_, index) => browserRequestRules('browser_send', `/request/requests/${index}`, 'operation')).flat(),
    // Browser `act` actions become one browser_send batch with the same fields.
    ...Array.from({length:8}, (_, index) => browserRequestRules('act', `/actions/${index}`, 'action')).flat(),
    ...contextFields('browser_connect'),
    ...contextFields('connect'),
    ...toolRules('app_install', [['/path','read']]),
    ...toolRules('diagnostics_export', [['/path','write']]),
    // Collector sources name host evidence, endpoint and configuration files and
    // native tools to run. A browser_operation source's request is not re-run.
    ...toolRules('diagnostics_start', ['path','reportDirectory','endpointFile','project','configFile','toolPath']
      .map(field => [`/source/${field}`,'read'])),
    ...configuration.flatMap(tool => toolRules(tool, ['/root','/project','/config'].map(pointer => [pointer,'read']))),
    ...toolRules('config_init', ['/root','/project','/config'].map(pointer => [pointer,'write'])),
    ...toolRules('project_init', [['/root','write'], ['/config','write']]),
    ...arrayRules('path-project_discover', 'project_discover', '', {array:'/paths', items:[''], checked:8}),
    ...['project_init','project_init_preview'].flatMap(tool =>
      arrayRules(`path-${tool}`, tool, '', {array:'/projects', items:['/path'], checked:8})),
    ...toolRules('build_start', [['/root','write'], ['/project','write'], ['/config','read'],
      ['/inline/artifact/path','read'], ['/inline/xcode/project','read']]),
  ];
}

// JSON keys whose string values name host files. CLI JSON arguments are opaque
// to Shield, so a path in them cannot be checked and asks; so does any \u
// escape, which could spell one of these keys.
export const jsonHostPathPatterns = [
  {regex:'(?s).*"(path|filePath|resourcesDir|storageState|certPath|keyPath|pfxPath|reportDirectory|endpointFile|configFile|toolPath|project)"\\s*:\\s*".*'},
  {regex:'(?s).*"sourceFiles"\\s*:\\s*\\[\\s*".*'},
  {regex:'(?s).*\\\\u.*'},
];

const leading = {flags:['--json'], values:['--target'], interleaved:true};
function cliRule(executable, id, prefix, {flags = [], values = [], options = {}, operands, leadingValues = [], require_any, forbid}) {
  const grammar = {kind:'options', prefix, leading:{...leading, values:[...leading.values, ...leadingValues]},
    flags:['--json', ...flags], values:['--target', ...values], operands:true, unknown_options:'skip'};
  const access = Object.values(options)[0] ?? operands;
  const selected = {...(Object.keys(options).length ? {options:Object.fromEntries(Object.entries(options)
    .map(([option, root]) => [option, {path:{within:{root}}}]))} : {}),
    ...(operands ? {operands:{path:{within:{root:operands}}}} : {})};
  return {id, conditions:{domain:'argv', executable:structuredClone(executable),
    arguments:{...structuredClone(grammar), ...(require_any ? {require_any} : {}), ...(forbid ? {forbid} : {})}},
  decision:allow, requirements:{argument_paths:{grammar, ...selected}},
  on_unmet:{decision:'ask', message:message[Object.values(options).includes('write') ? 'write' : access]},
  reason:'Testrun reads or writes the host files these arguments name; keep them inside the approved roots.'};
}
const read = 'read', write = 'write';
const configurationValues = ['--project','--root','--config','--path','--profile','--app','--cursor','--limit','--offset',
  '--version','--task','--check','--submission-id','--inline','--set-env','--configuration','--variant','--flavor',
  '--entry-point','--mode','--timeout-ms','--launch-arg','--launch-env','--kind','--platform'];
const configurationFlags = ['--local','--all','--install','--launch','--replace','--boot','--no-wait','--prepare','--yes','--dry-run'];

export function hostPathCliRules(executable) {
  const shared = {flags:configurationFlags, values:configurationValues};
  const mediaOptions = {'--microphone-fixture':read,'--camera-fixture':read};
  const browserConnect = {
    values:['--engine','--mode','--context','--proxy',...Object.keys(mediaOptions)],
    options:mediaOptions,
  };
  return [
    {id:'cli-json-host-path', conditions:{domain:'argv', executable:structuredClone(executable),
      arguments:{kind:'risk_tokens', prefix:[], any_of:structuredClone(jsonHostPathPatterns)}},
    decision:ask, reason:'A JSON argument names a host file that Shield cannot check; review it, or use the MCP tool.'},
    cliRule(executable, 'cli-app-install-path', ['app','install'],
      {flags:['--replace'], values:['--artifact-ref','--play-protect'], operands:read}),
    cliRule(executable, 'cli-browser-fixture-register-path', ['browser','fixture-register'],
      {values:['--mime-type','--provenance','--cleared-by','--clearance-method'], operands:read}),
    cliRule(executable, 'cli-connect-media-fixtures', ['connect'], browserConnect),
    cliRule(executable, 'cli-browser-connect-media-fixtures', ['browser','connect'],
      {...browserConnect, flags:['--downloads','--touch']}),
    cliRule(executable, 'cli-diagnostics-export-path', ['diagnostics','export'],
      {values:['--path','--filters','--cursor','--limit'], options:{'--path':write}}),
    cliRule(executable, 'cli-config-paths', ['config'],
      {...shared, options:{'--project':read,'--root':read,'--config':read}}),
    cliRule(executable, 'cli-config-init-paths', ['config','init'],
      {...shared, leadingValues:['--project','--root','--config'], options:{'--project':write,'--root':write,'--config':write}}),
    cliRule(executable, 'cli-project-paths', ['project'],
      {...shared, options:{'--project':read,'--root':read,'--path':read,'--config':read}}),
    cliRule(executable, 'cli-build-start-paths', ['build','start'],
      {...shared, options:{'--project':write,'--root':write,'--config':read}}),
    cliRule(executable, 'cli-init-paths', ['init'],
      {...shared, options:{'--root':write,'--config':write,'--path':read}, forbid:['--dry-run']}),
    cliRule(executable, 'cli-init-preview-paths', ['init'],
      {...shared, options:{'--root':read,'--config':read,'--path':read}, require_any:['--dry-run']}),
  ];
}

export const hostPathCapabilities = ['access-paths-v1','argument-paths-v1','field-negation-v1','field-paths-v1',
  'interleaved-leading-v1','location-v1','regex-v1','requirements-v1','unknown-options-v1'];
