import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(new URL('../schemas/policy.schema.json', import.meta.url)));
const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);
const git = JSON.parse(readFileSync(new URL('../packs/canonic/git/0.1.0/pack.yml', import.meta.url)));
const fixture = (effects, dependencies) => {
  const value = structuredClone(git);
  if (effects) {
    value.capabilities.push('possible-effects-v1');
    value.rules[0].matcher.possible_effects = ['network'];
  }
  if (dependencies) {
    value.capabilities.push('dependencies-v1');
    value.dependencies = [{ pack: 'canonic/example', requirement: '^1.0' }];
  }
  return value;
};

test('One schema accepts literal, effect, dependency and combined version-1 packs', () => {
  for (const effects of [false, true]) for (const dependencies of [false, true]) {
    assert.equal(validate(fixture(effects, dependencies)), true, JSON.stringify(validate.errors));
  }
});

test('Custom effect rules and Git decision fixtures use the same initial schema', () => {
  assert.equal(validate({ schema_version: 1, rules: [{ id: 'network', scope: 'project', decision: 'deny',
    reason: 'Review possible network access', matcher: { executable: 'git', arguments: { kind: 'any' }, possible_effects: ['network'] } }] }), true);
  const cases = JSON.parse(readFileSync(new URL('../packs/canonic/git/0.1.0/cases.json', import.meta.url)));
  assert.equal(validate(cases), true, JSON.stringify(validate.errors));
});

test('Unsupported document versions refuse every optional feature combination', () => {
  for (const version of [0, 2, 3, 255]) {
    for (const effects of [false, true]) for (const dependencies of [false, true]) {
      assert.equal(validate({ ...fixture(effects, dependencies), schema_version: version }), false);
    }
    assert.equal(validate({ schema_version: version, rules: [] }), false);
  }
});

test('Dependency declarations and capabilities must agree; order and uniqueness are strict', () => {
  for (const changed of [
    { dependencies: [] }, { dependencies: null }, { capabilities: ['argv-v1', 'dependencies-v1'] },
    { capabilities: ['argv-v1', 'argv-v1'] }, { capabilities: ['argv-v1', 'unknown-v1'] },
  ]) assert.equal(validate({ ...git, ...changed }), false);
  const both = fixture(true, true);
  for (const capabilities of [
    ['argv-v1', 'dependencies-v1'], ['argv-v1', 'possible-effects-v1'],
    ['argv-v1', 'dependencies-v1', 'possible-effects-v1'],
  ]) assert.equal(validate({ ...both, capabilities }), false);
  assert.equal(validate({ ...git, capabilities: ['argv-v1', 'dependencies-v1'], dependencies: [] }), true);
});

test('Unknown fields, duplicate effects and nullable declarations refuse', () => {
  const effect = fixture(true, false);
  for (const possible_effects of [[], null, ['network', 'network'], ['unknown']]) {
    const invalid = structuredClone(effect);
    invalid.rules[0].matcher.possible_effects = possible_effects;
    assert.equal(validate(invalid), false);
  }
  const dependency = fixture(false, true);
  dependency.dependencies[0].registry = null;
  assert.equal(validate(dependency), false);
  assert.equal(validate({ ...git, installer: 'unsupported' }), false);
});


test('Custom documents reject inherited scopes and configurable mandatory authority', () => {
  const rule = { id: 'local', scope: 'project', decision: 'deny', reason: 'Project restriction',
    matcher: { executable: 'git', arguments: { kind: 'any' } } };
  for (const scope of ['user', 'organization']) {
    assert.equal(validate({ schema_version: 1, rules: [{ ...rule, scope }] }), false);
  }
  for (const mandatory of [false, true]) {
    assert.equal(validate({ schema_version: 1, rules: [{ ...rule, mandatory }] }), false);
  }
});
