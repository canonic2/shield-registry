import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {iacPack, tools} from './iac-policy.mjs';
import {iacCases} from './iac-cases.mjs';
import {guide} from './build-iac-packs.mjs';
import {destinationOf} from './tool-pack.mjs';
import {splitCaseFiles, caseFileNames} from './fixture-files.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

for (const id of Object.keys(tools)) {
  test(`${id} artifacts reproduce with schema-valid policy and independent fixtures`, async () => {
    const pack = iacPack(id);
    const directory = destinationOf(pack);
    const fixtures = splitCaseFiles(iacCases(id));
    const validate = schemaValidator(schema);
    assert.deepEqual(await caseFileNames(directory), fixtures.map(([file]) => file));
    for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
      const bytes = readFileSync(new URL(file, directory));
      assert.ok(bytes.length <= 1_048_576);
      assert.deepEqual(JSON.parse(bytes), document);
      assert.equal(validate(document), true, JSON.stringify(validate.errors));
    }
    assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide(id));
    assert.equal(readFileSync(new URL('LICENSE', directory), 'utf8'), readFileSync(new URL('../LICENSE', import.meta.url), 'utf8'));
    const ids = pack.rules.map(rule => rule.id);
    assert.equal(new Set(ids).size, ids.length);
    const inventory = JSON.parse(readFileSync(new URL('commands.json', directory)));
    assert.deepEqual(inventory.commands, [{name: tools[id].executable, rule_ids: ids}]);
    const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
    assert.equal(manifest.packs.filter(path => path === `packs/${pack.id}/${pack.version}/pack.yml`).length, 1);
    assert.deepEqual(manifest.commands[pack.id], [tools[id].executable]);
  });

  test(`production Shield evaluates every independent ${id} decision`, {skip: !process.env.SHIELD_BINARY}, async t => {
    assert.ok(process.env.SHIELD_BINARY, 'Pass --shield PATH; new packs require evaluator validation');
    const directory = destinationOf(iacPack(id));
    let count = 0;
    for (const file of await caseFileNames(directory)) {
      const result = spawnSync(process.env.SHIELD_BINARY,
        ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname, '--cases', new URL(file, directory).pathname],
        {encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024});
      const report = JSON.parse(result.stdout || '{}');
      assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
      assert.equal(report.passed, true);
      assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
      count += report.cases.length;
    }
    assert.equal(count, iacCases(id).cases.length);
    t.diagnostic(`Evaluated all ${count} independent ${id} cases.`);
  });
}
