import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentToolVersions,currentDirectory,currentToolPack} from './build-current-tool-packs.mjs';
import {currentToolCases} from './current-tool-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

for (const name of Object.keys(currentToolVersions)) {
  test(`${name} current surface reproduces from frozen sources and independent fixtures`,async()=>{
    const pack = await currentToolPack(name);
    const cases = await currentToolCases(name);
    const validate = schemaValidator(schema);
    for (const [file,document] of [['pack.yml',pack],['cases.json',cases]]) {
      const bytes = readFileSync(new URL(file,currentDirectory(name)));
      assert.ok(bytes.length <= 1_048_576,`${name} ${file}: artifact limit`);
      assert.deepEqual(JSON.parse(bytes),document);
      assert.equal(validate(document),true,JSON.stringify(validate.errors));
    }
    const previous = JSON.parse(readFileSync(new URL('pack.yml',currentDirectory(name,'0.2.1'))));
    for (const old of previous.rules) {
      const next = pack.rules.find(row=>row.id===old.id);
      assert.ok(next,old.id);
      if (old.id==='mcp-unlisted' || name==='testrun' && ['mcp-act','mcp-browser_connect','browser-connect'].includes(old.id)) continue;
      assert.deepEqual(next,old,old.id);
    }
    const ids = pack.rules.map(row=>row.id);
    assert.equal(new Set(ids).size,ids.length);
    assert.deepEqual(pack.mcp_integrations[name].fields['/args'],{exact:['mcp','serve']});
  });
  test(`${name} new and retained decisions use the production evaluator`,{skip:!process.env.SHIELD_BINARY},()=>{
    const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
      '--pack',new URL('pack.yml',currentDirectory(name)).pathname,
      '--cases',new URL('cases.json',currentDirectory(name)).pathname],
    {encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
    const report = JSON.parse(result.stdout||'{}');
    assert.equal(result.status,0,JSON.stringify(report.cases?.filter(row=>!row.passed)??report)+result.stderr);
    assert.equal(report.passed,true);
  });
  test(`${name} a launch with extra project arguments cannot gain this pack`,{skip:!process.env.SHIELD_BINARY},()=>{
    const dir = mkdtempSync(join(tmpdir(),'current-pack-launch-'));
    try {
      const binding = {[name]:{transport:{type:'stdio',command:name,args:['mcp','serve','--project','/outside/other'],env:{}},
        agents:{codex:name},packs:{[`canonic/${name}`]:name}}};
      const cases = join(dir,'cases.json');
      writeFileSync(cases,JSON.stringify({schema_version:1,cases:[{name:'other-project',profile:'recommended',mcp:binding,
        input:{kind:'mcp',server:name,tool:'docs_read',arguments:{path:'README.md'},original_input:{}},expected:'allow'}]}));
      const result = spawnSync(process.env.SHIELD_BINARY,['__internal','test-pack',
        '--pack',new URL('pack.yml',currentDirectory(name)).pathname,'--cases',cases],{encoding:'utf8',timeout:120000});
      assert.equal(result.status,2,result.stdout+result.stderr);
      assert.match(result.stdout,/connection does not match its pack integration/);
    } finally {rmSync(dir,{recursive:true,force:true});}
  });
}
