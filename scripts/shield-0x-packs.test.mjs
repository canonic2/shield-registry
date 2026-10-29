import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {releases, directory, compatiblePack} from './build-shield-0x-packs.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {baselinePreviewCases} from './baseline-preview.mjs';

const read = (release, name, version) => JSON.parse(readFileSync(new URL(name, directory(release, version))));
for (const release of releases) {
  test(`${release.name} ${release.version} preserves policy and fixtures with the Shield 0.x compatibility ceiling`, async () => {
    const pack = read(release, 'pack.yml');
    const previous = read(release, 'pack.yml', release.from);
    assert.deepEqual(pack, await compatiblePack(release));
    assert.deepEqual({...pack, version:previous.version, engines:previous.engines}, previous);
    assert.equal(pack.engines.shield, `>=${release.name === 'rust' ? '0.3.0' : '0.2.0'}, <1.0.0`);
    const validate = schemaValidator(schema);
    for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(release, name)), true, JSON.stringify(validate.errors));
    for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE']) {
      assert.ok(readFileSync(new URL(name, directory(release))).length <= 1_048_576, `${release.name}/${name} must fit acquisition bounds`);
    }
    for (const name of ['cases.json', 'commands.json', 'LICENSE']) {
      assert.deepEqual(readFileSync(new URL(name, directory(release))), readFileSync(new URL(name, directory(release, release.from))));
    }
  });

  test(`${release.name} ${release.version} passes every fixture on the selected Shield`, {skip:!process.env.SHIELD_BINARY}, t => {
    const owner = mkdtempSync(join(tmpdir(), 'shield-0x-cases-'));
    t.after(() => rmSync(owner, {recursive: true, force: true}));
    const cases = read(release, 'cases.json');
    if (release.name === 'baseline') cases.cases = baselinePreviewCases(cases.cases);
    const path = join(owner, 'cases.json');
    writeFileSync(path, JSON.stringify(cases));
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory(release)).pathname,
      '--cases', path], {encoding:'utf8', timeout:120000, maxBuffer:16*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(fixture => !fixture.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, read(release, 'cases.json').cases.length);
  });
}
