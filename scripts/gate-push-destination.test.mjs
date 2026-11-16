import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {currentDirectory} from './build-current-tool-packs.mjs';
import {currentToolCases} from './current-tool-cases.mjs';

test('published and candidate Gate packs preserve destination and lease decisions',
  {skip:!process.env.SHIELD_BINARY}, async () => {
    const {cases} = await currentToolCases('gate');
    const selected = cases.filter(row => row.name.startsWith('current-cli-push-destination')
      || row.name.startsWith('current-mcp-push-destination'));
    assert.equal(selected.length,36,'all destination forms across all profiles');
    const directory = mkdtempSync(join(tmpdir(),'gate-push-destination-'));
    try {
      const fixture = join(directory,'cases.json');
      writeFileSync(fixture,JSON.stringify({schema_version:1,cases:selected}));
      for (const version of ['0.2.6',undefined]) {
        const pack = new URL('pack.yml',currentDirectory('gate',version));
        const result = spawnSync(process.env.SHIELD_BINARY,
          ['__internal','test-pack','--pack',pack.pathname,'--cases',fixture],
          {encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
        assert.equal(result.status,0,result.stdout+result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.passed,true);
        assert.equal(report.cases.length,selected.length);
      }
    } finally {
      rmSync(directory,{recursive:true,force:true});
    }
  });
