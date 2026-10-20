import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import { schema } from './policy-schema.mjs';
import { validatorFor, singleEngine } from './pack-formats.mjs';

const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const pack = (conditions = { domain: 'argv', executable: 'acme', arguments: { kind: 'any' } }, capabilities = ['argument-rules-v1', 'structured-rules-v1']) => ({
  schema_version: 1, kind: 'pack', id: 'acme/inspection', version: '0.1.0', description: 'Acme inspection fixture',
  license: 'MIT', maintainers: ['Acme'], engines: { shield: '>=0.1.0, <0.2.0' }, capabilities,
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
test('Generated schema is reproducible and immutable historical formats stay separate', () => {
  assert.deepEqual(read('../schemas/policy.schema.json'), schema);
  const legacy = new Ajv({ strict: false, allErrors: true }).compile(read('../schemas/policy-legacy.schema.json'));
  for (const version of ['0.1.0', '0.2.0']) {
    const old = read(`../packs/canonic/git/${version}/pack.yml`);
    assert.equal(legacy(old), true);
    assert.equal(validate(old), false);
  }
  // Structured releases for Shield 0.1.12 and earlier keep the single engine field.
  const single = new Ajv({ strict: false, allErrors: true }).compile(read('../schemas/policy-shield-0.1.12.schema.json'));
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
  accepted(pack({ domain: 'exact_request', input: { kind: 'mcp', server: 'acme', tool: 'inspect',
    arguments: { regex: 'literal', nested: null }, original_input: { description: 'Acme opaque request' } },
    context: { cwd: '/workspace/acme', environment: null }, executable: null }, ['structured-rules-v1']));
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
