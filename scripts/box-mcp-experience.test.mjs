import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync, realpathSync, symlinkSync} from 'node:fs';
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
  const published = JSON.parse(readFileSync(new URL('../packs/canonic/box/0.2.3/pack.yml',import.meta.url)));
  const retainedCases = JSON.parse(readFileSync(new URL('../packs/canonic/box/0.2.3/cases.json',import.meta.url)));
  for (const row of retainedCases.cases) {
    const retired = ['box_docs_list','box_docs_search','box_docs_read'].includes(row.input?.tool);
    assert.deepEqual(cases.cases.find(next => next.name === row.name),retired?{...row,expected:'ask'}:row,row.name);
  }
  for (const old of published.rules) {
    const next = pack.rules.find(rule => rule.id === old.id);
    if (['box_docs_list','box_docs_search','box_docs_read'].includes(old.conditions.tool)) {
      assert.equal(next,undefined,old.id);
      continue;
    }
    if (old.conditions.domain==='mcp' && old.conditions.fields?.['/project']) {
      assert.equal(next,undefined,old.id);
      const gate=pack.preconditions.find(rule => rule.id===old.id);
      assert.ok(gate,old.id);
      assert.deepEqual(gate.on_unmet.decision,old.decision,old.id);
      continue;
    }
    assert.ok(next,old.id);
    if (old.id !== 'mcp-unlisted') assert.deepEqual(next,old,old.id);
  }
  const fallback = pack.rules.find(rule => rule.id === 'mcp-unlisted');
  const oldFallback = structuredClone(published.rules.find(rule => rule.id === 'mcp-unlisted'));
  oldFallback.conditions.tool.not.one_of.push('setup');
  oldFallback.conditions.tool.not.one_of = oldFallback.conditions.tool.not.one_of
    .filter(name => !['box_docs_list','box_docs_search','box_docs_read'].includes(name));
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

test('Box 0.29 candidate keeps the authenticated 0.2.4 release immutable', async () => {
  const catalog = await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const baseline = catalog.releases.find(row => row.id==='canonic/box' && row.version==='0.2.4');
  assert.ok(baseline);
  const directory = new URL('../packs/canonic/box/0.2.4/',import.meta.url);
  assert.equal(digest(readFileSync(new URL('pack.yml',directory))),baseline.sha256);
  for (const file of ['pack.yml','cases.json','commands.json','README.md','LICENSE']) {
    assert.deepEqual(readFileSync(new URL(file,directory)),
      readFileSync(new URL(`../public/packs/canonic/box/0.2.4/${file}`,import.meta.url)),file);
  }
  const manifest = JSON.parse(readFileSync(new URL('../release.json',import.meta.url)));
  assert.equal(manifest.packs.filter(path => path==='packs/canonic/box/0.2.5/pack.yml').length,1);
});

test('Box explicit current-checkout paths preserve ordinary MCP decisions', {skip:!process.env.SHIELD_BINARY}, t => {
  const temp=realpathSync(mkdtempSync(join(tmpdir(),'box-project-pack-')));
  const project=join(temp,'.gate','workspaces','feature');
  const child=join(project,'child'),other=join(temp,'other');
  const lookalike=project+'-other';
  for (const path of [child,other,lookalike]) mkdirSync(path,{recursive:true});
  const alias=join(temp,'alias'),escape=join(project,'escape');
  symlinkSync(project,alias,'dir');
  symlinkSync(other,escape,'dir');
  const binding={box:{transport:{type:'stdio',command:'box',args:['mcp','serve'],env:{}},agents:{codex:'box'},packs:{'canonic/box':'box'}}};
  const operations=[
    ['setup',{agents:['codex']},['allow','ask','ask']],
    ['setup',{agents:['codex'],dry_run:true},['allow','allow','allow']],
    ['setup',{agents:['codex'],repair_hooks:true},['allow','ask','ask']],
    ['config_show',{},['allow','allow','allow']],
    ['config_sync',{dry_run:true},['allow','allow','allow']],
    ['config_sync',{},['allow','ask','ask']],
    ['config_sync',{dry_run:false},['allow','ask','ask']],
    ['config_sync',{dry_run:'true'},['allow','ask','ask']],
    ['status',{},['allow','allow','allow']],
    ['plugin_list',{},['allow','allow','allow']],
    ['workspace_create',{name:'acme'},['allow','allow','ask']],
    ['workspace_create',{name:'acme',path:'/outside/acme'},['ask','ask','ask']],
    ['workspace_prepare',{workspace:'acme'},['ask','ask','ask']],
    ['exec',{command:['node','check.mjs']},['ask','ask','ask']],
    ['workspace_cleanup',{workspace:'acme',dry_run:true},['allow','allow','allow']],
    ['workspace_cleanup',{workspace:'acme',worktree:true},['ask','ask','deny']],
    ['workspace_remove',{workspace:'acme',delete_checkout:true},['ask','ask','deny']],
    ['workspace_remove',{workspace:'acme',forget:true},['ask','ask','deny']],
    ['workspace_remove',{workspace:'acme',discard_changes:true},['ask','ask','deny']],
    ['stop',{workspace:'acme',allow_self_stop:true},['ask','ask','ask']],
    ['recover',{workspace:'acme',operation:'1'.repeat(32)},['ask','ask','ask']],
    ['unknown_tool',{},['ask','ask','ask']],
  ];
  const selections=[
    ['omitted',{},true],['null',{project:null},true],
    ['exact',{project},true],['trailing-slash',{project:project+'/'},true],
    ['alias',{project:alias},true],['parent-components',{project:join(project,'child')+'/..'},true],
    ['child',{project:child},false],['parent',{project:join(temp,'.gate','workspaces')},false],
    ['other',{project:other},false],['lookalike',{project:lookalike},false],['escape',{project:escape},false],
    ['missing',{project:join(temp,'missing')},false],['relative',{project:'.'},false],
    ['empty',{project:''},false],['malformed',{project:42},false],
  ];
  try {
    const rows=[];
    for (const [index,profile] of ['loose','recommended','strict'].entries()) {
      for (const [operation,[tool,args,decisions]] of operations.entries()) {
        for (const [label,selection,same] of selections) {
          // Outside projects keep the former explicit-project review boundary,
          // including Strict cleanup/deletion denial even on a cleanup preview.
          const deniedOutside=profile==='strict' && ['workspace_cleanup','workspace_remove'].includes(tool);
          rows.push({name:`${profile}-${operation}-${label}`,profile,mcp:binding,
            input:{kind:'mcp',server:'box',tool,arguments:{...args,...selection},original_input:{}},
            expected:same?decisions[index]:deniedOutside?'deny':'ask'});
        }
      }
    }
    const path=join(temp,'cases.json');
    writeFileSync(path,JSON.stringify({schema_version:1,cases:rows}));
    const result=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
      '--pack',new URL('pack.yml',currentDirectory('box')).pathname,'--cases',path],
      {cwd:project,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    const report=JSON.parse(result.stdout||'{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
    assert.equal(report.passed,true);
    assert.equal(report.cases.length,rows.length);
    t.diagnostic(`Evaluated ${rows.length} independent project-selection cases across all profiles.`);
    for (const transport of [
      {type:'stdio',command:'box',args:['mcp','serve','--project',project],env:{}},
      {type:'http',url:'https://example.com/mcp'},
    ]) {
      const mismatched=structuredClone(binding);
      mismatched.box.transport=transport;
      writeFileSync(path,JSON.stringify({schema_version:1,cases:[{name:'wrong-transport',profile:'recommended',mcp:mismatched,
        input:{kind:'mcp',server:'box',tool:'config_show',arguments:{project},original_input:{}},expected:'allow'}]}));
      const refused=spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
        '--pack',new URL('pack.yml',currentDirectory('box')).pathname,'--cases',path],
        {cwd:project,encoding:'utf8',timeout:120000});
      assert.equal(refused.status,2,refused.stdout+refused.stderr);
      assert.match(refused.stdout,/connection does not match its pack integration/);
    }
  } finally {rmSync(temp,{recursive:true,force:true});}
});

test('Box 0.27 cleanup and retired-workspace repair retain signed 0.2.3 boundaries', {skip:!process.env.SHIELD_BINARY}, async () => {
  const directory = new URL('../packs/canonic/box/0.2.3/',import.meta.url);
  const catalog = await checkPublication(new URL('../public',import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub',import.meta.url),'utf8').trim());
  const published = catalog.releases.find(row => row.id === 'canonic/box' && row.version === '0.2.3');
  assert.ok(published,'authenticated published baseline');
  assert.equal(digest(readFileSync(new URL('pack.yml',directory))),published.sha256);
  for (const file of ['pack.yml','cases.json','commands.json','README.md','LICENSE']) {
    assert.deepEqual(readFileSync(new URL(file,directory)),
      readFileSync(new URL(`../public/packs/canonic/box/0.2.3/${file}`,import.meta.url)),
      `published ${file} remains immutable`);
  }
  const allow = {loose:'allow',recommended:'allow',strict:'allow'};
  const change = {loose:'allow',recommended:'ask',strict:'ask'};
  const destroy = {loose:'ask',recommended:'ask',strict:'deny'};
  const review = {loose:'ask',recommended:'ask',strict:'ask'};
  const workspace = 'a'.repeat(32);
  const cli = [
    ['forget',['workspace','remove',workspace,'--forget'],destroy],
    ['history',['workspace','cleanup',workspace,'--history'],destroy],
    ['checkout-history',['workspace','cleanup',workspace,'--worktree','--history'],destroy],
    ['discard-history',['workspace','cleanup',workspace,'--worktree','--history','--discard-changes'],destroy],
    ['assessment',['workspace','cleanup',workspace,'--dry-run'],allow],
    // Box rejects this combination before effects; it remains a preview spelling.
    ['assessment-resource-conflict',['workspace','cleanup',workspace,'--dry-run','--history'],allow],
    ['repair-preview',['repair','--workspace',workspace],allow],
    ['repair-apply',['repair','--workspace',workspace,'--confirm','digest'],change],
  ];
  const mcp = [
    ['forget','workspace_remove',{workspace,forget:true},destroy],
    ['forget-checkout-conflict','workspace_remove',{workspace,forget:true,delete_checkout:true},destroy],
    ['forget-discard-conflict','workspace_remove',{workspace,forget:true,discard_changes:true},destroy],
    ['history','workspace_cleanup',{workspace,history:true},destroy],
    ['checkout-history','workspace_cleanup',{workspace,worktree:true,history:true},destroy],
    ['discard-history','workspace_cleanup',{workspace,worktree:true,history:true,discard_changes:true},destroy],
    ['assessment','workspace_cleanup',{workspace,dry_run:true},allow],
    ['assessment-resource-conflict','workspace_cleanup',{workspace,dry_run:true,history:true},allow],
    ['assessment-malformed','workspace_cleanup',{workspace,dry_run:'true',history:true},destroy],
    ['missing-workspace','workspace_cleanup',{},destroy],
    ['repair-preview','repair',{workspace},allow],
    ['repair-apply','repair',{workspace,dry_run:false},change],
    ['provider-removal-unknown','worktree_remove',{path:'/outside/acme'},review],
    ['provider-branch-unknown','branch_remove',{repo:'acme',branch:'feature',force:true},review],
    ['docs','docs_read',{path:'workspaces.md'},allow],
    ['docs-invalid-path','docs_read',{path:'../../private.md'},allow],
    ['unknown','cleanup_unknown',{},review],
  ];
  const binding = {box:{transport:{type:'stdio',command:'box',args:['mcp','serve'],env:{}},
    agents:{codex:'box'},packs:{'canonic/box':'box'}}};
  const rows = [];
  for (const profile of ['loose','recommended','strict']) {
    for (const outside of [false,true]) {
      for (const [name,args,decisions] of cli) {
        rows.push({name:`cli-${name}-${profile}-${outside}`,profile,
          argv:['box',...(outside?['--project','/outside/other']:[]),...args],
          expected:outside && decisions[profile] === 'allow'?'ask':decisions[profile]});
      }
      for (const [name,tool,args,decisions] of mcp) {
        // Explicit-project cleanup retains its frozen destructive boundary,
        // including Strict denial for previews in another project.
        const expected = outside && tool === 'workspace_cleanup' ? destroy[profile]
          : outside && !tool.startsWith('docs_') && decisions[profile] === 'allow' ? 'ask'
          : decisions[profile];
        rows.push({name:`mcp-${name}-${profile}-${outside}`,profile,mcp:binding,
          input:{kind:'mcp',server:'box',tool,arguments:{...args,...(outside?{project:'/outside/other'}:{})},original_input:{}},
          expected});
      }
    }
  }
  const temp = mkdtempSync(join(tmpdir(),'box-cleanup-pack-'));
  try {
    const path = join(temp,'cases.json');
    writeFileSync(path,JSON.stringify({schema_version:1,cases:rows}));
    const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
      '--pack',new URL('pack.yml',directory).pathname,'--cases',path],
      {encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row => !row.passed) ?? report)+result.stderr);
    assert.equal(report.passed,true);
    for (const transport of [
      {type:'stdio',command:'box',args:['mcp','serve','--project','/outside/other'],env:{}},
      {type:'http',url:'https://example.com/mcp'},
    ]) {
      const mismatched = structuredClone(binding);
      mismatched.box.transport = transport;
      writeFileSync(path,JSON.stringify({schema_version:1,cases:[{...rows.find(row => row.input),mcp:mismatched}]}));
      const refused = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
        '--pack',new URL('pack.yml',directory).pathname,'--cases',path],{encoding:'utf8',timeout:120000});
      assert.equal(refused.status,2,refused.stdout+refused.stderr);
      assert.match(refused.stdout,/connection does not match its pack integration/);
    }
  } finally {rmSync(temp,{recursive:true,force:true});}
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
