import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { schemaValidator } from './schema-validation.mjs';
import { schema } from './policy-schema.mjs';
import { validatorFor, singleEngine } from './pack-formats.mjs';

const validate = schemaValidator(schema);
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const pack = (conditions = { domain: 'argv', executable: 'acme', arguments: { kind: 'any' } }, capabilities = ['argument-rules-v1', 'structured-rules-v1']) => ({
  schema_version: 1, kind: 'pack', id: 'acme/inspection', version: '0.1.0', description: 'Acme inspection fixture',
  license: 'MIT', maintainers: ['Acme'], engines: { shield: '*' }, capabilities,
  rules: [{ id: 'inspect', decision: { loose: 'ask', recommended: 'ask', strict: 'deny' }, conditions }],
});
function core(value) {
  const owner = mkdtempSync(join(tmpdir(), 'shield-schema-'));
  try {
    const path = join(owner, 'document.json');
    writeFileSync(path, JSON.stringify(value));
    return spawnSync(process.env.SHIELD_BINARY, ['__internal', 'validate', value.kind === 'custom' ? '--rules' : '--pack', path],
      { encoding: 'utf8', timeout: 10000 }).status;
  } finally { rmSync(owner, { recursive: true, force: true }); }
}
const accepted = value => {
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
  if (process.env.SHIELD_BINARY) assert.equal(core(value), 0, JSON.stringify(value));
};
const rejected = value => {
  assert.equal(validate(value), false, JSON.stringify(value));
  if (process.env.SHIELD_BINARY) assert.equal(core(value), 2, JSON.stringify(value));
};
test('Prefix leading grammars require their capability and admit only declared phase fields', () => {
  const document = pack({domain: 'argv', executable: 'acme', arguments: {
    kind: 'prefix', values: ['login'], leading: {flags: ['-q'], values: ['--format']},
  }}, ['structured-rules-v1', 'argument-rules-v1', 'prefix-leading-v1']);
  accepted(document);
  const missing = structuredClone(document);
  missing.capabilities = missing.capabilities.filter(name => name !== 'prefix-leading-v1');
  rejected(missing);
  const invalid = structuredClone(document);
  invalid.rules[0].conditions.arguments.leading.operands = true;
  rejected(invalid);
});
test('Explicit argument paths declare their capability and require a complete grammar', () => {
  const document = pack({domain: 'argv', executable: 'acme', arguments: {kind: 'any'}, argument_paths: {
    grammar: {kind: 'options', prefix: ['build'], flags: [], values: ['--output'], operands: false},
    options: {'--output': {path: {within: {root: 'write'}}, recursive: true}},
  }}, ['structured-rules-v1', 'argument-rules-v1', 'argument-paths-v1', 'location-v1', 'access-paths-v1']);
  accepted(document);
  const exact = structuredClone(document);
  exact.rules[0].conditions.argument_paths.options['--output'].path = {exact: {root: 'write', path: 'out'}};
  accepted(exact);
  const missing = structuredClone(document);
  missing.capabilities = missing.capabilities.filter(name => name !== 'argument-paths-v1');
  rejected(missing);
  const partial = structuredClone(document);
  partial.rules[0].conditions.argument_paths.grammar = {kind: 'prefix', values: ['build']};
  rejected(partial);
  const empty = structuredClone(document);
  empty.rules[0].conditions.argument_paths.options = {};
  rejected(empty);
  const invalid = structuredClone(document);
  invalid.rules[0].conditions.argument_paths.options['--output'].recursive = 'yes';
  rejected(invalid);
  // Structural JSON Schema leaves option-name relationships to Rust admission.
  const undeclared = structuredClone(document);
  undeclared.rules[0].conditions.argument_paths.options['--other'] = {path: {within: {root: 'project'}}};
  if (process.env.SHIELD_BINARY) assert.equal(core(undeclared), 2);
});
test('Decision fixtures admit argv or normalized input and reject ambiguous cases', () => {
  const common = {name: 'inspect', profile: 'recommended', expected: 'allow'};
  const input = {kind: 'shell', source: 'git status', dialect: 'posix', dialect_version: null, original_input: {}};
  for (const value of [{...common, argv: ['git', 'status']}, {...common, input}]) {
    assert.equal(validate({schema_version: 1, cases: [value]}), true, JSON.stringify(validate.errors));
  }
  for (const value of [common, {...common, argv: []}, {...common, argv: ['git'], input},
    {...common, input: {...input, unexpected: true}}]) {
    assert.equal(validate({schema_version: 1, cases: [value]}), false);
  }
});
test('Generated schema is reproducible and immutable historical formats stay separate', () => {
  assert.ok(readFileSync(new URL('../schemas/policy.schema.json', import.meta.url)).length <= 1_048_576,
    'The generated schema must fit the publication artifact bound');
  assert.deepEqual(read('../schemas/policy.schema.json'), schema);
  const legacy = schemaValidator(read('../schemas/policy-legacy.schema.json'));
  for (const version of ['0.1.0', '0.2.0']) {
    const old = read(`../packs/canonic/git/${version}/pack.yml`);
    assert.equal(legacy(old), true);
    assert.equal(validate(old), false);
  }
  // Structured releases for Shield 0.1.12 and earlier keep the single engine field.
  const single = schemaValidator(read('../schemas/policy-shield-0.1.12.schema.json'));
  for (const path of read('../release.json').packs) {
    const published = read(`../${path}`);
    if (published.kind !== 'pack') continue;
    assert.equal(validatorFor(published)(published), true, path);
    assert.equal(singleEngine(published) ? single(published) : validate(published), true, path);
  }
});
test('Packs name Shield as the only program whose version they require', () => {
  const { engines, ...rest } = pack();
  rejected({ ...rest, engine: engines.shield });
  rejected({ ...rest, engines: { ...engines, node: '>=24' } });
  rejected({ ...rest, engines: {} });
  rejected(rest);
});
test('All six domains and structured grammar agree with Rust admission', () => {
  accepted(pack());
  accepted(pack({ domain: 'argv', executable: { root: 'project', path: 'bin/acme' }, arguments: { kind: 'any' } },
    ['location-v1', 'structured-rules-v1', 'argument-rules-v1']));
  accepted(pack({ domain: 'argv', executable: { one_of: ['acme', 'acme2'] }, arguments: { kind: 'sequence',
    prefix: [{ prefix: 'inspect' }, { regex: '(json|csv)' }], rest: { kind: 'each', match: { glob: '*.report' }, min: 1, max: 8 } } },
    ['structured-rules-v1', 'argument-rules-v1', 'regex-v1', 'glob-v1']));
  const required = pack({ domain: 'argv', executable: 'acme' }, ['argument-rules-v1', 'requirements-v1', 'structured-rules-v1', 'regex-v1']);
  required.rules[0].requirements = { arguments: { kind: 'options', prefix: ['inspect'], flags: ['--read-only'], values: [{ name: '--format', match: { regex: 'json|csv' }, repeat: 'last' }],
    optional_values: ['--color'], operands: false, require_all: ['--read-only'], leading: { flags: ['-v'], values: [] } } };
  required.rules[0].on_unmet = { decision: 'deny', message: 'Use the read-only option.', alternatives: ['acme inspect --read-only'] };
  accepted(required);
  accepted(pack({ domain: 'file', action: 'read', sources: { all: { within: { root: 'project' }, exclude: [{ root: 'project', path: '.git' }] } } },
    ['structured-rules-v1', 'location-v1']));
  accepted(pack({ domain: 'web', action: 'fetch', url: { schemes: ['https'], hosts: ['example.com'], path: { regex: '/reports/.*' } },
    method: { exact: 'PROPFIND' }, request_fields: { '/trace': { exact: null } } }, ['structured-rules-v1', 'regex-v1']));
  accepted(pack({ domain: 'mcp', server: { prefix: 'acme' }, tool: { one_of: ['inspect', 'report'] },
    fields: { '/nullable': { exact: null }, '/format': { text: { glob: '*.json' } }, '/opaque': { exact: { regex: 'literal', root: 'project' } } } },
    ['glob-v1', 'structured-rules-v1']));
  accepted(pack({ domain: 'shell', source: { glob: 'acme *' }, dialect: { one_of: ['bash', 'posix'] },
    cwd: { within: { root: 'project' } }, environment: { fields: { ACME_MODE: 'inspection' } } },
    ['structured-rules-v1', 'location-v1', 'glob-v1']));
  const exactMcp = pack({ domain: 'exact_request', input: { kind: 'mcp', server: 'acme', tool: 'inspect',
    arguments: { regex: 'literal', nested: null }, original_input: { description: 'Acme opaque request' } },
    context: { cwd: '/workspace/acme', environment: null }, executable: null }, ['structured-rules-v1']);
  rejected(exactMcp);
  accepted({ schema_version: 1, kind: 'custom', capabilities: exactMcp.capabilities,
    rules: [{ ...exactMcp.rules[0], decision: 'ask' }] });
});
test('Approved root capabilities agree with core admission in every path position',()=>{
  for(const condition of [
    {domain:'file',action:'read',sources:{all:{exact:{root:'read',path:'notes.txt'}}}},
    {domain:'file',action:'write',destination:{within:{root:'write'}}},
    {domain:'argv',executable:'rm',arguments:{kind:'any'},targets:[{action:'remove',all:{within:{root:'project'},exclude:[{root:'write',path:'.git'}]}}]},
    {domain:'argv',executable:'acme',arguments:{kind:'any'},cwd:{outside:{root:'read'}}},
  ]){
    const capabilities=['structured-rules-v1','location-v1','access-paths-v1',...(condition.domain==='argv'?['argument-rules-v1']:[])];
    accepted(pack(condition,capabilities));
    rejected(pack(condition,capabilities.filter(c=>c!=='access-paths-v1')));
  }
  accepted(pack({domain:'mcp',server:'acme',tool:'inspect',fields:{'/opaque':{exact:{root:'read'}}}},['structured-rules-v1']));
});
test('Capability detection ignores exact typed JSON and accepts unordered complete inventories', () => {
  const value = pack({ domain: 'mcp', server: 'acme', tool: 'inspect',
    arguments: { requirements: {}, possible_effects: [], glob: '*', regex: 'literal' } }, ['structured-rules-v1']);
  accepted(value);
  rejected({ ...value, capabilities: ['structured-rules-v1', 'glob-v1'] });
  for (const capabilities of [['structured-rules-v1'], ['structured-rules-v1', 'argument-rules-v1', 'regex-v1'],
    ['structured-rules-v1', 'argument-rules-v1', 'argument-rules-v1'], ['structured-rules-v1', 'unknown-v1']])
    rejected({ ...pack(), capabilities });
  const effect = pack();
  effect.rules[0].conditions.possible_effects = ['network'];
  effect.capabilities.push('possible-effects-v1');
  accepted(effect);
  const dependency = pack();
  dependency.dependencies = [{ pack: 'acme/base', requirement: '^1.0', profiles: { loose: 'recommended', recommended: 'recommended', strict: 'strict' } }];
  dependency.capabilities.push('dependencies-v1');
  accepted(dependency);
  dependency.dependencies = [];
  accepted(dependency);
  rejected({ ...pack(), dependencies: [] });
});
test('Reject old matchers, unknown fields, authority claims and invalid requirement branches', () => {
  for (const change of [{ kind: 'custom' }, { schema_version: 2 }, { installer: 'unsupported' }, { capabilities: null }])
    rejected({ ...pack(), ...change });
  for (const arguments_ of [{ kind: 'contains', prefix: [], tokens: ['-f'] }, { kind: 'any', extra: true }, null])
    rejected(pack({ domain: 'argv', executable: 'acme', arguments: arguments_ }));
  rejected(pack({ domain: 'argv', executable: { exact: 'acme', prefix: 'ac' }, arguments: { kind: 'any' } }));
  for (const change of [{ scope: 'organization' }, { mandatory: true },
    { decision: { loose: 'deny', recommended: 'allow', strict: 'deny' } }, { requirements: {} },
    { on_unmet: { decision: 'deny' } }, { requirements: { arguments: { kind: 'any' } }, on_unmet: { decision: 'allow' } }]) {
    const changed = pack();
    Object.assign(changed.rules[0], change);
    if ('requirements' in change) changed.capabilities.push('requirements-v1');
    rejected(changed);
  }
  const value = pack();
  const custom = { schema_version: 1, kind: 'custom', capabilities: value.capabilities,
    rules: [{ ...value.rules[0], decision: 'deny', expires_at: '2099-01-01T00:00:00Z' }] };
  accepted(custom);
  rejected({ ...custom, rules: [{ ...custom.rules[0], decision: value.rules[0].decision }] });
});
test('Risk selectors remain restrictions and cannot establish Allow', () => {
  const value = pack({ domain: 'argv', executable: 'git', arguments: { kind: 'risk_tokens', prefix: ['push'], any_of: ['--force', { prefix: '+' }] } });
  accepted(value);
  value.rules[0].decision = 'allow';
  rejected(value);
});
test('Rust is required for semantic option checks beyond structural JSON Schema', { skip: !process.env.SHIELD_BINARY }, () => {
  const value = pack({ domain: 'argv', executable: 'acme', arguments: { kind: 'options', prefix: [],
    flags: [], values: [], operands: false, require_all: ['--undeclared'] } });
  assert.equal(validate(value), true);
  assert.equal(core(value), 2);
});

test('Pack variables, setup, preconditions and templates agree with Rust admission', () => {
  const value = pack();
  value.capabilities.push('variables-v1', 'preconditions-v1', 'templates-v1');
  value.variables = {manager: {type: 'choice', description: 'Project manager', values: ['acme', 'other'],
    setup: {question: 'Select a manager?', unset: 'Any manager'}, suggest: [{file: 'acme.lock', value: 'acme'}]}};
  value.preconditions = [{id: 'manager', conditions: {domain: 'argv', executable: 'acme'},
    requires_any: [{executable: {var: 'manager'}}], on_unmet: {decision: 'deny', message: 'Use {{manager}}.'}}];
  accepted(value);
  rejected({...value, capabilities: value.capabilities.filter(cap => cap !== 'preconditions-v1')});
  rejected({...value, variables: {manager: {...value.variables.manager, installer: 'unsupported'}}});
  rejected({...value, preconditions: [{...value.preconditions[0], on_unmet: {decision: 'allow'}}]});
  rejected({...value, preconditions: [{...value.preconditions[0], fallback: true}]});
  rejected({...value, preconditions: [{...value.preconditions[0], requires_any: []}]});
  rejected({...value, variables: {manager: {...value.variables.manager, setup: {placeholder: 'acme'}}}});
});

test('All variable types and pack-only references retain custom-document boundaries', () => {
  const declarations = {
    choice: {type: 'choice', values: ['acme'], default: 'acme'},
    string: {type: 'string', max_length: 64, setup: {value: 'Only this name', placeholder: 'acme'}},
    list: {type: 'list', items: {type: 'choice', values: ['acme', 'other']}, min_items: 1, max_items: 2},
    boolean: {type: 'boolean'}, path: {type: 'path', within: 'project'},
  };
  for (const [name, declaration] of Object.entries(declarations)) {
    const value = pack();
    value.capabilities.push('variables-v1');
    value.variables = {setting: {description: 'Acme setting', ...declaration}};
    if (name === 'path') {
      value.rules[0].conditions.cwd = {within: {var: 'setting'}};
      value.capabilities.push('location-v1');
    } else if (name === 'boolean') {
      value.rules[0].when = [{var: 'setting', equals: true}];
    } else value.rules[0].conditions.executable = {var: 'setting'};
    accepted(value);
    const custom = {schema_version: 1, kind: 'custom', capabilities: value.capabilities,
      rules: [{...value.rules[0], decision: 'ask'}]};
    rejected(custom);
  }
  const ordinary = pack();
  ordinary.rules[0].reason = 'Literal {{braces}} without template interpretation.';
  accepted(ordinary);
  const interpreted = {...ordinary, capabilities: [...ordinary.capabilities, 'templates-v1']};
  assert.equal(validate(interpreted), true);
  if (process.env.SHIELD_BINARY) assert.equal(core(interpreted), 2); // undeclared placeholder
});

test('Optional option matches and conditional presence resolve in pack grammars only', () => {
  const value = pack();
  value.capabilities.push('variables-v1');
  value.variables = {profile: {type: 'string', description: 'Acme profile'}};
  value.rules[0].conditions.arguments = {kind: 'options', prefix: ['inspect'], flags: [],
    values: [{name: '--profile', match: {var: 'profile', unset: 'any'}}], operands: false,
    require_all: [{name: '--profile', when: [{var: 'profile', set: true}]}]};
  accepted(value);
  rejected({...value, rules: [{...value.rules[0], conditions: {...value.rules[0].conditions, executable: {var: 'profile', unset: 'any'}}}]});
  const fixture = {schema_version: 1, cases: [{name: 'selected', profile: 'recommended', expected: 'deny', argv: ['acme'], variables: {profile: 'acme-read'}}]};
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.equal(validate({...fixture, cases: [{...fixture.cases[0], variables: {profile: null}}]}), false);
});

test('Pack identity choices resolve for file and shell domains as well as executables', () => {
  const file = pack({domain: 'file', action: {var: 'action'}}, ['structured-rules-v1', 'location-v1', 'variables-v1']);
  file.variables = {action: {type: 'choice', description: 'Acme file action', values: ['read', 'write']}};
  accepted(file);
  const shell = pack({domain: 'shell', source: {var: 'source'}, dialect: {var: 'dialect'}}, ['structured-rules-v1', 'variables-v1']);
  shell.variables = {source: {type: 'string', description: 'Acme command'}, dialect: {type: 'choice', description: 'Acme dialect', values: ['posix', 'bash']}};
  accepted(shell);
});

test('Rust resolves declaration-dependent feature inventories rather than treating variables as literal JSON', {skip: !process.env.SHIELD_BINARY}, () => {
  const value = pack();
  value.variables = {profile: {type: 'string', description: 'Acme profile'}};
  value.capabilities.push('variables-v1');
  value.rules[0].conditions.executable = {var: 'profile'};
  accepted(value);
  // Structural source validation cannot evaluate an undeclared name or know
  // whether an extra capability appears after variable resolution.
  const unknown = {...value, rules: [{...value.rules[0], conditions: {...value.rules[0].conditions, executable: {var: 'missing'}}}]};
  assert.equal(validate(unknown), true);
  assert.equal(core(unknown), 2);
  const extra = {...value, capabilities: [...value.capabilities, 'glob-v1']};
  assert.equal(validate(extra), true);
  assert.equal(core(extra), 2);
});
