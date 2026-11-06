import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {docsRevisions, docsDirectory, docsToolPack, docsToolCases} from './build-docs-tool-packs.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

for (const [name, [oldVersion, version]] of Object.entries(docsRevisions)) {
  test(`${name} docs tools reproduce and preserve existing rules`, async () => {
    const directory = docsDirectory(name, version);
    const read = file => JSON.parse(readFileSync(new URL(file, directory)));
    const pack = await docsToolPack(name);
    const cases = await docsToolCases(name);
    assert.deepEqual(read('pack.yml'), pack);
    assert.deepEqual(read('cases.json'), cases);
    const validate = schemaValidator(schema);
    for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
    const old = JSON.parse(readFileSync(new URL('pack.yml', docsDirectory(name, oldVersion))));
    for (const rule of old.rules) {
      const next = pack.rules.find(row => row.id === rule.id);
      if (rule.id === 'mcp-unlisted') {
        const copy = structuredClone(next);
        copy.conditions.tool.not.one_of = copy.conditions.tool.not.one_of.filter(tool => !['docs_list','docs_search','docs_read'].includes(tool));
        assert.deepEqual(copy, rule);
      } else assert.deepEqual(next, rule);
    }
  });
  test(`${name} short and legacy docs tools enforce verified server bindings`, {skip:!process.env.SHIELD_BINARY}, () => {
    const directory = docsDirectory(name, version);
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack',
      '--pack',new URL('pack.yml', directory).pathname,'--cases',new URL('cases.json', directory).pathname],
    {encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    const temporary = mkdtempSync(join(tmpdir(), 'docs-binding-'));
    try {
      const original = JSON.parse(readFileSync(new URL('cases.json', directory)));
      const row = structuredClone(original.cases.find(row => row.input?.tool === 'docs_read'));
      const binding = row.mcp[row.input.server];
      binding.transport = {type:'stdio', command:'/outside/fake-server', args:['mcp','serve'], env:{}};
      const file = join(temporary, 'cases.json');
      writeFileSync(file, JSON.stringify({schema_version:1, cases:[row]}));
      const refused = spawnSync(process.env.SHIELD_BINARY, ['__internal','test-pack',
        '--pack',new URL('pack.yml', directory).pathname,'--cases',file], {encoding:'utf8',timeout:120000});
      assert.equal(refused.status, 2, refused.stdout + refused.stderr);
      assert.match(refused.stdout, /connection does not match its pack integration/);
    } finally { rmSync(temporary, {recursive:true, force:true}); }
  });
}
