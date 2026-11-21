import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {candidate, nodeYarnVersionRelease, previous} from './build-node-yarn-version.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';

const path = name => fileURLToPath(new URL(name, candidate));
const read = (directory, name) => JSON.parse(readFileSync(new URL(name, directory)));
const baseline = fileURLToPath(new URL('../packs/canonic/baseline/0.16.0/pack.yml', import.meta.url));

test('Node 0.5.1 reproduces and keeps inherited policy and fixtures', async () => {
  const {pack, cases, commands, readme} = await nodeYarnVersionRelease();
  const validate = schemaValidator(schema);
  for (const [name, document] of [['pack.yml', pack], ['cases.json', cases], ['commands.json', commands]]) {
    assert.deepEqual(read(candidate, name), document);
  }
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.equal(readFileSync(path('README.md'), 'utf8'), readme);
  const oldPack = read(previous, 'pack.yml');
  const {version, capabilities, rules, ...rest} = pack;
  assert.deepEqual({version: oldPack.version, capabilities: capabilities.slice(0, -1),
    rules: rules.slice(0, -2), ...rest}, oldPack);
  const oldCases = read(previous, 'cases.json').cases;
  assert.deepEqual(cases.cases.slice(0, oldCases.length), oldCases);
});

const evaluate = (cases, extra = [], cwd) => {
  const result = spawnSync(process.env.SHIELD_BINARY,
    ['__internal', 'test-pack', '--pack', path('pack.yml'), '--cases', cases, '--json', ...extra],
    {cwd, encoding: 'utf8', timeout: 30_000});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, result.stderr + JSON.stringify(report.cases?.filter(row => !row.passed) ?? report));
};

test('Node decisions pass with production Shield, alone and with published Baseline', {skip: !process.env.SHIELD_BINARY}, () => {
  evaluate(path('cases.json'));
  evaluate(path('cases.json'), ['--with-pack', baseline]);
});

test('Yarn version queries from a package work while directories reached via an outside symlink ask',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const base = mkdtempSync(join(tmpdir(), 'shield-yarn-version-'));
    t.after(() => rmSync(base, {recursive: true, force: true}));
    const project = join(base, 'project');
    mkdirSync(join(project, 'packages/web'), {recursive: true});
    const outside = join(base, 'outside');
    mkdirSync(outside);
    symlinkSync(outside, join(project, 'packages/linked'), 'dir');
    const cases = join(base, 'cases.json');
    writeFileSync(cases, JSON.stringify({schema_version: 1, cases: [
      {name: 'project-package', profile: 'recommended', argv: ['yarn', '--cwd', 'packages/web', 'node', '--version'], expected: 'allow'},
      {name: 'linked-outside', profile: 'recommended', argv: ['yarn', '--cwd', 'packages/linked', 'node', '--version'], expected: 'ask'},
    ]}));
    evaluate(cases, ['--with-pack', baseline], project);
  });
