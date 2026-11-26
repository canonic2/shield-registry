import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, realpathSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hubPack} from './hub-policy.mjs';
import {hubCases, tools, binding, crossDirectoryReview} from './hub-cases.mjs';
import {directory, guide} from './build-hub-pack.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication, digest} from './registry-release.mjs';

// The Hub 0.58.0 source interface, independently of the policy, in catalog
// order (including preview identities).
const catalog = ['init','config_check','config_check_compose','config_plan','config_schema','setup','mcp_catalog_probe','mcp_catalog_show','mcp_app_create_preview','workspace_create','workspace_attach',
  'workspace_list','workspace_show','workspace_remove','workspace_prepare','workspace_data_reset','task_show','task_update',
  'task_history','task_export','task_import','task_step_list','task_step_next','task_step_add','task_step_update',
  'task_step_remove','task_check_add','task_check_update','task_check_remove','task_note_add','task_note_update',
  'task_note_remove','process_run','process_exec','process_restart','process_pause','process_resume','process_stop','process_forget','process_list','process_logs','process_stats','process_url','process_gateway_enable',
  'process_gateway_disable','process_gateway_status','proxy_projects','proxy_status','proxy_deliveries','proxy_route_update',
  'proxy_logout','proxy_endpoint_create','proxy_endpoint_rename','proxy_endpoint_pause','proxy_endpoint_resume','proxy_endpoint_delete',
  'proxy_route_create','proxy_route_delete','proxy_connector_revoke','proxy_login','proxy_connect','proxy_disconnect',
  'agent_start','agent_list','agent_show','agent_message','agent_stop','agent_terminal_read',
  'plugin_list','plugin_show','plugin_enable','plugin_disable','plugin_reset','plugin_binding_add','plugin_binding_remove','plugin_binding_list',
  'plugin_context_show','plugin_prepare','plugin_workflow_run','plugin_workflow_resume','plugin_workflow_list',
  'plugin_workflow_show','plugin_workflow_reconcile','plugin_workflow_abandon','plugin_check','status','doctor',
  'manager_status','manager_stop','manager_drain','manager_blocker_list','operation_list','operation_show','operation_cancel',
  'setup_preview','workspace_remove_preview','task_update_preview','task_import_preview',
  'task_step_add_preview','task_step_update_preview','task_step_remove_preview',
  'task_check_add_preview','task_check_update_preview','task_check_remove_preview',
  'task_note_add_preview','task_note_update_preview','task_note_remove_preview',
  'plugin_enable_preview','plugin_disable_preview','plugin_reset_preview','plugin_binding_add_preview','plugin_binding_remove_preview',
  'plugin_workflow_run_preview','plugin_workflow_resume_preview','plugin_check_preview','docs_list','docs_search','docs_read'];

test('Hub sources reproduce with schema-valid policy and fixtures', async () => {
  const pack = hubPack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(hubCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory));
    assert.ok(bytes.length <= 1_048_576, `${file}: artifact limit`);
    assert.deepEqual(JSON.parse(bytes), document);
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), {
    schema_version:1,commands:[{name:'hub',rule_ids:pack.rules
      .filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}],
  });
  const ids = pack.rules.map(rule => rule.id);
  assert.equal(new Set(ids).size, ids.length);
  const authConfirmation = pack.rules.find(rule => rule.id === 'mcp-auth-setup-confirm');
  assert.equal(Object.hasOwn(authConfirmation.conditions, 'cwd'), false,
    'user-scope credential changes require confirmation from any directory');
  const proxyReview = pack.rules.find(rule => rule.id === 'proxy');
  assert.equal(Object.hasOwn(proxyReview.conditions, 'cwd'), false,
    'hosted proxy operations require review even outside a Hub project');
  for (const id of ['setup', 'mcp-setup', 'mcp-catalog', 'mcp-catalog-import']) {
    const rule = pack.rules.find(row => row.id === `${id}-personal-write`);
    assert.equal(Object.hasOwn(rule.conditions, 'cwd'), false, id);
    assert.deepEqual(rule.decision, {loose:'ask', recommended:'ask', strict:'ask'}, id);
  }
  for (const id of ['shell-secret-profile', 'config-secrets-sync', 'hook-child', 'agent-attach',
    'config-check-lenient', 'process-run-private', 'process-forget-confirm']) {
    const rule = pack.rules.find(row => row.id === id);
    assert.equal(Object.hasOwn(rule.conditions, 'cwd'), false, id);
    assert.deepEqual(rule.decision, {loose:'ask', recommended:'ask', strict:'ask'}, id);
  }
  assert.deepEqual(pack.rules.find(row => row.id === 'shell').conditions.cwd,
    {within:{root:'write'}}, 'ordinary shell policy retains its working-directory scope');
  assert.deepEqual(pack.mcp_integrations.hub.fields['/args'], {exact: ['mcp','serve']});
});

test('Hub coverage names exactly the current MCP catalog', () => {
  const pack = hubPack();
  const covered = new Set(pack.rules.filter(rule => rule.conditions.domain === 'mcp' && typeof rule.conditions.tool === 'string')
    .map(rule => rule.conditions.tool));
  assert.deepEqual([...covered].sort(), [...catalog].sort());
  assert.deepEqual(tools.map(([tool]) => tool), catalog);
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  assert.deepEqual([...fallback.conditions.tool.not.one_of].sort(), [...catalog].sort());
});

function evaluate(file, pack = new URL('pack.yml', directory).pathname, extra = []) {
  assert.ok(process.env.SHIELD_BINARY, 'Pass --shield PATH; the new pack must not skip evaluator validation');
  return spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack','--pack',pack,'--cases',file,...extra],
    {encoding:'utf8', timeout:120000, maxBuffer:32*1024*1024});
}

// CLI --yes skips the routing form. The named MCP calls have their own forms.
const authBypass = /^cli-auth-setup-(loose|recommended)$/;
const unapprovedRunConfig = /^mcp-config-file-(loose|recommended)$/;
const hubConfirmed = /^(mcp-remove-(discard|forget)-(loose|recommended)|mcp-tool-plugin_workflow_(run|resume)-recommended)$/;

test('Hub retains signed assets and replays the latest and retained fixture sets', {skip:!process.env.SHIELD_BINARY}, async () => {
  const catalog = await checkPublication(new URL('../public', import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  const current = new Map(hubCases().cases.map(row => [row.name, row]));
  for (const version of ['0.1.3', '0.1.5', '0.1.6', '0.1.7', '0.1.10', '0.1.11']) {
    const previous = new URL(`../packs/canonic/hub/${version}/`, import.meta.url);
    const signed = new URL(`../public/packs/canonic/hub/${version}/`, import.meta.url);
    const published = catalog.releases.find(row => row.id === 'canonic/hub' && row.version === version);
    assert.ok(published, `authenticated published predecessor ${version}`);
    assert.equal(digest(readFileSync(new URL('pack.yml', previous))), published.sha256);
    const fixtures = await caseFileNames(previous);
    for (const file of ['pack.yml', ...fixtures, 'commands.json', 'README.md', 'LICENSE'])
      assert.deepEqual(readFileSync(new URL(file, previous)), readFileSync(new URL(file, signed)), `${version}/${file}`);
    const owner = mkdtempSync(join(tmpdir(), 'hub-retained-'));
    try {
      let changed = 0;
      for (const file of fixtures) {
        const document = JSON.parse(readFileSync(new URL(file, previous)));
        const cases = document.cases.map(row => {
          if (version === '0.1.11') return row;
          const tighten = (version === '0.1.3' && authBypass.test(row.name)) || unapprovedRunConfig.test(row.name);
          if (!tighten && (version === '0.1.10' || !hubConfirmed.test(row.name))) return row;
          assert.equal(row.expected, tighten ? 'allow' : 'ask', row.name);
          const revised = {...row, expected: tighten ? 'ask' : 'allow'};
          assert.deepEqual(current.get(row.name), revised, row.name);
          changed += 1;
          return revised;
        });
        const path = join(owner, file);
        writeFileSync(path, JSON.stringify({...document, cases}));
        const result = evaluate(path);
        const report = JSON.parse(result.stdout || '{}');
        assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
        assert.equal(report.passed, true);
      }
      assert.equal(changed, {'0.1.3': 10, '0.1.10': 2, '0.1.11': 0}[version] ?? 8, version);
    } finally { rmSync(owner, {recursive:true, force:true}); }
  }
});

test('Hub reviews the three sensitive CLI forms from outside the approved working directory', {skip:!process.env.SHIELD_BINARY}, () => {
  // Test-pack starts in the project. Evaluate a shell whose Hub operation
  // runs after changing to an existing directory outside that project.
  const owner = mkdtempSync(join(tmpdir(), 'hub-outside-'));
  try {
    const cwd = realpathSync(owner);
    const path = join(owner, 'cases.json');
    const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    const cases = ['loose','recommended','strict'].flatMap(profile =>
      crossDirectoryReview.map(([label, argv]) => ({
        name: `${label}-${profile}`, profile, expected: 'ask',
        input: {kind:'shell', dialect:'bash', original_input:{},
          source: `cd ${quote(cwd)} && ${argv.map(quote).join(' ')}`},
      })));
    writeFileSync(path, JSON.stringify({schema_version:1,cases}));
    const published = new URL('../public/packs/canonic/hub/0.1.11/pack.yml', import.meta.url).pathname;
    for (const [pack, loose] of [[published,'allow'], [undefined,'ask']]) {
      const result = evaluate(path, pack, ['--details']);
      assert.ok([0,1].includes(result.status), result.stdout + result.stderr);
      const report = JSON.parse(result.stdout);
      assert.equal(report.cases.length, cases.length);
      for (const row of report.cases) {
        const operation = row.evaluation.analysis_coverage.operations.at(-1);
        assert.equal(operation.request.executable, 'hub', row.name);
        assert.equal(operation.cwd, cwd, row.name);
        assert.equal(operation.evaluation.decision, row.profile === 'loose' ? loose : 'ask', row.name);
      }
    }
  } finally { rmSync(owner, {recursive:true, force:true}); }
});

test('production Shield admits the Hub source pack', {skip:!process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal','validate','--pack',new URL('pack.yml',directory).pathname],
    {encoding:'utf8',timeout:120000});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).valid, true);
});

test('production Shield reproduces every independent Hub decision', {skip:!process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const path = new URL(file, directory).pathname;
    const result = evaluate(path);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(readFileSync(path)).cases.length);
    total += report.cases.length;
  }
  assert.equal(total, hubCases().cases.length);
  t.diagnostic(`Evaluated all ${total} independent hub cases.`);
});

test('approved run and replacement recipes and catalog paths keep their ordinary decisions', {skip:!process.env.SHIELD_BINARY}, () => {
  const owner = mkdtempSync(join(tmpdir(), 'hub-replacement-recipe-'));
  try {
    const path = join(owner, 'cases.json');
    const execution = '11111111111111111111111111111111';
    const config = join(process.cwd(), 'package.json');
    const calls = [
      ['doctor', {execution, config}],
      ['process_stop', {execution, config, check_replacement: true}],
      ['process_run', {targets: ['web'], config, detach: true, wait_ms: 30000}],
    ];
    const cases = ['loose', 'recommended', 'strict'].flatMap(profile => {
      const expected = profile === 'strict' ? 'ask' : 'allow';
      return [
        ...calls.map(([tool, arguments_]) => ({name: `${tool}-${profile}`, profile, mcp: binding(),
          input: {kind: 'mcp', server: 'hub', tool, arguments: arguments_, original_input: {}}, expected})),
        {name: `catalog-import-${profile}`, profile,
          argv: ['hub', '--project', process.cwd(), 'mcp', 'catalog', '--scope=project', 'import', 'acme', '--from', config], expected},
        {name: `catalog-legacy-import-${profile}`, profile,
          argv: ['hub', '--project', process.cwd(), 'mcp', 'catalog', 'acme', '--from', config], expected},
      ];
    });
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    const result = evaluate(path);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
  } finally { rmSync(owner, {recursive: true, force: true}); }
});

test('the Hub name cannot authorize another executable, wrapper, transport or extra arguments', {skip:!process.env.SHIELD_BINARY}, () => {
  const owner = mkdtempSync(join(tmpdir(), 'hub-pack-'));
  try {
    for (const transport of [
      {type:'stdio',command:'/tmp/forged/hub',args:['mcp','serve'],env:{}},
      {type:'stdio',command:'hub-evil',args:['mcp','serve'],env:{}},
      {type:'stdio',command:'sh',args:['-c','hub mcp serve'],env:{}},
      {type:'stdio',command:'box',args:['mcp','serve'],env:{}},
      {type:'stdio',command:'hub',args:['mcp','serve','--project','/outside/other'],env:{}},
      {type:'stdio',command:'hub',args:['mcp','serve','--check'],env:{}},
      {type:'http',url:'https://example.com/mcp'},
    ]) {
      const path = join(owner, 'cases.json');
      writeFileSync(path, JSON.stringify({schema_version:1,cases:[{name:'foreign-transport',profile:'recommended',mcp:binding(transport),
        input:{kind:'mcp',server:'hub',tool:'task_show',arguments:{},original_input:{}},expected:'allow'}]}));
      const result = evaluate(path);
      assert.equal(result.status, 2, JSON.stringify(transport) + result.stdout + result.stderr);
      assert.match(result.stdout, /connection does not match its pack integration/);
    }
  } finally { rmSync(owner, {recursive:true, force:true}); }
});

test('installed Hub catalog agrees with the reviewed inventory when available', t => {
  const result = spawnSync(process.env.HUB_BINARY || 'hub', ['mcp','serve','--check'], {encoding:'utf8',timeout:10000});
  if (result.error?.code === 'ENOENT' && !process.env.HUB_BINARY) {
    t.skip('Hub is not installed; set HUB_BINARY to validate an explicit build');
    return;
  }
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).tools, catalog);
});
