import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hubPack} from './hub-policy.mjs';
import {hubCases, tools, binding} from './hub-cases.mjs';
import {directory, guide} from './build-hub-pack.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication, digest} from './registry-release.mjs';

// The current interface, independently of the policy: `hub mcp serve --check`
// of hub 0.39.0 in catalog order (including appended preview identities).
const catalog = ['init','config_check','config_plan','config_schema','setup','workspace_create','workspace_attach',
  'workspace_list','workspace_show','workspace_remove','workspace_prepare','workspace_data_reset','task_show','task_update',
  'task_history','task_export','task_import','task_step_list','task_step_next','task_step_add','task_step_update',
  'task_step_remove','task_check_add','task_check_update','task_check_remove','task_note_add','task_note_update',
  'task_note_remove','process_run','process_exec','process_stop','process_list','process_logs','process_url','process_gateway_enable',
  'process_gateway_disable','process_gateway_status','agent_start','agent_list','agent_show','agent_message','agent_stop',
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

function evaluate(file) {
  assert.ok(process.env.SHIELD_BINARY, 'Pass --shield PATH; the new pack must not skip evaluator validation');
  return spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack','--pack',new URL('pack.yml',directory).pathname,'--cases',file],
    {encoding:'utf8', timeout:120000, maxBuffer:32*1024*1024});
}

test('Hub retains the signed release bytes and every published decision', {skip:!process.env.SHIELD_BINARY}, async () => {
  const previous = new URL('../packs/canonic/hub/0.1.0/', import.meta.url);
  const catalog = await checkPublication(new URL('../public', import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  const published = catalog.releases.find(row => row.id === 'canonic/hub' && row.version === '0.1.0');
  assert.ok(published, 'authenticated published baseline');
  assert.equal(digest(readFileSync(new URL('pack.yml', previous))), published.sha256);
  for (const file of ['pack.yml', ...await caseFileNames(previous), 'commands.json', 'README.md', 'LICENSE']) {
    assert.deepEqual(readFileSync(new URL(file, previous)),
      readFileSync(new URL(`../public/packs/canonic/hub/0.1.0/${file}`, import.meta.url)),
      `published ${file} remains immutable`);
  }
  // Independently authored historical fixtures run unchanged against the candidate.
  for (const file of await caseFileNames(previous)) {
    const result = evaluate(new URL(file, previous).pathname);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).passed, true);
  }
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
