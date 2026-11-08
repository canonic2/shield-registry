import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {splitCaseFiles,caseFileNames} from './fixture-files.mjs';

test('Fixture partitioning preserves every case and profile at the evaluator boundary', () => {
  for (const count of [1,1024,1025,2049]) {
    const cases = Array.from({length:count},(_,index)=>({name:`case-${index}`,
      profile:['loose','recommended','strict'][index % 3],argv:['acme','inspect'],expected:'ask'}));
    const files = splitCaseFiles({schema_version:1,cases});
    assert.equal(files.length,Math.ceil(count/1024));
    assert.deepEqual(files.flatMap(([,fixture])=>fixture.cases),cases);
    assert.equal(new Set(files.flatMap(([,fixture])=>fixture.cases.map(row=>row.name))).size,count);
    assert.ok(files.every(([,fixture])=>fixture.schema_version===1 && fixture.cases.length<=1024));
    assert.equal(files[0][0],'cases.json');
    if (count>1024) assert.equal(files[1][0],'cases-2.json');
  }
  for (const cases of [[],null,Array(65537).fill({})])
    assert.throws(()=>splitCaseFiles({schema_version:1,cases}),/Fixture collection/);
});

test('Fixture discovery requires the complete consecutive file set', async t => {
  const directory = await mkdtemp(join(tmpdir(),'registry-fixtures-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  await assert.rejects(caseFileNames(directory),/requires/);
  await writeFile(join(directory,'cases.json'),'{}');
  await writeFile(join(directory,'README.md'),'coverage');
  assert.deepEqual(await caseFileNames(directory),['cases.json']);
  await writeFile(join(directory,'cases-3.json'),'{}');
  await assert.rejects(caseFileNames(directory),/consecutive/);
  await writeFile(join(directory,'cases-2.json'),'{}');
  assert.deepEqual(await caseFileNames(directory),['cases.json','cases-2.json','cases-3.json']);
  await writeFile(join(directory,'cases-extra.json'),'{}');
  await assert.rejects(caseFileNames(directory),/consecutive/);
});
