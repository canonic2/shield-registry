import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {candidate, previous, nodeEcosystemRelease} from './build-node-ecosystem.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = async (dir, name) => JSON.parse(await readFile(new URL(name, dir)));
test('Node ecosystem reproduces, admits and preserves all published policy and fixtures', async () => {
  const {pack, cases, commands, readme} = await nodeEcosystemRelease();
  assert.deepEqual(await read(candidate, 'pack.yml'), pack);
  assert.deepEqual(await read(candidate, 'commands.json'), commands);
  assert.equal(await readFile(new URL('README.md', candidate), 'utf8'), readme);
  const validate = schemaValidator(schema);
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
  for (const [name, document] of splitCaseFiles(cases)) {
    assert.deepEqual(await read(candidate, name), document);
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
    assert.ok((await stat(new URL(name, candidate))).size <= 1_048_576);
  }
  assert.ok((await stat(new URL('pack.yml', candidate))).size <= 1_048_576);
  const old = await read(previous, 'pack.yml');
  const {version, description, engines, capabilities, rules, ...rest} = pack;
  assert.deepEqual({...rest, version: old.version, description: old.description, engines: old.engines,
    capabilities: capabilities.slice(0, -1), rules: rules.slice(0, old.rules.length)}, old);
  const oldCases = (await read(previous, 'cases.json')).cases;
  assert.equal(oldCases.length, 264);
  assert.deepEqual(cases.cases.slice(0, oldCases.length), oldCases);
  assert.equal(commands.commands.length, 34);
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  assert.equal(new Set(cases.cases.map(row => row.name)).size, cases.cases.length);
  const known = new Set(pack.rules.map(row => row.id));
  for (const command of commands.commands) {
    assert.ok(command.rule_ids.length > 0, command.name);
    assert.ok(command.rule_ids.every(id => known.has(id)), command.name);
    assert.ok(cases.cases.some(row => row.argv?.[0] === command.name), command.name);
  }
  const manifest = JSON.parse(await readFile(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/node/0.6.0/pack.yml').length, 1);
  assert.equal(manifest.commands['canonic/node'].length, 16);
});

test('explicit project sources, outputs and configs follow symlinks and manager cwd selectors',
  {skip: !process.env.SHIELD_BINARY}, async t => {
    const temporary = await mkdtemp(join(tmpdir(), 'shield-node-paths-'));
    t.after(() => rm(temporary, {recursive: true, force: true}));
    const project = join(temporary, 'project');
    const outside = join(temporary, 'outside');
    await mkdir(join(project, 'src'), {recursive: true});
    await mkdir(outside);
    await symlink(outside, join(project, 'escape'), 'dir');
    const rows = [
      [['eslint', 'src'], 'allow'], [['eslint', 'escape'], 'ask'],
      [['eslint', '--output-file', 'escape/report.json', 'src'], 'ask'],
      [['eslint', '--config', 'escape/config.js', 'src'], 'ask'],
      [['yarn', 'eslint', 'escape'], 'ask'], [['pnpm', 'prettier', '--write', 'escape'], 'ask'],
      [['yarn', '--cwd', outside, 'eslint', 'src'], 'ask'],
      [['pnpm', '--dir', outside, 'eslint', 'src'], 'ask'],
      [['yarn', '--cwd', 'src', 'eslint', 'file.js'], 'allow'],
      [['tsc', '--outDir', 'escape'], 'ask'], [['vitest', 'run', 'escape'], 'ask'],
    ];
    const source = join(temporary, 'cases.json');
    await writeFile(source, JSON.stringify({schema_version: 1, cases: rows.map(([argv, expected], index) =>
      ({name: `symlink-${index}`, profile: 'recommended', argv, expected}))}));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
      fileURLToPath(new URL('pack.yml', candidate)), '--cases', source, '--with-pack',
      fileURLToPath(new URL('../packs/canonic/baseline/0.17.0/pack.yml', import.meta.url)), '--json'],
    {cwd: project, encoding: 'utf8', timeout: 30_000});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, result.stderr + JSON.stringify(report.cases?.filter(row => !row.passed) ?? report));
  });

test('Node ecosystem decisions pass alone and with published Baseline', {skip: !process.env.SHIELD_BINARY}, async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'shield-node-composition-'));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  let count = 0;
  for (const cases of await caseFileNames(candidate)) for (const combined of [false, true]) {
    const document = await read(candidate, cases);
    // Baseline 0.17.0's non-fallback project-tools rule deliberately asks for
    // these six executables in Strict, including their metadata. Cross-pack
    // composition keeps that independent restriction. No evaluator-derived
    // expectations are used here.
    if (combined) for (const row of document.cases) {
      if (row.profile === 'strict' && ['tsc', 'eslint', 'prettier', 'biome', 'vitest', 'jest'].includes(row.argv?.[0])
        && row.argv.length === 2 && ['--help', '-h', '--version'].includes(row.argv[1])) row.expected = 'ask';
    }
    const source = join(temporary, cases);
    await writeFile(source, JSON.stringify(document));
    const args = ['__internal', 'test-pack', '--pack', fileURLToPath(new URL('pack.yml', candidate)),
      '--cases', source, '--json'];
    if (combined) args.push('--with-pack', fileURLToPath(new URL('../packs/canonic/baseline/0.17.0/pack.yml', import.meta.url)));
    const result = spawnSync(process.env.SHIELD_BINARY, args, {encoding: 'utf8', timeout: 60_000, maxBuffer: 8_000_000});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, result.stderr + JSON.stringify(report.cases?.filter(row => !row.passed).slice(0, 24) ?? report));
    assert.equal(report.cases.length, document.cases.length);
    if (!combined) count += report.cases.length;
  }
  t.diagnostic(`Evaluated ${count} decisions alone and ${count} with Baseline.`);
});
