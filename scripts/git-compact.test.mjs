import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import { buildGitPack } from './build-git-pack.mjs';
import { schema } from './policy-schema.mjs';
import { validatorFor, shieldFor } from './pack-formats.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const original = read('../packs/canonic/git/0.4.1/pack.yml');
const inventory = read('../packs/canonic/git/0.5.0/commands.json');
const compact = read('../packs/canonic/git/0.5.0/pack.yml');
const validate = validatorFor(compact);

test('Compact Git is generated without invocation expansion and preserves every source rule', () => {
  assert.deepEqual(buildGitPack(inventory, { version: '0.5.0', compact: true }), compact);
  assert.equal(compact.rules.length, 110);
  assert.equal(Object.values(compact.command_sets).reduce((n, set) => n + Object.keys(set).length, 0), 173);
  assert.equal(validate(compact), true, JSON.stringify(validate.errors));
  const expanded = new Map();
  for (const body of compact.rules) {
    const group = compact.invocations[body.invocation];
    for (const [ordinal, prefix] of group.segments[0].entries()) {
      const members = body.command_set ? Object.entries(compact.command_sets[body.command_set]) : [[null, body.id]];
      for (const [command, identity] of members) {
        const rule = structuredClone(body);
        delete rule.invocation; delete rule.command_set;
        rule.id = `${group.id_prefix}${ordinal}-${identity}`;
        const values = [...prefix, ...(command === null ? [] : [command])];
        const args = rule.conditions.arguments;
        if (args.kind === 'any') rule.conditions.arguments = { kind: 'prefix', values };
        else {
          const field = ['exact', 'prefix'].includes(args.kind) ? 'values' : 'prefix';
          args[field] = [...values, ...args[field]];
        }
        assert.equal(expanded.has(rule.id), false);
        expanded.set(rule.id, rule);
      }
    }
  }
  assert.equal(expanded.size, original.rules.length);
  for (const rule of original.rules) assert.deepEqual(expanded.get(rule.id), rule, rule.id);
});

test('Shared pack schema rejects missing capabilities, custom bindings and invalid routes', () => {
  for (const mutate of [
    p => p.capabilities.splice(p.capabilities.indexOf('command-sets-v1'), 1),
    p => p.invocations.git.segments[0].push([]),
    p => p.invocations.git.id_prefix = 'bad-prefix',
    p => p.rules[0].invocation = null,
    p => delete p.rules[0].invocation,
  ]) {
    const invalid = structuredClone(compact); mutate(invalid);
    assert.equal(validate(invalid), false, JSON.stringify(invalid));
  }
  const custom = { schema_version: 1, kind: 'custom', capabilities: ['structured-rules-v1', 'argument-rules-v1', 'invocation-groups-v1'], rules: [compact.rules[0]] };
  assert.equal(validate(custom), false);
});

test('Production Shield preserves all 1023 Git decisions and complete explanations', { skip: !shieldFor(compact) }, () => {
  const run = version => {
    const root = new URL(`../packs/canonic/git/${version}/`, import.meta.url);
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--details', '--pack', new URL('pack.yml', root).pathname, '--cases', new URL('cases.json', root).pathname],
      { encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true); assert.equal(report.cases.length, 1023);
    for (const fixture of report.cases) {
      delete fixture.evaluation.revision;
      for (const pack of fixture.evaluation.packs) { delete pack.digest; delete pack.version; }
    }
    return report;
  };
  assert.deepEqual(run('0.5.0'), run('0.4.1'));
});
