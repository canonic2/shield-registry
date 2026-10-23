import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {nodePack, destination} from './build-node-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = name => JSON.parse(readFileSync(new URL(name, destination)));
test('Node pack admits a complete profile policy and command inventory', () => {
  const pack = read('pack.yml');
  assert.deepEqual(pack, nodePack());
  const validate = schemaValidator(schema);
  for (const document of [pack, read('cases.json')]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  for (const {name, rule_ids} of read('commands.json').commands) {
    assert.deepEqual(rule_ids, pack.rules.filter(rule => rule.conditions.executable.one_of.includes(name)).map(rule => rule.id));
  }
});

test('Node profile boundaries and Baseline composition use production decisions', {skip: !process.env.SHIELD_BINARY}, t => {
  const owner = mkdtempSync(join(tmpdir(), 'shield-node-cases-'));
  t.after(() => rmSync(owner, {recursive: true, force: true}));
  const cases = new URL('cases.json', destination).pathname;
  const baseline = new URL('../packs/canonic/baseline/0.6.0/pack.yml', import.meta.url).pathname;
  const baseline06Compatible = shieldFor(JSON.parse(readFileSync(baseline)));
  const run = args => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination).pathname, ...args], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
  };
  run(['--cases', cases]);
  // All independent Node boundary fixtures must preserve their decision when
  // composed with Baseline, apart from yielding unlisted syntax-check coverage.
  const composed = read('cases.json');
  composed.cases = composed.cases.filter(c => !c.name.startsWith('unlisted-syntax-'));
  const source = 'node --version; npm --version; npm view express version';
  for (const profile of ['loose', 'recommended', 'strict']) {
    composed.cases.push({name: `express-inspection-${profile}`, profile, input: {kind: 'shell', source, dialect: 'posix', dialect_version: null, original_input: {}}, expected: 'allow'});
    composed.cases.push({name: `express-existing-project-${profile}`, profile, input: {kind: 'shell', source: 'npm init -y && npm install express@5 && npm test', dialect: 'posix', dialect_version: null, original_input: {}}, expected: {loose: 'ask', recommended: 'ask', strict: 'deny'}[profile]});
    // The diagnostic evaluator does not execute mkdir before analyzing cd.
    composed.cases.push({name: `express-new-directory-${profile}`, profile, input: {kind: 'shell', source: 'mkdir -p acme-app && cd acme-app && npm init -y && npm install express@5 && npm test', dialect: 'posix', dialect_version: null, original_input: {}}, expected: 'ask'});
    composed.cases.push({name: `node-shell-script-${profile}`, profile, input: {kind: 'shell', source: 'node server.js', dialect: 'posix', dialect_version: null, original_input: {}}, expected: 'ask'});
    composed.cases.push({name: `node-shell-inline-${profile}`, profile, input: {kind: 'shell', source: "node -e 'console.log(1)'", dialect: 'posix', dialect_version: null, original_input: {}}, expected: {loose: 'ask', recommended: 'ask', strict: 'deny'}[profile]});
  }
  for (const manager of ['npm', 'pnpm', 'yarn']) for (const profile of ['loose', 'recommended', 'strict']) {
    for (const [name, source, expected] of [
      ['reviewed-chain', `node --version; ${manager} install && ${manager} test`, profile === 'strict' ? 'deny' : 'ask'],
      ['corepack-chain', `corepack ${manager} install && corepack ${manager} test`, profile === 'strict' ? 'deny' : 'ask'],
      ['wrong-manager-chain', `${manager} test; ${manager === 'npm' ? 'pnpm' : 'npm'} install`, 'deny'],
      ['wrong-corepack-chain', `${manager} test; corepack ${manager === 'npm' ? 'yarn' : 'npm'} install`, 'deny'],
    ]) composed.cases.push({name: `shell-${manager}-${name}-${profile}`, profile, variables: {package_manager: manager}, input: {kind: 'shell', source, dialect: 'posix', dialect_version: null, original_input: {}}, expected});
  }
  const composedPath = join(owner, 'composed.json');
  // Additional shell cases can take composition past one document's 1,024-case
  // admission bound. Each batch still uses the ordinary production evaluator.
  for (let start = 0; start < composed.cases.length; start += 1024) {
    writeFileSync(composedPath, JSON.stringify({...composed, cases: composed.cases.slice(start, start + 1024)}));
    if (baseline06Compatible) run(['--cases', composedPath, '--with-pack', baseline]);
    run(['--cases', composedPath, '--with-pack', new URL('../packs/canonic/baseline/0.7.0/pack.yml', import.meta.url).pathname]);
  }
});
