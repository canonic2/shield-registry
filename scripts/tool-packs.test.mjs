import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {packs} from './build-tool-packs.mjs';
import {casesFor, destination} from './build-tool-cases.mjs';
import {destinationOf} from './tool-pack.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {shieldFor, compatibleDirectory} from './pack-formats.mjs';

const read = (pack, name) => JSON.parse(readFileSync(new URL(name, destinationOf(pack))));
const shortName = pack => pack.id.split('/')[1];

for (const pack of packs()) {
  const name = shortName(pack);

  test(`${name} pack sources match the reviewed data and fixtures`, () => {
    assert.deepEqual(read(pack, 'pack.yml'), pack);
    assert.deepEqual(read(pack, 'cases.json').cases, casesFor(name));
    const validate = schemaValidator(schema);
    for (const document of [pack, read(pack, 'cases.json')]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
    assert.deepEqual(read(pack, 'commands.json').commands, [{name, rule_ids: pack.rules.filter(rule => rule.conditions.domain === 'argv').map(rule => rule.id)}]);
    assert.equal(new Set(pack.rules.map(rule => rule.id)).size, pack.rules.length);
  });

  test(`${name} decisions, alone and with Baseline, use production evaluation`, {skip: !process.env.SHIELD_BINARY}, t => {
    if (!shieldFor(pack)) return t.skip(`${name} ${pack.version} needs Shield ${pack.engines.shield}`);
    const owner = mkdtempSync(join(tmpdir(), `shield-${name}-cases-`));
    t.after(() => rmSync(owner, {recursive: true, force: true}));
    const run = (cases, ...args) => {
      const path = join(owner, 'cases.json');
      writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
      const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', destination(name)).pathname,
        '--cases', path, ...args], {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
      const report = JSON.parse(result.stdout || '{}');
      assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(c => !c.passed) ?? report) + result.stderr);
    };
    const cases = read(pack, 'cases.json').cases;
    run(cases);

    // Each command of a compound request is decided separately, and inline
    // environment assignments keep Shield's own review.
    const shell = (id, profile, source, expected) => ({name: `${id}-${profile}`, profile,
      input: {kind: 'shell', source, dialect: 'posix', dialect_version: null, original_input: {}}, expected});
    const shellCases = ['loose', 'recommended', 'strict'].flatMap(profile => [
      shell('shell-inspect', profile, `${name} --version && ${name} --help`, 'allow'),
      shell('shell-inline-env', profile, `ACME_TOKEN=x ${name} --version`, 'ask'),
    ]);
    if (name === 'box') for (const profile of ['loose', 'recommended', 'strict']) {
      const expected = profile === 'strict' ? 'deny' : 'ask';
      shellCases.push(
        shell('shell-shortcut-status', profile, 'box --json -- status', expected),
        shell('shell-shortcut-output', profile, 'box --json -- content export --output plan.json', expected));
    }
    run(shellCases);

    // Baseline yields its generic review to these packs; no decision changes.
    const baseline = compatibleDirectory(['0.10.0', '0.9.0', '0.8.1'].map(version => new URL(`../packs/canonic/baseline/${version}/`, import.meta.url)));
    assert.ok(baseline, 'A current Baseline release must admit on the selected Shield.');
    run(cases, '--with-pack', new URL('pack.yml', baseline).pathname);
  });
}
