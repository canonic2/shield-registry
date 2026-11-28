import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {directory, guide} from './build-supabase-pack.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {checkPublication, digest} from './registry-release.mjs';
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
  assert.deepEqual(tools.map(rule => rule.conditions.tool).sort(), [...reviewedMcpTools, 'execute_sql'].sort());

  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === `packs/${pack.id}/${pack.version}/pack.yml`).length, 1);
  assert.deepEqual(manifest.commands[pack.id], ['supabase']);
});

test('Supabase preserves the authenticated 0.1.1 release and its companion files', async () => {
  const published = new URL('../public/', import.meta.url);
  const source = 'packs/canonic/supabase/0.1.1/';
  const key = readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim();
  const catalog = await checkPublication(fileURLToPath(published), key);
  const release = catalog.packs.find(pack => pack.id === 'canonic/supabase');
  assert.equal(release?.version, '0.1.1');
  assert.equal(digest(readFileSync(new URL(`../${source}pack.yml`, import.meta.url))), release.sha256);
  for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE']) {
    assert.deepEqual(readFileSync(new URL(`../${source}${name}`, import.meta.url)),
      readFileSync(new URL(`${source}${name}`, published)), name);
  }
});

function evaluate(path, cwd) {
  return spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', packPath, '--cases', path],
    {cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
}

test('production Shield matches every Supabase fixture across all profiles', {skip: !process.env.SHIELD_BINARY}, t => {
  const result = evaluate(casesPath);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, supabaseCases().cases.length);
  t.diagnostic(`Evaluated ${report.cases.length} independent decisions.`);
});

test('Supabase migration creation checks the resolved checkout destination', {skip: !process.env.SHIELD_BINARY}, t => {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), 'supabase-migration-')));
  t.after(() => rmSync(fixture, {recursive: true, force: true}));
  const checkout = join(fixture, 'checkout');
  const supabase = join(checkout, 'supabase');
  const migrations = join(supabase, 'migrations');
  const outside = join(fixture, 'outside');
  const casesPath = join(fixture, 'cases.json');
  mkdirSync(supabase, {recursive: true});
  mkdirSync(outside);
  writeFileSync(join(supabase, 'config.toml'), 'project_id = "acme"\n');

  const command = 'supabase migration new example_change';
  const check = scenarios => {
    const cases = ['loose', 'recommended', 'strict'].flatMap(profile =>
      scenarios.map(([name, source, expected]) => ({
        name: `${name}-${profile}`, profile, expected,
        input: {kind: 'shell', source, dialect: 'bash', dialect_version: null, original_input: {}},
      })));
    writeFileSync(casesPath, JSON.stringify({schema_version: 1, cases}));
    const result = evaluate(casesPath, checkout);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.cases.length, cases.length);
  };

  check([
    ['create-missing-directory', command, 'allow'],
    ['hyphenated-slug', 'supabase migration new example-change2', 'allow'],
    ['explicit-workdir', `${command} --workdir .`, 'ask'],
    ['explicit-profile', 'supabase migration --profile other new example_change', 'ask'],
    ['environment-workdir-override', `SUPABASE_WORKDIR=../outside ${command}`, 'ask'],
    ['environment-configuration-override', `SUPABASE_HOME=../outside ${command}`, 'ask'],
    ['shell-outside-the-checkout', `cd ../outside && ${command}`, 'ask'],
    ['shell-creates-directory-link', `ln -s ../outside supabase/migrations && ${command}`, 'ask'],
  ]);

  const dotenv = join(checkout, '.env');
  writeFileSync(dotenv, 'ACME_TEST_VALUE=example\n');
  check([['ordinary-dotenv', command, 'allow']]);
  writeFileSync(dotenv, 'SUPABASE_WORKDIR=../outside\n');
  check([['dotenv-workdir-override', command, 'ask']]);
  rmSync(dotenv);

  const internal = join(checkout, 'internal');
  mkdirSync(internal);
  symlinkSync(internal, migrations, 'junction');
  const existing = join(internal, '20261127000000_example_change.sql');
  writeFileSync(existing, '');
  check([['contained-directory-link', command, 'allow']]);

  const outsideFile = join(outside, 'existing.sql');
  writeFileSync(outsideFile, '');
  linkSync(outsideFile, join(internal, '20261127000001_example_change.sql'));
  check([['existing-output-hardlink', command, 'ask']]);
  rmSync(join(internal, '20261127000001_example_change.sql'));
  if (process.platform !== 'win32') {
    symlinkSync(outsideFile, join(internal, '20261127000002_example_change.sql'));
    check([['existing-output-symlink', command, 'ask']]);
  }

  rmSync(migrations);
  symlinkSync(outside, migrations, 'junction');
  check([['outside-directory-link', command, 'ask']]);
  rmSync(migrations);
  renameSync(supabase, join(outside, 'supabase'));
  symlinkSync(join(outside, 'supabase'), supabase, 'junction');
  check([['outside-supabase-link', command, 'ask']]);

  rmSync(supabase);
  mkdirSync(supabase);
  writeFileSync(join(supabase, 'config.jsonc'), '{ "project_id": "acme" }');
  check([['jsonc-project-configuration', command, 'allow']]);
  mkdirSync(join(fixture, 'supabase'));
  writeFileSync(join(fixture, 'supabase', 'config.toml'), 'project_id = "ancestor"\n');
  check([['legacy-configuration-outside-checkout', command, 'ask']]);
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
