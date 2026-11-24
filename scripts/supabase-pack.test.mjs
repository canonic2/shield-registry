import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {directory, guide} from './build-supabase-pack.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {hosted, mcpCase, reviewedMcpTools, supabaseCases} from './supabase-cases.mjs';
import {supabasePack} from './supabase-policy.mjs';

const packPath = fileURLToPath(new URL('pack.yml', directory));
const casesPath = fileURLToPath(new URL('cases.json', directory));

test('Supabase release inputs reproduce with schema-valid policy and independent fixtures', () => {
  const pack = supabasePack();
  const validate = schemaValidator(schema);
  for (const [path, document] of [[packPath, pack], [casesPath, supabaseCases()]]) {
    const bytes = readFileSync(path);
    assert.ok(bytes.length <= 1_048_576, `${path}: artifact limit`);
    assert.deepEqual(JSON.parse(bytes), document);
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  const license = readFileSync(new URL('LICENSE', directory), 'utf8');
  assert.equal(license, readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));

  const cliRules = pack.rules.filter(rule => rule.conditions.domain === 'argv');
  const inventory = JSON.parse(readFileSync(new URL('commands.json', directory)));
  assert.deepEqual(inventory, {schema_version: 1, commands: [{name: 'supabase', rule_ids: cliRules.map(rule => rule.id)}]});
  const tools = pack.rules.filter(rule => rule.conditions.domain === 'mcp' && !rule.fallback);
  assert.deepEqual(tools.map(rule => rule.conditions.tool).sort(), [...reviewedMcpTools].sort());

  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/${pack.id}/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands[pack.id], ['supabase']);
});

function evaluate(path) {
  return spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', packPath, '--cases', path],
    {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
}

test('production Shield matches every Supabase fixture across all profiles', {skip: !process.env.SHIELD_BINARY}, t => {
  const result = evaluate(casesPath);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, supabaseCases().cases.length);
  t.diagnostic(`Evaluated ${report.cases.length} independent decisions.`);
});

test('Supabase allowances require an official hosted or default local connection', {skip: !process.env.SHIELD_BINARY}, () => {
  const transports = [
    {type: 'stdio', command: 'supabase', args: ['mcp'], env: {}},
    ...[
      'http://localhost:54321/mcp?project_ref=abcdefghijklmnopqrst',
      'http://mcp.supabase.com/mcp?project_ref=abcdefghijklmnopqrst',
      'http://localhost:54322/mcp',
      'http://127.0.0.2:54321/mcp',
      'https://mcp.supabase.com/mcp?project_ref=',
      'https://mcp.supabase.com/mcp?project_ref=too-short',
      'https://mcp.supabase.com.example.com/mcp?project_ref=abcdefghijklmnopqrst',
      'https://mcp.supabase.com/other?project_ref=abcdefghijklmnopqrst',
      `${hosted}&project_ref=zyxwvutsrqponmlkjihg`,
      `${hosted}&read_only=true&read_only=false`,
      `${hosted}&skip_elicitations=execute_sql`,
      `${hosted}&project%5Fref=zyxwvutsrqponmlkjihg`,
    ].map(url => ({type: 'http', url})),
  ];
  const temp = mkdtempSync(join(tmpdir(), 'supabase-pack-'));
  const file = join(temp, 'cases.json');
  try {
    const cases = ['loose', 'recommended', 'strict'].flatMap(profile => transports.map((transport, index) =>
      mcpCase(`foreign-${index}-${profile}`, profile, 'get_project_url', {}, 'ask', {transport})));
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    const discovery = evaluate(file);
    assert.equal(discovery.status, 0, discovery.stdout + discovery.stderr);
    assert.equal(JSON.parse(discovery.stdout).cases.length, cases.length);

    const explicit = mcpCase('unscoped-explicit', 'recommended', 'get_project_url', {}, 'ask', {transport: transports[3], explicit: true});
    writeFileSync(file, JSON.stringify({schema_version: 1, cases: [explicit]}));
    const mismatch = evaluate(file);
    assert.equal(mismatch.status, 2, mismatch.stdout + mismatch.stderr);
    assert.match(mismatch.stdout, /connection does not match its pack integration/);

    const fragment = mcpCase('fragment', 'recommended', 'get_project_url', {}, 'ask', {
      transport: {type: 'http', url: `${hosted}#fragment`},
    });
    writeFileSync(file, JSON.stringify({schema_version: 1, cases: [fragment]}));
    const invalid = evaluate(file);
    assert.equal(invalid.status, 2, invalid.stdout + invalid.stderr);
    assert.match(invalid.stdout, /requires HTTP\(S\) without credentials or fragment/);
  } finally {
    rmSync(temp, {recursive: true, force: true});
  }
});
