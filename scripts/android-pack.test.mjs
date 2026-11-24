import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {androidPack, androidInventory, commands} from './android-policy.mjs';
import {androidCases} from './android-cases.mjs';
import {directory, guide} from './build-android-pack.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';

test('Android sources reproduce schema-valid artifacts and discovery', async () => {
  const pack = androidPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(androidCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(Buffer.byteLength(source) <= 1_048_576, file);
    assert.equal(source, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), androidInventory(pack));
  assert.deepEqual(androidInventory(pack).commands.flatMap(row => row.rule_ids).sort(), pack.rules.map(row => row.id).sort());
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/canonic/android/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands['canonic/android'], commands);
  assert.ok(commands.length <= 16);
});

function evaluate(file, companions = []) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
    new URL('pack.yml', directory).pathname, '--cases', file,
    ...companions.flatMap(path => ['--with-pack', path])],
  {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  return report;
}

test('Shield reproduces independent Android decisions alone and with Java/Baseline', {skip: !process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  const companions = ['../packs/canonic/java/0.1.0/pack.yml', '../packs/canonic/baseline/0.17.0/pack.yml']
    .map(path => new URL(path, import.meta.url).pathname);
  for (const file of await caseFileNames(directory)) {
    const path = new URL(file, directory).pathname;
    const report = evaluate(path);
    assert.equal(report.cases.length, JSON.parse(readFileSync(path)).cases.length);
    assert.equal(evaluate(path, companions).cases.length, report.cases.length);
    total += report.cases.length;
  }
  t.diagnostic(`Evaluated ${total} independent Android decisions alone and with Java/Baseline.`);
});

test('Android restrictions survive broad allowances and preserve Java Gradle review', {skip: !process.env.SHIELD_BINARY}, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'android-composition-'));
  try {
    const companion = join(scratch, 'companion.json');
    writeFileSync(companion, JSON.stringify({schema_version: 1, kind: 'pack', id: 'example/android-tools', version: '0.1.0',
      license: 'MIT', maintainers: ['Example'], description: 'Composition fixture.', engines: {shield: '>=0.53.0, <1.0.0'},
      capabilities: ['argument-rules-v1', 'structured-rules-v1'], rules: [{id: 'allow-tools', decision: 'allow',
        conditions: {domain: 'argv', executable: {one_of: commands}, arguments: {kind: 'any'}}}]}));
    const file = join(scratch, 'cases.json');
    const cases = androidCases().cases.filter(row => row.argv && !row.name.startsWith('unknown-executable-'));
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    assert.equal(evaluate(file, [companion]).cases.length, cases.length);
    const gradleCases = ['loose', 'recommended', 'strict'].flatMap(profile => [
      ['gradle', ':app:assembleDebug'], ['./gradlew', ':app:connectedAndroidTest'],
      ['gradle', ':app:installDebug'], ['./gradlew', ':app:bundleRelease'],
      ['java', '-jar', './bundletool.jar', 'install-apks', '--apks=./app.apks'],
    ].map((argv, index) => ({name: `java-android-${profile}-${index}`, profile, argv,
      expected: profile === 'strict' ? 'deny' : 'ask'})));
    writeFileSync(file, JSON.stringify({schema_version: 1, cases: gradleCases}));
    assert.equal(evaluate(file, [new URL('../packs/canonic/java/0.1.0/pack.yml', import.meta.url).pathname]).cases.length, 15);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
