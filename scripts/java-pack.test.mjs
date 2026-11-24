import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {javaPack, javaInventory, commands, discoveryCommands} from './java-policy.mjs';
import {javaCases} from './java-cases.mjs';
import {directory, guide} from './build-java-pack.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';

test('Java, Maven and Gradle sources reproduce schema-valid artifacts and discovery', async () => {
  const pack = javaPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(javaCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    assert.ok(Buffer.byteLength(source) <= 1_048_576, file);
    assert.equal(source, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), javaInventory(pack));
  assert.deepEqual(javaInventory(pack).commands.flatMap(row => row.rule_ids), pack.rules.map(row => row.id));
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/canonic/java/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands['canonic/java'], discoveryCommands);
  assert.ok(discoveryCommands.length <= 16 && discoveryCommands.every(name => commands.includes(name)));
});

function evaluate(file, companion) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
    new URL('pack.yml', directory).pathname, '--cases', file, ...(companion ? ['--with-pack', companion] : [])],
  {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  return report;
}

test('Shield reproduces every independent Java, Maven and Gradle decision', {skip: !process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const report = evaluate(new URL(file, directory).pathname);
    assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
    total += report.cases.length;
  }
  assert.equal(total, javaCases().cases.length);
  t.diagnostic(`Evaluated ${total} independent Java / Maven / Gradle decisions.`);
});

test('Java, Maven and Gradle restrictions survive a broad community allowance', {skip: !process.env.SHIELD_BINARY}, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'java-composition-'));
  try {
    const companion = join(scratch, 'companion.json');
    writeFileSync(companion, JSON.stringify({schema_version: 1, kind: 'pack', id: 'example/jvm-tools', version: '0.1.0',
      license: 'MIT', maintainers: ['Example'], description: 'Composition fixture.', engines: {shield: '>=0.53.0, <1.0.0'},
      capabilities: ['argument-rules-v1', 'structured-rules-v1'], rules: [{id: 'allow-tools', decision: 'allow',
        conditions: {domain: 'argv', executable: {one_of: commands}, arguments: {kind: 'any'}}}]}));
    const file = join(scratch, 'cases.json');
    const cases = javaCases().cases.filter(row => /^(java-version|version-with-agent|compile|archive-extract|diagnostic|maven-version|maven-deploy|gradle-version|gradle-tasks|gradle-init-script|gradle-publish|gradle-wrapper-version)-/.test(row.name));
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    assert.equal(evaluate(file, companion).cases.length, cases.length);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
