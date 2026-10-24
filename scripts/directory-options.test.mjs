import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {releases, directory, declaredPack, previousCases} from './build-directory-options.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';

const read = (release, name, version) => JSON.parse(readFileSync(new URL(name, directory(release, version))));
for (const release of releases) {
  test(`${release.name} ${release.version} declares directory options and keeps its other rules`, async () => {
    const pack = read(release, 'pack.yml');
    const previous = read(release, 'pack.yml', release.from);
    assert.deepEqual(pack, await declaredPack(release));
    assert.equal(pack.engines.shield, '>=0.7.0, <1.0.0');
    assert.ok(pack.capabilities.includes('directory-options-v1'));
    assert.deepEqual(pack.directory_options, release.directoryOptions);
    // Only the rules a declaration replaces are removed; every other rule is identical.
    const removed = previous.rules.filter(rule => !pack.rules.some(kept => kept.id === rule.id));
    assert.ok(removed.every(release.replaced));
    assert.deepEqual(pack.rules, previous.rules.filter(rule => !release.replaced(rule)));
    if (release.name === 'node') {
      assert.ok(removed.length > 0);
      assert.ok(pack.rules.some(rule => rule.id.startsWith('corepack-npm-npm-prefix-')), 'Corepack forms keep their rules');
    }
    const validate = schemaValidator(schema);
    for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(release, name)), true, JSON.stringify(validate.errors));
    for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE']) {
      assert.ok(readFileSync(new URL(name, directory(release))).length <= 1_048_576, `${release.name}/${name} must fit acquisition bounds`);
    }
    for (const name of ['commands.json', 'LICENSE']) {
      assert.deepEqual(readFileSync(new URL(name, directory(release))), readFileSync(new URL(name, directory(release, release.from))));
    }
    const earlier = read(release, 'cases.json', release.from).cases;
    assert.deepEqual(read(release, 'cases.json').cases, [...previousCases(release, earlier), ...release.cases]);
    // Only installs into the absent fixture folder change their expectation.
    const changed = previousCases(release, earlier).filter((fixture, index) => fixture.expected !== earlier[index].expected);
    assert.equal(changed.length, release.name === 'node' ? 15 : 0);
  });

  test(`${release.name} ${release.version} passes every fixture on the selected Shield`, {skip:!process.env.SHIELD_BINARY}, () => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory(release)).pathname,
      '--cases', new URL('cases.json', directory(release)).pathname], {encoding:'utf8', timeout:120000, maxBuffer:16*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(fixture => !fixture.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, read(release, 'cases.json').cases.length);
  });
}
