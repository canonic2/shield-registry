import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { candidate, previous, nodeProjectTestsRelease } from './build-node-project-tests.mjs';
import { caseFileNames } from './fixture-files.mjs';
import { nodeProjectTestsCases } from './node-project-tests-cases.mjs';
import { schema } from './policy-schema.mjs';
import { schemaValidator } from './schema-validation.mjs';

const read = async (directory, name) => JSON.parse(await readFile(new URL(name, directory)));
const file = (directory, name) => fileURLToPath(new URL(name, directory));
const caseName = async () => `cases-${(await caseFileNames(previous)).length + 1}.json`;

test('Node project test successor preserves rules and separates execution from the Codex prefix', async () => {
  const {pack, commands, readme} = await nodeProjectTestsRelease();
  assert.deepEqual(await read(candidate, 'pack.yml'), pack);
  assert.deepEqual(await read(candidate, 'commands.json'), commands);
  assert.equal(await readFile(new URL('README.md', candidate), 'utf8'), readme);
  const validate = schemaValidator(schema);
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
  const old = await read(previous, 'pack.yml');
  assert.deepEqual(pack.rules.slice(0, old.rules.length), old.rules);
  const [trust, host] = pack.rules.slice(-2);
  assert.equal(trust.trust_execution, true);
  assert.equal(trust.agents, undefined);
  assert.equal(host.trust_execution, undefined);
  assert.deepEqual(host.agents.codex.prefixes, [['node', '--test']]);
  for (const name of await caseFileNames(previous)) {
    assert.deepEqual(await read(candidate, name), await read(previous, name));
  }
  const cases = await read(candidate, await caseName());
  assert.deepEqual(cases.cases, nodeProjectTestsCases);
  assert.equal(validate(cases), true, JSON.stringify(validate.errors));
});

test('Shield evaluates the independent Node test settings', {skip: !process.env.SHIELD_BINARY}, async () => {
  const args = ['__internal', 'test-pack', '--pack', file(candidate, 'pack.yml'),
    '--cases', file(candidate, await caseName()), '--json'];
  const result = spawnSync(process.env.SHIELD_BINARY, args, {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 30_000,
  });
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, result.stderr + JSON.stringify(report.cases?.filter(row => !row.passed) ?? report));
  assert.equal(report.cases.length, nodeProjectTestsCases.length);
});
