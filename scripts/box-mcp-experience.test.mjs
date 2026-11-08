import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {checkPublication, digest} from './registry-release.mjs';
import {currentDirectory, currentToolPack} from './build-current-tool-packs.mjs';
import {currentToolCases} from './current-tool-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('Box candidate reproduces admitted policy, inventory and independent fixtures', async () => {
  const pack = await currentToolPack('box');
  const cases = await currentToolCases('box');
  const validate = schemaValidator(schema);
  for (const [file, document] of [['pack.yml',pack],['cases.json',cases]]) {
    const bytes = readFileSync(new URL(file,currentDirectory('box')));
    assert.ok(bytes.length <= 1_048_576, `${file}: artifact limit`);
    assert.deepEqual(JSON.parse(bytes),document);
    assert.equal(validate(document),true,JSON.stringify(validate.errors));
  }
  const published = JSON.parse(readFileSync(new URL('../packs/canonic/box/0.2.2/pack.yml',import.meta.url)));
  const retainedCases = JSON.parse(readFileSync(new URL('../packs/canonic/box/0.2.2/cases.json',import.meta.url)));
  for (const row of retainedCases.cases) {
    assert.deepEqual(cases.cases.find(next => next.name === row.name),row,row.name);
  }
  for (const old of published.rules) {
    const next = pack.rules.find(rule => rule.id === old.id);
    assert.ok(next,old.id);
    if (old.id !== 'mcp-unlisted') assert.deepEqual(next,old,old.id);
  }
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  const oldFallback = structuredClone(published.rules.find(rule => rule.id === 'mcp-unlisted'));
  oldFallback.conditions.tool.not.one_of.push('config_show');
  // Tool ordering is not permission semantics.
  oldFallback.conditions.tool.not.one_of.sort();
  const actualFallback = structuredClone(fallback);
  actualFallback.conditions.tool.not.one_of.sort();
  assert.deepEqual(actualFallback,oldFallback);
  assert.equal(new Set(pack.rules.map(rule => rule.id)).size,pack.rules.length);
  const inventory = JSON.parse(readFileSync(new URL('commands.json',currentDirectory('box'))));
  assert.deepEqual(inventory,{schema_version:1,commands:[{name:'box',rule_ids:pack.rules
    .filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]});
});

test('Box candidate CLI and MCP cases use the production evaluator', {skip:!process.env.SHIELD_BINARY}, () => {
  const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
    '--pack',new URL('pack.yml',currentDirectory('box')).pathname,
    '--cases',new URL('cases.json',currentDirectory('box')).pathname],
    {encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row => !row.passed) ?? report)+result.stderr);
  assert.equal(report.passed,true);
});

test('Box optional MCP experience retains signed 0.2.2 permission boundaries', {skip:!process.env.SHIELD_BINARY}, async () => {
  const catalog = await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const pack = new URL('../packs/canonic/box/0.2.2/pack.yml',import.meta.url);
  const published = (catalog.releases??catalog.packs).find(row => row.id === 'canonic/box' && row.version === '0.2.2');
  assert.ok(published, 'authenticated published baseline');
  assert.equal(digest(readFileSync(pack)),published.sha256,'published bytes stay immutable');
  for (const file of ['pack.yml','cases.json','commands.json','README.md','LICENSE']) {
    assert.deepEqual(readFileSync(new URL(`../packs/canonic/box/0.2.2/${file}`,import.meta.url)),
      readFileSync(new URL(`../public/packs/canonic/box/0.2.2/${file}`,import.meta.url)),
      `published ${file} remains immutable`);
  }
  const binding = {box:{transport:{type:'stdio',command:'box',args:['mcp','serve'],env:{}},agents:{codex:'box'},packs:{'canonic/box':'box'}}};
  const routine = {loose:'allow',recommended:'allow',strict:'ask'};
  const change = {loose:'allow',recommended:'ask',strict:'ask'};
  const ask = {loose:'ask',recommended:'ask',strict:'ask'};
  const allow = {loose:'allow',recommended:'allow',strict:'allow'};
  const attempt = {workspace:'acme',operation:'1'.repeat(32),generation:'2'.repeat(32),request_id:'3'.repeat(32),from:'main'};
  const operations = [
    ['workspace_create',{name:'acme',deferred:true},routine],
    ['workspace_create',{name:'acme',deferred:true,path:'/outside/acme'},ask],
    ['workspace_attach',{name:'acme',path:'/tmp/acme',deferred:true},ask],
    ['workspace_prepare',{...attempt,deferred:true},routine],
    ['workspace_prepare',{...attempt,deferred:true,request_id:'G'.repeat(32)},ask],
    ['config_sync',{select:true,agents:['codex'],servers:['docs']},change],
    ['config_sync',{select:true,dry_run:true},allow],
    ['config_sync',{select:true,dry_run:'true'},change],
    ['workspace_prepare',{...attempt,deferred:true,generation:'bad'},ask],
    ['workspace_prepare',{workspace:'acme',deferred:true},ask],
    ['docs_list',{},allow],
    ['docs_search',{query:'workspace'},allow],
    ['docs_read',{path:'README.md'},allow],
    // Dashboard reads use status. Resources and Tasks management are protocol
    // methods, not new MCP tools to grant through a tool permission pack.
    ['status',{workspace:'acme'},allow],
    ['unlisted_dashboard_action',{},ask],
  ];
  const rows = [];
  for (const profile of ['loose','recommended','strict']) {
    for (const [index,[tool,args,decisions]] of operations.entries()) {
      for (const outside of [false,true]) {
        rows.push({name:`${profile}-${index}-${outside}`,profile,mcp:binding,
          input:{kind:'mcp',server:'box',tool,arguments:{...args,...(outside?{project:'/outside/other'}:{})},original_input:{}},
          // Bundled documentation ignores project selection and opens no paths.
          expected:outside && !tool.startsWith('docs_')?'ask':decisions[profile]});
      }
    }
  }
  const directory = mkdtempSync(join(tmpdir(),'box-mcp-experience-'));
  try {
    const path = join(directory,'cases.json');
    writeFileSync(path,JSON.stringify({schema_version:1,cases:rows}));
    const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',pack.pathname,'--cases',path],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row => !row.passed) ?? report)+result.stderr);
    assert.equal(report.passed,true);
    const mismatched = structuredClone(binding);
    mismatched.box.transport.args.push('--project','/outside/other');
    writeFileSync(path,JSON.stringify({schema_version:1,cases:[{...rows[0],mcp:mismatched}]}));
    const refused = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',pack.pathname,'--cases',path],{encoding:'utf8',timeout:120000});
    assert.equal(refused.status,2,refused.stdout+refused.stderr);
    assert.match(refused.stdout,/connection does not match its pack integration/);
    const http = structuredClone(binding);
    http.box.transport = {type:'http',url:'https://example.com/mcp'};
    writeFileSync(path,JSON.stringify({schema_version:1,cases:[{...rows[0],mcp:http}]}));
    const wrongTransport = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack','--pack',pack.pathname,'--cases',path],{encoding:'utf8',timeout:120000});
    assert.equal(wrongTransport.status,2,wrongTransport.stdout+wrongTransport.stderr);
    assert.match(wrongTransport.stdout,/connection does not match its pack integration/);
  } finally {rmSync(directory,{recursive:true,force:true});}
});
