import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {shieldVersion} from './baseline-preview.mjs';
import {shieldDocsPagingCases} from './baseline-shield-cases.mjs';
import {baselineReaderGuidancePack, companions, destination, guide, previous} from './build-baseline-reader-guidance.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication} from './registry-release.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = (name, root = destination) => readFileSync(new URL(name, root));
const packPath = fileURLToPath(new URL('pack.yml', destination));

test('Baseline reader guidance extends the signed release without changing its decisions', async () => {
  const publicDirectory = new URL('../public/', import.meta.url);
  const catalog = await checkPublication(fileURLToPath(publicDirectory),
    read('../keys/main.pub', import.meta.url).toString().trim());
  const entry = (catalog.releases ?? catalog.packs)
    .find(row => row.id === 'canonic/baseline' && row.version === '0.21.0');
  assert.ok(entry);
  const published = new URL('.', new URL(entry.path, publicDirectory));
  for (const name of ['pack.yml', 'README.md', ...companions])
    assert.deepEqual(read(name, previous), read(name, published), name);
  for (const name of companions) assert.deepEqual(read(name), read(name, previous), name);
  assert.equal(read('README.md').toString(), guide);

  const pack = JSON.parse(read('pack.yml'));
  assert.deepEqual(pack, await baselineReaderGuidancePack());
  const validate = schemaValidator(schema);
  assert.equal(validate(pack), true, JSON.stringify(validate.errors));
  const prior = JSON.parse(read('pack.yml', previous));
  for (const document of [pack, prior]) {
    const fallback = document.rules.find(rule => rule.id === 'shared-unsupported-cat');
    delete fallback.reason;
    delete fallback.guidance;
    delete document.version;
  }
  assert.deepEqual(pack, prior);
  const release = JSON.parse(read('../release.json', import.meta.url));
  assert.equal(release.packs.filter(path => path === 'packs/canonic/baseline/0.21.1/pack.yml').length, 1);
});

function decisions(file, options = [], cwd) {
  const result = spawnSync(process.env.SHIELD_BINARY,
    ['__internal', 'test-pack', ...options, '--pack', packPath, '--cases', file],
    {cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  return report.cases;
}

test('Production Shield checks the complete Baseline reader-guidance candidate',
  {skip: !process.env.SHIELD_BINARY}, () => {
    for (const name of ['cases.json', 'cases-2.json']) {
      const cases = decisions(fileURLToPath(new URL(name, destination)));
      assert.equal(cases.length, JSON.parse(read(name)).cases.length);
    }
  });

test('Reader fallback asks and explains explicit operands in every profile',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const cwd = mkdtempSync(join(tmpdir(), 'shield-reader-guidance-'));
    t.after(() => rmSync(cwd, {recursive: true, force: true}));
    const file = join(cwd, 'fixtures.json');
    writeFileSync(join(cwd, 'input.txt'), 'example\n');
    const cases = ['loose', 'recommended', 'strict'].flatMap(profile => [
      {name: `${profile}-literal`, profile, argv: ['wc', '-l', 'input.txt'], expected: 'allow'},
      {name: `${profile}-fallback`, profile, argv: ['wc', '--files0-from=input.txt'], expected: 'ask'},
    ]);
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    for (const result of decisions(file, ['--details'], cwd).filter(row => row.expected === 'ask')) {
      const explanation = result.evaluation;
      assert.ok(explanation.matches.some(match => match.applied && match.rule_id === 'shared-unsupported-cat'));
      assert.ok(explanation.guidance.some(row => /explicit filenames.*list the intended files/.test(row.message)));
    }
  });

test('Baseline classifies paginated Shield docs on local and external transports',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const cwd = mkdtempSync(join(tmpdir(), 'shield-baseline-docs-'));
    t.after(() => rmSync(cwd, {recursive: true, force: true}));
    const file = join(cwd, 'fixtures.json');
    writeFileSync(file, JSON.stringify({schema_version: 1, cases: shieldDocsPagingCases()}));
    decisions(file, [], cwd);
  });

test('Baseline composes with checked Bash readers and find in Shield 0.59 or later',
  {skip: !process.env.SHIELD_BINARY || process.platform === 'win32'}, t => {
    const [major, minor] = shieldVersion().split('.').map(Number);
    if (major === 0 && minor < 59) return t.skip('Checked shell readers and find require Shield 0.59 or later');

    const cwd = mkdtempSync(join(tmpdir(), 'shield-baseline-shell-'));
    t.after(() => rmSync(cwd, {recursive: true, force: true}));
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'first.txt'), 'first\n');
    writeFileSync(join(cwd, 'src', 'second.txt'), 'second\n');
    const batch = 'find src -type f -exec wc -l {} +';
    const cases = ['loose', 'recommended', 'strict'].flatMap(profile => [
      ['reader-glob', 'wc -l src/*.txt', 'allow'],
      ['reader-no-matches', 'wc -l src/missing*.txt', 'ask'],
      ['checked-find', batch, 'allow'],
      ['unchecked-find-pipeline', `${batch} | wc -l`, 'deny'],
    ].map(([name, source, expected]) => ({name: `${profile}-${name}`, profile, expected,
      input: {kind: 'shell', dialect: 'bash', source, original_input: {}}})));
    const file = join(cwd, 'fixtures.json');
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    decisions(file, [], cwd);
  });
