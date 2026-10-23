import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {releases, directory, compatiblePack, compatibleCases} from './build-shield-04-packs.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor} from './pack-formats.mjs';

const read = (release, name) => JSON.parse(readFileSync(new URL(name, directory(release))));
for (const release of releases) {
  test(`${release.name} ${release.version} is reproducible and preserves retained release scope`, async () => {
    const pack = read(release, 'pack.yml');
    for (const name of ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE']) {
      assert.ok(readFileSync(new URL(name, directory(release))).length <= 1_048_576, `${release.name}/${name} must fit the registry acquisition bound`);
    }
    assert.deepEqual(pack, await compatiblePack(release));
    assert.deepEqual(read(release, 'cases.json'), await compatibleCases(release));
    const validate = schemaValidator(schema);
    for (const name of ['pack.yml', 'cases.json']) assert.equal(validate(read(release, name)), true, JSON.stringify(validate.errors));
    const old = JSON.parse(readFileSync(new URL('pack.yml', directory(release, release.from))));
    assert.deepEqual(pack.capabilities, old.capabilities);
    assert.deepEqual(pack.engines, {shield:release.range});
    const withoutPagers = rules => rules.filter(rule => !['read-less', 'read-more'].includes(rule.id));
    if (release.name === 'baseline') {
      assert.deepEqual(withoutPagers(pack.rules), withoutPagers(old.rules));
      const before = JSON.parse(readFileSync(new URL('cases.json', directory(release, release.from))));
      for (const [index, fixture] of read(release, 'cases.json').cases.entries()) {
        assert.deepEqual({...fixture, expected:before.cases[index].expected}, before.cases[index]);
        if (fixture.expected !== before.cases[index].expected) assert.match(fixture.argv[0], /^(less|more)$/);
      }
    } else {
      assert.deepEqual({...pack, version:old.version, engines:old.engines}, old);
      assert.deepEqual(readFileSync(new URL('cases.json', directory(release))), readFileSync(new URL('cases.json', directory(release, release.from))));
    }
    for (const name of ['commands.json', 'LICENSE']) assert.deepEqual(readFileSync(new URL(name, directory(release))), readFileSync(new URL(name, directory(release, release.from))));
  });

  test(`${release.name} ${release.version} admits and passes every production fixture`, {skip:!process.env.SHIELD_BINARY}, t => {
    const binary = shieldFor(read(release, 'pack.yml'));
    assert.ok(binary, 'The compatibility release must admit on the selected Shield.');
    const result = spawnSync(binary, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory(release)).pathname,
      '--cases', new URL('cases.json', directory(release)).pathname], {encoding:'utf8', timeout:120000, maxBuffer:16*1024*1024});
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(fixture => !fixture.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, read(release, 'cases.json').cases.length);
  });
}

test('Baseline 0.8 keeps pager helpers and interactive commands behind review in all profiles', {skip:!process.env.SHIELD_BINARY}, t => {
  const owner = mkdtempSync(join(tmpdir(), 'shield-04-pagers-'));
  t.after(() => rmSync(owner, {recursive:true, force:true}));
  const cases = [];
  for (const profile of ['loose', 'recommended', 'strict']) for (const source of [
    'less README.md', 'more README.md', '/usr/bin/less -F README.md', '/bin/more README.md',
    'less -o log.txt README.md', 'less +!helper README.md', 'more +!helper README.md',
    'less /shield-baseline-unapproved/item', 'more /shield-baseline-unapproved/item',
    "LESSOPEN='|helper %s' less README.md", "LESSCLOSE='helper %s %s' less README.md",
    "LESS='+!helper' less README.md", "MORE='+!helper' more README.md", 'less README.md | head -5',
  ]) cases.push({name:`pager-${profile}-${cases.length}`, profile, expected:'ask', input:{kind:'shell', source, dialect:'posix', dialect_version:null, original_input:{command:source}}});
  const path = join(owner, 'cases.json');
  writeFileSync(path, JSON.stringify({schema_version:1, cases}));
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory(releases[0])).pathname, '--cases', path], {encoding:'utf8', timeout:120000, maxBuffer:4*1024*1024});
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(fixture => !fixture.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, cases.length);
});
