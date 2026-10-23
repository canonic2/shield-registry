// Structural publication contract. Rust admission remains authoritative for
// pattern syntax/budgets, native paths, option relationships and resource limits.
const ref = name => ({ $ref: `#/$defs/${name}` });
const text = (minLength = 0, maxLength = 4096) => ({ type: 'string', minLength, maxLength, pattern: '^[^\\u0000]*$' });
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const array = (items, minItems = 0, uniqueItems = false, maxItems = 256) => ({ type: 'array', items, minItems, maxItems, ...(uniqueItems ? { uniqueItems: true } : {}) });
const one = schemas => ({ oneOf: schemas });
const any = schemas => ({ anyOf: schemas });
const enumeration = values => ({ enum: values });
const selector = nonempty => one([text(nonempty ? 1 : 0),
  ...['exact', 'prefix', 'glob', 'regex'].map(key => object({ [key]: text(nonempty || key === 'prefix' ? 1 : 0) })),
  object({ one_of: array(text(nonempty ? 1 : 0), 1, true) })]);
const enumSelector = values => one([enumeration(values), object({ one_of: array(enumeration(values), 1, true) })]);
const methodName = { ...text(1), pattern: '^[A-Z-]+$' };
const profiles = ['loose', 'recommended', 'strict'];
const decisions = ['allow', 'ask', 'deny'];
const profileDecision = allowed => {
  const values = [];
  for (const a of allowed) for (const b of allowed) for (const c of allowed)
    if (decisions.indexOf(a) <= decisions.indexOf(b) && decisions.indexOf(b) <= decisions.indexOf(c))
      values.push(Object.fromEntries(profiles.map((p, i) => [p, [a, b, c][i]])));
  return enumeration(values);
};
const optionName = { ...text(2, 128), pattern: '^(-[A-Za-z0-9]|--[A-Za-z0-9-]+)$' };
const longOption = { ...optionName, pattern: '^--[A-Za-z0-9-]+$' };
const declaration = name => one([name, object({ name, match: ref('textSelector'), repeat: enumeration(['all', 'forbid', 'last']) }, ['name'])]);
const count = { type: 'integer', minimum: 0, maximum: 256 };
const counts = { min: count, max: count };
const syntax = { short_clusters: { type: 'boolean' }, short_attached: { type: 'boolean' }, long_equals: { type: 'boolean' } };
const grammar = { flags: array(optionName, 0, true), values: array(declaration(optionName), 0, true),
  optional_values: array(declaration(longOption), 0, true), ...syntax };
const nullable = schema => one([schema, { type: 'null' }]);
const jsonObject = { type: 'object' };
const stringMap = { type: 'object', maxProperties: 256, propertyNames: text(1), additionalProperties: text() };
const guidance = { message: text(1, 512), alternatives: array(text(1, 256), 1, false, 3) };
const quantified = one([object({ all: ref('pathPredicate') }), object({ any: ref('pathPredicate') })]);
const target = one(['all', 'any'].map(key => object({ action: enumeration(['read', 'write', 'remove']), [key]: ref('pathPredicate') })));
const fields = { type: 'object', minProperties: 1, maxProperties: 256,
  propertyNames: { ...text(0, 1024), pattern: '^(|/(?:[^~]|~[01])*)$' },
  additionalProperties: one([object({ exact: {} }), object({ text: ref('textSelector') })]) };
const common = { cwd: ref('pathPredicate'), environment: ref('environment') };
const predicates = {
  argv: { arguments: ref('arguments'), targets: ref('targets'), possible_effects: array(enumeration(['repository-write', 'worktree-write', 'data-removal', 'history-rewrite', 'network', 'code-execution', 'daemon-write', 'image-build', 'host-exposure', 'privileged-runtime', 'configuration']), 1, true) },
  shell: { source: ref('textSelector'), dialect_version: one([text(1), object({ exact: text(1) })]) },
  file: { sources: quantified, destination: ref('pathPredicate'), recursive: { type: 'boolean' }, targets: ref('targets') },
  web: { url: ref('url'), query: ref('textSelector'), method: one([methodName, object({ exact: methodName }), object({ one_of: array(methodName, 1, true) })]), request_fields: fields },
  mcp: { arguments: jsonObject, fields },
};
predicates.argv.argument_paths = ref('argumentPaths');
const identities = {
  argv: { executable: any([ref('identitySelector'), ref('pathReference')]) },
  shell: { source: ref('textSelector'), dialect: enumSelector(['bash', 'posix', 'powershell', 'cmd']) },
  file: { action: enumSelector(['read', 'write', 'copy', 'move', 'remove']) },
  web: { action: enumeration(['search', 'fetch']) },
  mcp: { server: ref('identitySelector'), tool: ref('identitySelector') },
};
const has = key => ({ required: [key] });
const at = (path, value = {}) => {
  if (!path.length) return value;
  const [key, ...rest] = path;
  if (key === '*') return { type: 'array', contains: at(rest, value) };
  if (key === '@') return { type: 'object', not: { additionalProperties: { not: at(rest, value) } } };
  return { type: 'object', required: [key], properties: { [key]: at(rest, value) } };
};
const eitherPredicate = (path, value = {}) => any(['conditions', 'requirements'].map(key => at([key, ...path], value)));
const allows = at(['decision'], any([{ const: 'allow' }, at(['loose'], { const: 'allow' })]));
const identityFields = (domain, pack) => Object.fromEntries(Object.entries(identities[domain]).map(([key, value]) =>
  [key, pack && ['action', 'dialect'].includes(key) ? any([value, ref('variableReference')]) : value]));
function rule(pack, domain) {
  const decision = pack ? one([enumeration(decisions), profileDecision(decisions)]) : enumeration(decisions);
  const unmet = pack ? one([enumeration(['ask', 'deny']), profileDecision(['ask', 'deny'])]) : enumeration(['ask', 'deny']);
  const condition = domain === 'exact_request'
    ? object({ domain: { const: domain }, input: ref('input'), context: object({ cwd: text(1), environment: nullable(stringMap) }), executable: nullable(text(1)) })
    : object({ domain: { const: domain }, ...common, ...predicates[domain], ...identityFields(domain, pack) }, ['domain', ...Object.keys(identities[domain])]);
  const props = { id: { ...text(1, 128), pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$' }, decision, conditions: condition,
    reason: text(1), guidance: { ...object(guidance, []), minProperties: 1 },
    ...(pack ? { when: array(ref('variableTest'), 1, false, 16), fallback: { const: true }, ...(domain === 'argv' ? { invocation: ref('bindingName'), command_set: ref('bindingName') } : {}) } : {}),
    ...(!pack ? { expires_at: { ...text(1), pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?Z$' } } : {}) };
  const checks = [];
  if (pack && domain === 'argv') checks.push(
    { if: has('command_set'), then: has('invocation') },
    { if: has('invocation'), then: { allOf: [at(['conditions','executable'],one([text(1),object({exact:text(1)})])),at(['conditions'],has('arguments')),{not:at(['conditions','arguments'],has('leading'))}] } },
  );
  if (domain !== 'exact_request') {
    props.requirements = { ...object({ ...common, ...predicates[domain] }, []), minProperties: 1 };
    props.on_unmet = object({ decision: unmet, ...guidance }, ['decision']);
    checks.push({ if: has('requirements'), then: has('on_unmet'), else: { not: has('on_unmet') } });
  }
  if (domain === 'argv') checks.push(eitherPredicate(['arguments']));
  if (domain === 'web') for (const [action, field] of [['fetch', 'url'], ['search', 'query']])
    checks.push({ if: at(['conditions', 'action'], { const: action }), then: eitherPredicate([field]) });
  if (domain === 'mcp') for (const key of ['conditions', 'requirements'])
    checks.push({ not: at([key], { required: ['arguments', 'fields'] }) });
  if (domain === 'argv') checks.push({ if: eitherPredicate(['arguments', 'kind'], { const: 'risk_tokens' }), then: { not: allows } });
  if (domain === 'shell') checks.push({ if: allows, then: { allOf: [
    eitherPredicate(['cwd', 'exact']), eitherPredicate(['environment', 'exact']),
    ...['conditions', 'requirements'].map(key => ({ if: at([key, 'source']), then: at([key, 'source'], one([text(), object({ exact: text() }), ...(pack ? [ref('variableReference')] : [])])) })),
  ] } });
  if (domain === 'file' || domain === 'argv') checks.push({ if: allows, then: { allOf: ['conditions', 'requirements'].flatMap(key => [
    { not: at([key, 'sources', 'any']) },
    { not: at([key, 'targets', 'any']) },
    { not: at([key, 'targets', '*', 'any']) },
  ]) } });
  const result = { ...object(props, ['id', 'decision', 'conditions']), ...(checks.length ? { allOf: checks } : {}) };
  return pack ? withVariables(result) : result;
}

// Pack selectors resolve before evaluation; custom documents keep literal schemas.
const dynamicDefs = new Set(['textSelector', 'identitySelector', 'pathReference', 'pathPredicate', 'targets', 'environment', 'url', 'arguments', 'argumentPaths']);
const packName = name => `pack${name[0].toUpperCase()}${name.slice(1)}`;
function withVariables(value) {
  if (Array.isArray(value)) return value.map(withVariables);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => {
    const name = key === '$ref' && child.startsWith('#/$defs/') ? child.slice(8) : undefined;
    return [key, name && dynamicDefs.has(name) ? `#/$defs/${packName(name)}` : withVariables(child)];
  }));
}
const defs = {
  bindingName: { ...text(1,64), pattern:'^[A-Za-z0-9._:-]+$' },
  invocation: object({ id_prefix:{...text(1,64),pattern:'^[A-Za-z0-9][A-Za-z0-9._:]*$'},segments:array(array(array(text()),1,true),1,false,16) }),
  commandSet: { type:'object',minProperties:1,maxProperties:500000,propertyNames:text(1),additionalProperties:{...text(1,128),pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]*$'} },
  textSelector: selector(false), identitySelector: selector(true),
  pathReference: one([object({ root: { enum: ['project','read','write'] }, path: { ...text(1), pattern: '^(?!/)(?!.*(?:^|/)\\.\\.(?:/|$)).*$' } }, ['root']),
    object({ root: { const: 'absolute' }, path: { ...text(1), pattern: '^(?:/|[A-Za-z]:[\\\\/]|\\\\\\\\)' } })]),
  pathPredicate: one([object({ exact: ref('pathReference') }), object({ outside: ref('pathReference') }),
    object({ within: ref('pathReference'), exclude: array(ref('pathReference')), match: ref('textSelector') }, ['within'])]),
  targets: one([target, array(target, 1)]),
  environment: one([object({ exact: stringMap }), object({ fields: { type: 'object', minProperties: 1, maxProperties: 256, propertyNames: text(1), additionalProperties: ref('textSelector') } })]),
  url: object({ schemes: array(enumeration(['http', 'https']), 1, true), hosts: array({ ...text(1), pattern: '^[^A-Z/@?#\\s]+$' }, 1, true),
    ports: array({ type: 'integer', minimum: 1, maximum: 65535 }, 0, true), path: ref('textSelector') }, ['schemes', 'hosts']),
  arguments: one([
    object({ kind: { const: 'any' } }),
    object({ kind: { const: 'exact' }, values: array(text()) }),
    object({ kind: { const: 'prefix' }, values: array(ref('textSelector'), 1), leading: object(grammar, ['flags', 'values']) }, ['kind', 'values']),
    object({ kind: { const: 'sequence' }, prefix: array(ref('textSelector')), rest: one([
      object({ kind: { const: 'none' } }), object({ kind: { const: 'any' } }),
      object({ kind: { const: 'each' }, match: ref('textSelector'), ...counts }, ['kind', 'match']),
    ]) }),
    object({ kind: { const: 'risk_tokens' }, prefix: array(ref('textSelector')), any_of: array(ref('textSelector'), 1) }),
    object({ kind: { const: 'options' }, prefix: array(ref('textSelector')), ...grammar,
      leading: object(grammar, ['flags', 'values']), operands: one([{ type: 'boolean' }, object({ match: ref('textSelector'), ...counts }, ['match'])]),
      parse: enumeration(['intermixed', 'stop_at_operand']), require_all: array(optionName, 0, true),
      require_any: array(optionName, 0, true), forbid: array(optionName, 0, true),
    }, ['kind', 'prefix', 'flags', 'values', 'operands']),
  ]),
};
const input = (kind, properties) => object({ kind: { const: kind }, ...properties, original_input: jsonObject });
defs.argumentPaths = object({
  grammar: {allOf: [ref('arguments'), at(['kind'], {const: 'options'})]},
  options: {type: 'object', maxProperties: 256, propertyNames: optionName,
    additionalProperties: object({path: ref('pathPredicate'), recursive: {type: 'boolean'}}, ['path'])},
  operands: object({path: ref('pathPredicate'), recursive: {type: 'boolean'}}, ['path']),
}, ['grammar']);
defs.argumentPaths.anyOf = [at(['options'], {minProperties: 1}), has('operands')];
defs.input = one([
  input('argv', { executable: text(1), arguments: array(text()) }),
  input('shell', { source: text(0, 65536), dialect: enumeration(['posix', 'bash', 'powershell', 'cmd']), dialect_version: nullable(text()) }),
  input('file', { action: enumeration(['read', 'write', 'copy', 'move', 'remove']), sources: array(text(1)), destination: nullable(text(1)), recursive: { type: 'boolean' } }),
  input('web', { action: enumeration(['search', 'fetch']), query: nullable(text()), url: nullable(text(1)), method: nullable(text(1)), conditions: jsonObject }),
  input('mcp', { server: text(1), tool: text(1), arguments: jsonObject }),
  input('unknown', { host_tool: text(1) }),
]);
const caps = ['structured-rules-v1', 'argument-rules-v1', 'glob-v1', 'regex-v1', 'location-v1', 'requirements-v1', 'possible-effects-v1', 'dependencies-v1', 'access-paths-v1', 'fallback-rules-v1', 'invocation-groups-v1', 'command-sets-v1'];
caps.push('argument-paths-v1');
caps.push('prefix-leading-v1');
const variableName = {...text(1, 64), pattern: '^[a-z][a-z0-9_]*$'};
const scalarValue = one([text(1, 1024), {type: 'boolean'}, array(text(1, 1024), 1, true)]);
defs.variableReference = object({var: variableName});
defs.variableTest = one([
  object({var: variableName, set: {type: 'boolean'}}),
  object({var: variableName, equals: one([text(1, 1024), {type: 'boolean'}])}),
  ...['in', 'not_in'].map(key => object({var: variableName, [key]: array(text(1, 1024), 1, true)})),
  object({var: variableName, contains: text(1, 1024)}),
]);
const tests = array(ref('variableTest'), 1, false, 16);
const setup = object({question: text(1, 256), unset: text(1, 64), value: text(1, 64), placeholder: text(1, 128), ask_when: tests}, []);
const stringConstraints = {match: ref('textSelector'), max_length: {type: 'integer', minimum: 1, maximum: 1024}};
const choices = array(text(1, 1024), 1, true);
defs.variableDeclaration = one(['choice', 'string', 'list', 'boolean', 'path'].map(type => {
  const value = type === 'boolean' ? {type: 'boolean'} : type === 'list' ? array(text(1, 1024), 1, true) : text(1, type === 'path' ? 4096 : 1024);
  const common = {type: {const: type}, description: text(1, 512), default: value, required: {type: 'boolean'},
    layer: enumeration(['project', 'local']), setup,
    suggest: array(object({file: text(1), value}), 0, false, 16)};
  const specific = type === 'choice' ? {values: choices} : type === 'string' ? stringConstraints
    : type === 'path' ? {within: enumeration(['project', 'anywhere'])} : type === 'list' ? {
      items: one([object({type: {const: 'choice'}, values: choices}), object({type: {const: 'string'}, ...stringConstraints}, ['type'])]),
      min_items: {type: 'integer', minimum: 1, maximum: 256}, max_items: {type: 'integer', minimum: 1, maximum: 256},
    } : {};
  return {...object({...common, ...specific}, ['type', 'description', ...(type === 'choice' ? ['values'] : type === 'list' ? ['items'] : [])]), allOf: [
    ...(['choice', 'boolean'].includes(type) ? [{not: any([at(['setup'], has('value')), at(['setup'], has('placeholder'))])}] : []),
    {if: {allOf: [at(['required'], {const: true}), {not: has('default')}]}, then: {not: any([at(['setup'], has('unset')), at(['setup'], has('ask_when'))])}},
  ]};
}));
for (const name of dynamicDefs) defs[packName(name)] = withVariables(defs[name]);
for (const name of ['textSelector', 'identitySelector', 'pathReference']) {
  defs[packName(name)].oneOf.push(ref('variableReference'));
}
// Optional variable matches and conditional presence items are limited to options.
const packOptions = defs.packArguments.oneOf.find(branch => branch.properties.kind.const === 'options');
for (const phase of [packOptions.properties, packOptions.properties.leading.properties]) {
  for (const key of ['values', 'optional_values']) {
    const match = phase[key].items.oneOf[1].properties.match;
    phase[key].items.oneOf[1].properties.match = one([match, object({var: variableName, unset: {const: 'any'}})]);
  }
}
for (const key of ['require_all', 'require_any', 'forbid']) {
  packOptions.properties[key].items = one([optionName, object({name: optionName, when: tests})]);
}
const domains = [...Object.keys(predicates), 'exact_request'];
defs.packRule = one(domains.map(domain => rule(true, domain)));
defs.customRule = one(domains.map(domain => rule(false, domain)));
defs.precondition = one(Object.keys(predicates).map(domain => withVariables(object({
  id: {...text(1, 128), pattern: '^[A-Za-z0-9][A-Za-z0-9._:-]*$'}, when: tests, reason: text(1),
  conditions: object({domain: {const: domain}, ...common, ...predicates[domain], ...identityFields(domain, true)}, ['domain', ...Object.keys(identities[domain])]),
  requires_any: array({...object({...common, ...predicates[domain], ...identityFields(domain, true)}, []), minProperties: 1}, 1, false, 16),
  on_unmet: object({decision: one([enumeration(['ask', 'deny']), profileDecision(['ask', 'deny'])]), ...guidance}, ['decision']),
}, ['id', 'conditions', 'requires_any', 'on_unmet']))));
const dependencyProfiles = { enum: [] };
// Profile ordering uses its own ordered vocabulary.
dependencyProfiles.enum = [];
for (const a of profiles) for (const b of profiles) for (const c of profiles)
  if (profiles.indexOf(a) <= profiles.indexOf(b) && profiles.indexOf(b) <= profiles.indexOf(c))
    dependencyProfiles.enum.push({ loose: a, recommended: b, strict: c });
defs.dependency = object({ pack: { ...text(1, 128), pattern: '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}$' }, requirement: text(1),
  registry: text(1), profiles: dependencyProfiles }, ['pack', 'requirement']);
// Feature detection traverses only predicate positions, never exact typed JSON.
const directText = ['executable', 'source', 'query', 'server', 'tool'];
const argumentText = [['values', '*'], ['prefix', '*'], ['any_of', '*'], ['rest', 'match'], ['operands', 'match'],
  ...['values', 'optional_values'].flatMap(key => [[key, '*', 'match'], ['leading', key, '*', 'match']])];
const pathText = [['cwd', 'match'], ['destination', 'match'], ['sources', 'all', 'match'], ['sources', 'any', 'match'],
  ...['all', 'any'].flatMap(key => [['targets', key, 'match'], ['targets', '*', key, 'match']])];
const textPaths = [
  ...directText.map(key => [key]), ['url', 'path'], ['environment', 'fields', '@'],
  ['fields', '@', 'text'], ['request_fields', '@', 'text'], ...pathText,
];
const argumentPathSelections = [['argument_paths', 'options', '@', 'path'], ['argument_paths', 'operands', 'path']];
textPaths.push(...argumentPathSelections.map(path => [...path, 'match']));
const feature = {
  'prefix-leading-v1': eitherPredicate(['arguments'], {allOf: [at(['kind'], {const: 'prefix'}), has('leading')]}),
  'argument-paths-v1': eitherPredicate(['argument_paths']),
  'invocation-groups-v1': has('invocation'),
  'command-sets-v1': has('command_set'),
  'access-paths-v1': any([
    at(['conditions','executable','root'], { enum:['read','write'] }),
    ...['exact','within','outside'].flatMap(operator => [
      ...['cwd','destination'].map(key => eitherPredicate([key,operator,'root'],{enum:['read','write']})),
      ...['all','any'].flatMap(q => [
        eitherPredicate(['sources',q,operator,'root'],{enum:['read','write']}),
        eitherPredicate(['targets',q,operator,'root'],{enum:['read','write']}),
        eitherPredicate(['targets','*',q,operator,'root'],{enum:['read','write']}),
      ]),
    ]),
    ...['cwd','destination'].map(key => eitherPredicate([key,'exclude','*','root'],{enum:['read','write']})),
    ...['all','any'].flatMap(q => [
      eitherPredicate(['sources',q,'exclude','*','root'],{enum:['read','write']}),
      eitherPredicate(['targets',q,'exclude','*','root'],{enum:['read','write']}),
      eitherPredicate(['targets','*',q,'exclude','*','root'],{enum:['read','write']}),
    ]),
  ]),
  'argument-rules-v1': { allOf: [at(['conditions', 'domain'], { const: 'argv' }), eitherPredicate(['arguments'])] },
  'location-v1': any([at(['conditions', 'domain'], { const: 'file' }), at(['conditions', 'executable', 'root']),
    ...['cwd', 'destination', 'sources', 'targets'].map(key => eitherPredicate([key]))]),
  'requirements-v1': has('requirements'),
  'possible-effects-v1': eitherPredicate(['possible_effects']),
  'fallback-rules-v1': has('fallback'),
};
feature['location-v1'] = any([feature['location-v1'], eitherPredicate(['argument_paths'])]);
feature['access-paths-v1'].anyOf.push(...argumentPathSelections.flatMap(path => [
  ...['exact', 'within', 'outside'].map(operator => eitherPredicate([...path, operator, 'root'], {enum: ['read', 'write']})),
  eitherPredicate([...path, 'exclude', '*', 'root'], {enum: ['read', 'write']}),
]));
for (const operator of ['glob', 'regex']) {
  const shape = object({ [operator]: text() });
  feature[`${operator}-v1`] = any([
    ...textPaths.map(path => eitherPredicate(path, shape)),
    ...argumentText.map(path => ({ allOf: [at(['conditions', 'domain'], { const: 'argv' }), eitherPredicate(['arguments', ...path], shape)] })),
    ...argumentText.map(path => eitherPredicate(['argument_paths', 'grammar', ...path], shape)),
  ]);
}
const capabilityChecks = Object.entries(feature).map(([name, shape]) => ({
  if: any([at(['rules', '*'], shape),
    ...(name === 'argument-rules-v1' ? [at(['preconditions', '*', 'conditions', 'domain'], {const: 'argv'})] : []),
    ...(name === 'location-v1' ? [at(['preconditions', '*', 'conditions', 'domain'], {const: 'file'})] : []),
    ...(['regex-v1', 'glob-v1'].includes(name) ? [at(['variables', '@', 'match'], object({[name.split('-')[0]]: text()})), at(['variables', '@', 'items', 'match'], object({[name.split('-')[0]]: text()}))] : []),
  ]),
  then: at(['capabilities'], { contains: { const: name } }),
  // Dynamic source features are counted on Rust's sample-resolved policy,
  // including variable paths and precondition alternatives. Keep exact static
  // inventories here and leave resolved feature equality to Rust admission.
  else: {if: {not: any([at(['variables'], {minProperties: 1}), at(['preconditions'], {minItems: 1})])},
    then: at(['capabilities'], { not: { contains: { const: name } } })},
}));
defs.documentCapabilities = { allOf: [...capabilityChecks, {
  if: has('dependencies'), then: at(['capabilities'], { contains: { const: 'dependencies-v1' } }),
  else: at(['capabilities'], { not: { contains: { const: 'dependencies-v1' } } }),
}] };
for (const [name, shape] of Object.entries({
  'variables-v1': at(['variables'], {minProperties: 1}),
  'preconditions-v1': at(['preconditions'], {minItems: 1}),
})) defs.documentCapabilities.allOf.push({if: shape, then: at(['capabilities'], {contains: {const: name}}), else: at(['capabilities'], {not: {contains: {const: name}}})});
// Without templates-v1, double braces are ordinary literal text.
defs.documentCapabilities.allOf.push({if: at(['capabilities'], {contains: {const: 'templates-v1'}}), then:
  any(['rules', 'preconditions'].flatMap(key => ['reason', 'guidance', 'on_unmet'].flatMap(field => field === 'reason'
    ? [at([key, '*', field], {type: 'string', pattern: '\\{\\{'})]
    : [at([key, '*', field, 'message'], {type: 'string', pattern: '\\{\\{'}), at([key, '*', field, 'alternatives', '*'], {type: 'string', pattern: '\\{\\{'})])))});
const document = pack => {
  const allowedCaps = pack ? [...caps, 'variables-v1', 'preconditions-v1', 'templates-v1'] : caps;
  const base = { schema_version: { const: 1 }, kind: { const: pack ? 'pack' : 'custom' },
    capabilities: { ...array(enumeration(allowedCaps), 1, true, allowedCaps.length), contains: { const: 'structured-rules-v1' } },
    rules: array(ref(pack ? 'packRule' : 'customRule'), 0, false, 500000) };
  const extra = pack ? { id: { ...text(1, 128), pattern: '^[a-z0-9-]{1,64}/[a-z0-9-]{1,64}$' }, version: text(1, 128),
    description: text(1), license: text(1), maintainers: array(text(1, 128), 1, true),
    // The Shield versions the pack supports; Shield can check no other program.
    engines: object({ shield: text(1, 1024) }),
    dependencies: array(ref('dependency'), 0, false, 256),
    variables: {type: 'object', maxProperties: 64, propertyNames: variableName, additionalProperties: ref('variableDeclaration')},
    preconditions: array(ref('precondition'), 0, false, 256),
    invocations:{type:'object',maxProperties:64,propertyNames:ref('bindingName'),additionalProperties:ref('invocation')},
    command_sets:{type:'object',maxProperties:500000,propertyNames:ref('bindingName'),additionalProperties:ref('commandSet')} } : {};
  return { ...object({ ...base, ...extra }, [...Object.keys(base), ...Object.keys(extra).filter(key => !['dependencies','invocations','command_sets','variables','preconditions'].includes(key))]),
    allOf: [ref('documentCapabilities')] };
};
defs.pack = document(true); defs.custom = document(false);
const fixture = { name: text(1), profile: enumeration(profiles), expected: enumeration(decisions),
  variables: {type: 'object', maxProperties: 64, propertyNames: variableName, additionalProperties: scalarValue} };
defs.cases = object({ schema_version: { const: 1 }, cases: array(one([
  object({ ...fixture, argv: array(text(), 1) }, ['name', 'profile', 'expected', 'argv']),
  object({ ...fixture, input: ref('input') }, ['name', 'profile', 'expected', 'input']),
]), 1, false, 1024) });
export const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'urn:shield:structured-policy-v1',
  title: 'Shield structured v1 policy documents', $comment: 'Structural source admission. Validate every new publication with the current Rust core for semantic and resource acceptance.',
  oneOf: [ref('pack'), ref('custom'), ref('cases')], $defs: defs,
};
