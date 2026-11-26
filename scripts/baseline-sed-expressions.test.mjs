import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {baselineSedExpressionsCases, baselineSedExpressionsCommands, baselineSedExpressionsPack, baselineShieldInspectionCases,
  destination, guide, previous} from './build-baseline-sed-expressions.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication} from './registry-release.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));

test('Baseline sed expression sources reproduce the candidate and preserve the signed predecessor', async () => {
  const publicDirectory = new URL('../public/', import.meta.url);
  const catalog = await checkPublication(fileURLToPath(publicDirectory),
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  const entry = (catalog.releases ?? catalog.packs)
    .find(row => row.id === 'canonic/baseline' && row.version === '0.20.0');
  assert.ok(entry);
  const published = new URL('.', new URL(entry.path, publicDirectory));
  for (const name of ['pack.yml', 'commands.json', 'cases.json', 'README.md', 'LICENSE'])
    assert.deepEqual(readFileSync(new URL(name, previous)), readFileSync(new URL(name, published)));

  const pack = read('pack.yml');
  const cases = read('cases.json');
  const inspection = read('cases-2.json');
  assert.deepEqual(pack, await baselineSedExpressionsPack());
  assert.deepEqual(cases, await baselineSedExpressionsCases());
  assert.deepEqual(inspection, baselineShieldInspectionCases());
  assert.equal(pack.engines.shield, '>=0.57.0, <1.0.0');
  assert.deepEqual(read('commands.json'), await baselineSedExpressionsCommands());
  assert.equal(readFileSync(new URL('README.md', destination), 'utf8'), guide);
  assert.deepEqual(readFileSync(new URL('LICENSE', destination)), readFileSync(new URL('LICENSE', previous)));
  const validate = schemaValidator(schema);
  for (const document of [pack, cases, inspection]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.equal(read('../release.json', import.meta.url).packs
    .filter(path => path === 'packs/canonic/baseline/0.21.0/pack.yml').length, 1);
});

for (const [file, example, rule] of [
  ['cases.json', 'sed-expressions-bsd-edit-recommended', 'edit-sed-expressions'],
  ['cases-2.json', 'shield-mcp-rule-list-by-pack-recommended', 'shield-mcp-inspection'],
]) test(`Production Shield checks Baseline decisions in ${file}`, {skip: !process.env.SHIELD_BINARY}, t => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--details', '--pack',
      fileURLToPath(new URL('pack.yml', destination)), '--cases', fileURLToPath(new URL(file, destination))],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 24 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    const failures = report.cases?.filter(row => !row.passed).map(({name, expected, actual}) => ({name, expected, actual}));
    assert.equal(result.status, 0, JSON.stringify(failures ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, read(file).cases.length);
    const inspected = report.cases.find(row => row.name === example);
    assert.ok(inspected?.evaluation.explanation.matches.some(match => match.rule_id === rule && match.applied), example);
    t.diagnostic(`Verified ${report.cases.length} Baseline decisions.`);
  });
