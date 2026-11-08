import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {workbenchPack} from './workbench-policy.mjs';
import {workbenchCases, requests, binding} from './workbench-cases.mjs';
import {directory, guide} from './build-workbench-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

test('Workbench sources reproduce with independent coverage for all current tool names', () => {
  const pack = workbenchPack();
  const cases = workbenchCases();
  assert.deepEqual(JSON.parse(readFileSync(new URL('pack.yml', directory))), pack);
  assert.deepEqual(JSON.parse(readFileSync(new URL('cases.json', directory))), cases);
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide());
  const validate = schemaValidator(schema);
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  const allow = pack.rules.filter(rule => !rule.fallback);
  assert.deepEqual(allow.map(rule => rule.conditions.tool).sort(), requests.map(([tool]) => tool).sort());
  for (const rule of allow) assert.deepEqual(rule.decision, {loose:'allow', recommended:'allow', strict:'allow'});
  assert.equal(pack.rules.at(-1).decision, 'ask');
});

function evaluate(cases) {
  assert.ok(process.env.SHIELD_BINARY, 'Pass --shield PATH; the new pack must not skip evaluator validation');
  const owner = mkdtempSync(join(tmpdir(), 'workbench-pack-'));
  try {
    const path = join(owner, 'cases.json');
    writeFileSync(path, JSON.stringify(cases));
    return spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack','--pack',new URL('pack.yml',directory).pathname,'--cases',path],
      {encoding:'utf8', timeout:30000, maxBuffer:8*1024*1024});
  } finally { rmSync(owner, {recursive:true, force:true}); }
}

test('production Shield allows every known tool across profiles and retains unknown-tool review', {skip:!process.env.SHIELD_BINARY}, () => {
  const result = evaluate(workbenchCases());
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});

test('the Workbench name cannot authorize another executable, wrapper, transport or extra arguments', {skip:!process.env.SHIELD_BINARY}, () => {
  for (const profile of ['loose','recommended','strict']) for (const transport of [
    {type:'stdio',command:'/tmp/forged/workbench',args:['mcp','serve'],env:{}},
    {type:'stdio',command:'workbench-evil',args:['mcp','serve'],env:{}},
    {type:'stdio',command:'sh',args:['-c','workbench mcp serve'],env:{}},
    {type:'stdio',command:'workbench',args:['mcp','serve','--project','/acme/other'],env:{}},
    {type:'stdio',command:'workbench',args:['mcp','setup'],env:{}},
    {type:'http',url:'https://example.com/mcp'},
  ]) {
    const result = evaluate({schema_version:1,cases:[{name:'foreign-transport',profile,mcp:binding(transport),
      input:{kind:'mcp',server:'workbench',tool:'view_set',arguments:{},original_input:{}},expected:'allow'}]});
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout, /connection does not match its pack integration/);
  }
});

test('optional installed Workbench catalog agrees with the reviewed inventory', {skip:!process.env.WORKBENCH_BINARY}, () => {
  const result = spawnSync(process.env.WORKBENCH_BINARY, ['mcp','serve','--check'], {encoding:'utf8',timeout:10000});
  assert.equal(result.status, 0, result.stderr);
  const catalog = JSON.parse(result.stdout);
  assert.deepEqual(catalog.tools.map(tool => tool.name).sort(), requests.map(([tool]) => tool).sort());
});
