import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {baselineShieldCommands, baselineShieldPack, baselineShieldReleaseCases, destination, guide, previous} from './build-baseline-shield.mjs';
import {shieldToolCases} from './baseline-shield-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication} from './registry-release.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));

test('Baseline preserves the authenticated published release and its companion files', async () => {
  const publicDirectory = new URL('../public/', import.meta.url);
  const catalog = await checkPublication(fileURLToPath(publicDirectory),
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  const releases = catalog.releases ?? catalog.packs;
  assert.ok(releases.some(row => row.id === 'canonic/baseline' && row.version === '0.18.0'));
  for (const [version, source] of [['0.18.0', previous], ['0.19.0', destination]]) {
    const entry = releases.find(row => row.id === 'canonic/baseline' && row.version === version);
    if (!entry) continue;
    const published = new URL('.', new URL(entry.path, publicDirectory));
    for (const file of ['pack.yml', 'commands.json', 'cases.json', 'README.md', 'LICENSE'])
      assert.deepEqual(readFileSync(new URL(file, source)), readFileSync(new URL(file, published)),
        `Published Baseline ${version} ${file} requires a successor version`);
  }
});

test('Baseline Shield sources reproduce the pending release and retain the published policy and fixtures', async () => {
  const pack = read('pack.yml');
  const cases = read('cases.json');
  const commands = read('commands.json');
  assert.deepEqual(pack, await baselineShieldPack());
  assert.deepEqual(cases, await baselineShieldReleaseCases());
  assert.deepEqual(commands, await baselineShieldCommands());
  assert.equal(readFileSync(new URL('README.md', destination), 'utf8'), guide());
  assert.deepEqual(readFileSync(new URL('LICENSE', destination)), readFileSync(new URL('LICENSE', previous)));

  const validate = schemaValidator(schema);
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  const prior = read('pack.yml', previous);
  assert.deepEqual(pack.engines, prior.engines);
  assert.deepEqual(pack.capabilities, prior.capabilities);
  assert.deepEqual(pack.rules.filter(rule => !rule.id.startsWith('shield-')), prior.rules);
  assert.deepEqual(Object.fromEntries(Object.entries(pack.mcp_integrations)
    .filter(([name]) => !name.startsWith('shield-'))), prior.mcp_integrations);
  const earlierCases = read('cases.json', previous).cases;
  assert.deepEqual(cases.cases.slice(0, earlierCases.length), earlierCases);
  assert.deepEqual(commands.commands.filter(row => row.name !== 'shield'), read('commands.json', previous).commands);
  assert.deepEqual(commands.commands.find(row => row.name === 'shield')?.rule_ids, ['shield-version', 'shield-help']);

  const manifest = read('../release.json', import.meta.url);
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/baseline/0.19.0/pack.yml').length, 1);
  assert.deepEqual(manifest.commands['canonic/baseline'], ['shield']);
});

test('Production Shield admits the complete Baseline and decides CLI and MCP boundaries in all profiles',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
      fileURLToPath(new URL('pack.yml', destination)), '--cases', fileURLToPath(new URL('cases.json', destination))],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, read('cases.json').cases.length);
    t.diagnostic(`Verified ${report.cases.length} Baseline decisions.`);
  });

test('Baseline classifies the installed Shield MCP catalog, including first-run compatibility',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const project = mkdtempSync(join(tmpdir(), 'shield-baseline-mcp-'));
    t.after(() => rmSync(project, {recursive: true, force: true}));
    const requests = [
      {id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25', capabilities: {},
        clientInfo: {name: 'Acme', version: '1'}}},
      {method: 'notifications/initialized'},
      {id: 2, method: 'tools/list'},
    ];
    const result = spawnSync(process.env.SHIELD_BINARY, ['mcp', 'serve', '--project', '.'], {
      cwd: project, encoding: 'utf8', timeout: 10000, maxBuffer: 4 * 1024 * 1024,
      input: requests.map(request => JSON.stringify({jsonrpc: '2.0', ...request})).join('\n') + '\n',
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const replies = result.stdout.trim().split('\n').map(line => JSON.parse(line));
    const catalog = replies.find(reply => reply.id === 2)?.result?.tools;
    assert.ok(Array.isArray(catalog), JSON.stringify(replies));
    const tools = new Map(catalog.map(tool => [tool.name, tool]));
    const fixtures = shieldToolCases.map(([name]) => name).sort();
    assert.deepEqual([...tools.keys()].filter(name => name !== 'init').sort(),
      fixtures.filter(name => name !== 'init'));
    assert.ok(fixtures.includes('init'));
    assert.deepEqual(tools.get('init')?.inputSchema.required, ['agents']);
    const review = tools.get('policy_review');
    assert.deepEqual(review.inputSchema.required, ['proposal_id']);
    assert.deepEqual(review.inputSchema.properties.proposal_id, {type: 'string', minLength: 1, maxLength: 128});
    assert.equal(review.annotations.readOnlyHint, false);
    for (const name of ['pack_add', 'pack_configure', 'pack_remove', 'pack_update',
      'rule_add', 'rule_edit', 'rule_remove', 'registry_add'])
      assert.equal(tools.get(name).inputSchema.properties.review.type, 'boolean', name);
    const registry = tools.get('registry_add').inputSchema;
    assert.equal(registry.properties.review_ref.type, 'string');
    assert.deepEqual(registry.dependentRequired.discard, ['review_ref']);
    assert.deepEqual(tools.get('pack_remove').inputSchema.then.required, ['reference']);
    assert.equal(tools.get('setup').inputSchema.properties.agents.type, 'array');
    assert.equal(tools.get('mcp_setup').inputSchema.properties.repair.type, 'boolean');
    assert.equal(tools.get('mcp_setup_preview').annotations.readOnlyHint, true);
    assert.ok(tools.get('docs_read').inputSchema.required.includes('path'));
  });
