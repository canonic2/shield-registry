import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {previous, destination, ruleId, metadataPack, metadataCommands, metadataReleaseCases, guide} from './build-baseline-rsync-metadata.mjs';
import {rsyncMetadataCases} from './rsync-metadata-cases.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));

test('Baseline rsync source reproduces artifacts and preserves every prior rule and fixture', async () => {
  assert.deepEqual(read('pack.yml'), await metadataPack());
  assert.deepEqual(read('commands.json'), await metadataCommands());
  assert.deepEqual(read('cases.json'), await metadataReleaseCases());
  assert.equal(readFileSync(new URL('README.md', destination), 'utf8'), guide());
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(name)), true, JSON.stringify(validate.errors));
  const old = read('pack.yml', previous);
  const pack = read('pack.yml');
  assert.deepEqual({...pack, version: old.version, rules: pack.rules.filter(rule => rule.id !== ruleId)}, old);
  const earlier = read('cases.json', previous).cases;
  assert.deepEqual(read('cases.json').cases.slice(0, earlier.length), earlier);
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/baseline/0.18.0/pack.yml').length, 1);
});

test('Rsync metadata and harmful near misses follow all profiles in production Shield', {skip: !process.env.SHIELD_BINARY}, t => {
  const scratch = mkdtempSync(join(tmpdir(), 'baseline-rsync-'));
  try {
    const cases = rsyncMetadataCases();
    const file = join(scratch, 'cases.json');
    writeFileSync(file, JSON.stringify({schema_version: 1, cases}));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
      new URL('pack.yml', destination).pathname, '--cases', file],
    {encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, cases.length);
    t.diagnostic(`Verified ${cases.length} independent rsync metadata and boundary decisions.`);
  } finally { rmSync(scratch, {recursive: true, force: true}); }
});
