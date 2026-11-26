import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentDirectory, currentToolPack} from './build-current-tool-packs.mjs';
import {currentToolCases} from './current-tool-cases.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication, digest} from './registry-release.mjs';

// Independent source inventory: catalog.rs and its mobile, browser, build,
// project, diagnostic and bundled-documentation schema owners, Testrun 0.15.0.
const current = [
  'target_list','doctor','developer_mode_reveal','developer_support_install','connect','act','observe','status','disconnect',
  'control_status','control_acquire','control_release','app_install','app_uninstall','app_list','clipboard_read',
  'ui_snapshot','ui_find','ui_read','wait','preview_start','preview_stop','preview_status',
  'recording_start','recording_stop','recording_status','media_status','media_send','volume_get','volume_set','audio_probe','network_set',
  'browser_list','browser_doctor','browser_connect','browser_status','browser_send','browser_cancel','browser_disconnect',
  'config_init','config_check','config_show','config_schema','build_start','build_status','build_cancel','build_log',
  'project_list','project_show','project_start','project_status','project_open','project_discover','project_init','project_init_preview',
  'diagnostics_open','diagnostics_start','diagnostics_status','diagnostics_read','diagnostics_stop','diagnostics_close',
  'diagnostics_remove','diagnostics_analyze','diagnostics_analysis_status','diagnostics_analysis_cancel','diagnostics_query',
  'diagnostics_compare','diagnostics_capabilities','diagnostics_plan','diagnostics_prepare','diagnostics_project','diagnostics_export',
  'cancel','docs_list','docs_search','docs_read',
];
const retained = ['testrun_docs_list','testrun_docs_search','testrun_docs_read'];
const directory = currentDirectory('testrun');
const binding = {testrun:{transport:{type:'defaults',pack:'canonic/testrun',integration:'testrun'},
  agents:{codex:'testrun'},packs:{'canonic/testrun':'testrun'}}};

function evaluate(cases, pack = new URL('pack.yml', directory).pathname) {
  assert.ok(process.env.SHIELD_BINARY, 'Pass --shield PATH for evaluator validation');
  return spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack','--pack',pack,'--cases',cases],
    {encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
}

test('Testrun candidate reproduces admitted policy, inventory and every fixture', async () => {
  const pack = await currentToolPack('testrun');
  const fixtures = splitCaseFiles(await currentToolCases('testrun'));
  const validate = schemaValidator(schema);
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([name]) => name));
  for (const [file,document] of [['pack.yml',pack],...fixtures]) {
    const bytes = readFileSync(new URL(file,directory));
    assert.ok(bytes.length <= 1_048_576, file);
    assert.deepEqual(JSON.parse(bytes),document,file);
    assert.equal(validate(document),true,JSON.stringify(validate.errors));
  }
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json',directory))),
    {schema_version:1,commands:[{name:'testrun',rule_ids:pack.rules
      .filter(rule=>rule.conditions.domain==='argv').map(rule=>rule.id)}]});
});

test('Testrun current names and retained aliases have separate complete inventories', async () => {
  const pack = await currentToolPack('testrun');
  const names = [...new Set(pack.rules.filter(rule=>rule.conditions.domain==='mcp' && typeof rule.conditions.tool==='string')
    .map(rule=>rule.conditions.tool))].sort();
  assert.deepEqual(names,[...current,...retained].sort());
  const cases = (await currentToolCases('testrun')).cases;
  for (const name of [...current,...retained]) for (const profile of ['loose','recommended','strict'])
    assert.ok(cases.some(row=>row.profile===profile && row.input?.tool===name),`${name} ${profile}`);
});

test('installed Testrun agrees with the reviewed current catalog when available', t => {
  const result = spawnSync(process.env.TESTRUN_BINARY || 'testrun',['mcp','serve','--check','--json'],
    {encoding:'utf8',timeout:10000,maxBuffer:8*1024*1024});
  if (result.error?.code==='ENOENT' && !process.env.TESTRUN_BINARY) {
    t.skip('Testrun is not installed; set TESTRUN_BINARY to validate a selected build');
    return;
  }
  assert.equal(result.status,0,result.stderr);
  const tools = JSON.parse(result.stdout).tools;
  assert.deepEqual(tools.map(tool=>tool.name),current);
  for (const name of ['docs_list','docs_search','docs_read','project_list','project_discover','build_log']) {
    const properties = tools.find(tool=>tool.name===name).inputSchema.properties;
    assert.ok(properties.cursor && properties.limit,name);
    assert.equal(properties.offset,undefined,name);
  }
  // Creation requires the preview's plan digest as its authorization input.
  const init = tools.find(tool=>tool.name==='project_init').inputSchema;
  assert.deepEqual(init.required,['root','planDigest']);
  const preview = tools.find(tool=>tool.name==='project_init_preview').inputSchema;
  assert.deepEqual(preview.required,['root']);
  assert.equal(preview.properties.planDigest,undefined);
  assert.equal(init.properties.dryRun,undefined);
  assert.equal(preview.properties.dryRun,undefined);

  const diagnostics = tools.find(tool=>tool.name==='diagnostics_start').inputSchema;
  const nativeTrace = diagnostics.properties.source.oneOf.find(schema=>schema.properties.kind.const==='native_trace');
  assert.deepEqual(nativeTrace.required,['kind','backend','mode','targetId','appId']);
  assert.deepEqual(nativeTrace.properties.template.enum,
    ['Time Profiler','Points of Interest','System Trace','Hangs','Allocations','Leaks','Activity Monitor']);
  for (const field of ['path','toolPath']) assert.equal(nativeTrace.properties[field].type,'string');
  assert.equal(nativeTrace.properties.allowSystemTrace.type,'boolean');
});

test('production Shield evaluates every independent Testrun case', {skip:!process.env.SHIELD_BINARY}, async t => {
  let total = 0;
  for (const file of await caseFileNames(directory)) {
    const result = evaluate(new URL(file,directory).pathname);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed) ?? report)+result.stderr);
    assert.equal(report.passed,true);
    total += report.cases.length;
  }
  assert.equal(total,(await currentToolCases('testrun')).cases.length);
  t.diagnostic(`Evaluated all ${total} independent Testrun cases.`);
});

test('Testrun retains signed 0.2.8 bytes and independent historical decisions', {skip:!process.env.SHIELD_BINARY}, async () => {
  const previous = currentDirectory('testrun','0.2.8');
  const catalog = await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const published = catalog.releases.find(row=>row.id==='canonic/testrun' && row.version==='0.2.8');
  assert.ok(published);
  assert.equal(digest(readFileSync(new URL('pack.yml',previous))),published.sha256);
  for (const file of ['pack.yml',...await caseFileNames(previous),'commands.json','README.md','LICENSE'])
    assert.deepEqual(readFileSync(new URL(file,previous)),
      readFileSync(new URL(`../public/packs/canonic/testrun/0.2.8/${file}`,import.meta.url)),file);
  for (const file of await caseFileNames(previous)) {
    const result = evaluate(new URL(file,previous).pathname,new URL('pack.yml',previous).pathname);
    const report=JSON.parse(result.stdout || '{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed) ?? report)+result.stderr);
  }
});

test('historical Testrun 0.2.8 configuration-file decisions stay frozen', {skip:!process.env.SHIELD_BINARY}, () => {
  const owner = mkdtempSync(join(tmpdir(),'testrun-config-pack-'));
  try {
    const file = join(owner,'cases.json');
    writeFileSync(file,JSON.stringify({schema_version:1,cases:['loose','recommended','strict'].map(profile=>({
      name:`published-outside-config-${profile}`,profile,mcp:binding,
      input:{kind:'mcp',server:'testrun',tool:'config_show',arguments:{root:'.',config:'/outside/testrun.yml'},original_input:{}},
      expected:'allow',
    }))}));
    const result = evaluate(file,new URL('pack.yml',currentDirectory('testrun','0.2.8')).pathname);
    assert.equal(result.status,0,result.stdout+result.stderr);
  } finally {rmSync(owner,{recursive:true,force:true});}
});

test('Testrun rejects foreign executable, wrapper, HTTP and extra launch arguments', {skip:!process.env.SHIELD_BINARY}, () => {
  const owner = mkdtempSync(join(tmpdir(),'testrun-transport-pack-'));
  try {
    const file = join(owner,'cases.json');
    for (const transport of [
      {type:'stdio',command:'testrun',args:['mcp','serve','--check'],env:{}},
      {type:'stdio',command:'/tmp/forged/testrun',args:['mcp','serve'],env:{}},
      {type:'stdio',command:'sh',args:['-c','testrun mcp serve'],env:{}},
      {type:'http',url:'https://example.com/mcp'},
    ]) {
      const mcp = structuredClone(binding);
      mcp.testrun.transport = transport;
      writeFileSync(file,JSON.stringify({schema_version:1,cases:[{name:'foreign-transport',profile:'recommended',mcp,
        input:{kind:'mcp',server:'testrun',tool:'docs_list',arguments:{},original_input:{}},expected:'allow'}]}));
      const result = evaluate(file);
      assert.equal(result.status,2,result.stdout+result.stderr);
      assert.match(result.stdout,/connection does not match its pack integration/);
    }
  } finally {rmSync(owner,{recursive:true,force:true});}
});
