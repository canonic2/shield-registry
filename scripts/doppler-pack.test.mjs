import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {directory, guide} from './build-doppler-pack.mjs';
import {dopplerCases, mcpCase, transport} from './doppler-cases.mjs';
import {mcpMetadata, mcpProtected, mcpReview} from './doppler-mcp.mjs';
import {dopplerInventory, dopplerPack} from './doppler-policy.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = file => readFileSync(new URL(file, directory), 'utf8');

test('Doppler source reproduces schema-valid policy and independent fixtures', async () => {
  const pack = dopplerPack();
  const fixtures = splitCaseFiles(dopplerCases());
  const validate = schemaValidator(schema);
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = read(file);
    assert.ok(Buffer.byteLength(bytes) <= 1_048_576, `${file}: artifact limit`);
    assert.equal(bytes, JSON.stringify(document, null, 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.deepEqual(JSON.parse(read('commands.json')), dopplerInventory(pack));
  assert.equal(read('README.md'), guide());
  assert.equal(read('LICENSE'), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
  const path = `packs/canonic/doppler/${pack.version}/pack.yml`;
  const release = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(release.packs.filter(entry => entry === path).length, 1);
  assert.deepEqual(release.commands['canonic/doppler'], ['doppler']);
});

test('Doppler MCP categories partition the reviewed catalog', () => {
  const tools = [...Object.keys(mcpMetadata), ...mcpProtected, ...mcpReview];
  // 53 GET and 74 mutating API tools in the published bundle, plus confirm_access.
  assert.equal(tools.length, 128);
  assert.equal(new Set(tools).size, tools.length);
  assert.equal(mcpProtected.length, 80);
});

function evaluate(file) {
  const result = spawnSync(process.env.SHIELD_BINARY,
    ['__internal', 'test-pack', '--pack', fileURLToPath(new URL('pack.yml', directory)), '--cases', file],
    {encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024});
  assert.ifError(result.error);
  return result;
}

test('production Shield reproduces the independent Doppler decisions', {skip: !process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const result = evaluate(fileURLToPath(new URL(file, directory)));
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(read(file)).cases.length);
    total += report.cases.length;
  }
  assert.equal(total, dopplerCases().cases.length);
  t.diagnostic(`Evaluated ${total} independent Doppler cases.`);
});

test('Doppler transport verification refuses foreign launches', {skip: !process.env.SHIELD_BINARY}, () => {
  const scratch = mkdtempSync(join(tmpdir(), 'shield-doppler-'));
  try {
    const file = join(scratch, 'cases.json');
    for (const launch of [
      {type: 'http', url: 'https://example.org/mcp'},
      {...transport, command: '/tmp/other/npx'},
      {...transport, command: 'sh', args: ['-c', 'npx -y @dopplerhq/mcp-server@1.0.5']},
      {...transport, args: ['-y', '@dopplerhq/mcp-server']},
      {...transport, args: ['-y', '@dopplerhq/mcp-server@1.0.4']},
      {...transport, args: ['-y', '--package=example', '@dopplerhq/mcp-server@1.0.5']},
      {...transport, env: {}},
      {...transport, env: {DOPPLER_BASE_URL: 'https://example.org'}},
    ]) {
      const row = mcpCase('foreign-launch', 'recommended', 'projects_list', {}, 'allow', launch);
      row.mcp.doppler.packs = {'canonic/doppler': 'doppler'};
      writeFileSync(file, JSON.stringify({schema_version: 1, cases: [row]}));
      const result = evaluate(file);
      assert.equal(result.status, 2, JSON.stringify(launch) + result.stdout + result.stderr);
      assert.match(result.stdout, /connection does not match its pack integration/);
    }
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
});
