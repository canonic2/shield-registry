import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const pack = read('../packs/canonic/git/0.2.0/pack.yml');
const cases = read('../packs/canonic/git/0.2.0/cases.json');
const inventory = read('../packs/canonic/git/0.2.0/commands.json');
const validate = new Ajv({ strict: false, allErrors: true }).compile(read('../schemas/policy.schema.json'));

test('Every inventoried Git command has a baseline and independent fixtures in all profiles', () => {
  const names = inventory.commands.map(command => command.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    assert.ok(pack.rules.some(rule => rule.id === `w0-base-${name}`), name);
    for (const profile of ['loose', 'recommended', 'strict']) {
      assert.ok(cases.cases.some(fixture => fixture.name === `inventory-${name}-${profile}`), `${name}: ${profile}`);
    }
  }
  assert.ok(names.includes('push') && names.includes('submodule') && names.includes('url-parse'));
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
  assert.equal(validate(cases), true, JSON.stringify(validate.errors));
});

test('Generated pack and fixtures are reproducible from reviewed source data', async t => {
  const output = await mkdtemp(join(tmpdir(), 'shield-git-generated-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  for (const [script, path] of [
    ['build-git-pack.mjs', '../packs/canonic/git/0.2.0/pack.yml'],
    ['build-git-cases.mjs', '../packs/canonic/git/0.2.0/cases.json'],
  ]) {
    const before = readFileSync(new URL(path, import.meta.url));
    const result = spawnSync(process.execPath, [new URL(script, import.meta.url).pathname, output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readFileSync(join(output, path.split('/').at(-1))), before);
  }
});

test('Real Shield evaluates every Git policy fixture', { skip: !process.env.SHIELD_BINARY }, () => {
  for (const version of ['0.1.0', '0.2.0']) {
    const root = new URL(`../packs/canonic/git/${version}/`, import.meta.url);
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', root).pathname, '--cases', new URL('cases.json', root).pathname], { encoding: 'utf8', timeout: 120_000 });
    const output = result.stdout ? JSON.parse(result.stdout) : null;
    assert.equal(result.status, 0, result.stderr || JSON.stringify(output?.cases?.filter(fixture => !fixture.passed)));
    assert.equal(output.passed, true);
  }
});
