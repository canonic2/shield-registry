import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {destination, guide, interfaceAddressRelease, previous} from './build-baseline-interface-address.mjs';
import {schema} from './policy-schema.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = (name, root = destination) => readFileSync(new URL(name, root));
const json = (name, root) => JSON.parse(read(name, root));
const packPath = fileURLToPath(new URL('pack.yml', destination));

function assertDecisions(args, count, cwd) {
  const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', ...args], {
    cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout || '{}');
  assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
  assert.equal(report.passed, true);
  assert.equal(report.cases.length, count);
}

test('Baseline interface address candidate adds one rule and retains earlier rules and fixtures', async () => {
  for (const [name, document] of Object.entries(await interfaceAddressRelease())) assert.deepEqual(json(name), document);
  const pack = json('pack.yml');
  const prior = json('pack.yml', previous);
  assert.equal(pack.rules.pop().id, 'ipconfig-interface-address');
  assert.deepEqual(pack, {...prior, version: '0.21.2'});
  assert.equal(read('README.md').toString(), guide);
  for (const name of ['cases.json', 'LICENSE']) assert.deepEqual(read(name), read(name, previous));
  const priorCases = json('cases-2.json', previous).cases;
  assert.deepEqual(json('cases-2.json').cases.slice(0, priorCases.length), priorCases);
  const validate = schemaValidator(schema);
  for (const name of ['pack.yml', 'cases.json', 'cases-2.json']) assert.equal(validate(json(name)), true, JSON.stringify(validate.errors));
  const manifest = json('../release.json', import.meta.url);
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/baseline/0.21.2/pack.yml').length, 1);
});

test('Production Shield evaluates both Baseline interface address fixture files',
  {skip: !process.env.SHIELD_BINARY}, () => {
    for (const name of ['cases.json', 'cases-2.json']) {
      const path = fileURLToPath(new URL(name, destination));
      assertDecisions(['--pack', packPath, '--cases', path], json(name).cases.length);
    }
  });

test('Production Shield recognizes the exact Baseline 0.21.2 artifact for checked reads',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const cwd = mkdtempSync(join(tmpdir(), 'shield-baseline-candidate-'));
    t.after(() => rmSync(cwd, {recursive: true, force: true}));
    mkdirSync(join(cwd, 'src'));
    writeFileSync(join(cwd, 'src', 'first.txt'), 'first\n');
    writeFileSync(join(cwd, 'src', 'second.txt'), 'second\n');

    const context = {docker_contexts: ['acme']};
    const commands = [
      ['container-grep', 'docker --context acme container exec app grep -n example /app/README.md',
        context, ['allow', 'allow', 'deny']],
      ['unreviewed-context', 'docker --context other exec app grep example /app/README.md',
        context, ['deny', 'deny', 'deny']],
      ['recursive-container-grep', 'docker --context acme exec app grep -r example /app',
        context, ['deny', 'deny', 'deny']],
    ];
    if (process.platform !== 'win32') {
      commands.push(['checked-find', 'find src -type f -exec wc -l {} +', {}, ['allow', 'allow', 'allow']]);
    }
    const cases = ['loose', 'recommended', 'strict'].flatMap((profile, index) =>
      commands.map(([name, source, variables, decisions]) => ({name: `${name}-${profile}`, profile,
        expected: decisions[index], variables, input: {kind: 'shell', source, dialect: 'bash', original_input: {}}})));
    const path = join(cwd, 'cases.json');
    writeFileSync(path, JSON.stringify({schema_version: 1, cases}));
    const docker = fileURLToPath(new URL('../public/packs/canonic/docker/0.2.0/pack.yml', import.meta.url));
    assertDecisions(['--pack', docker, '--with-pack', packPath, '--cases', path], cases.length, cwd);
  });
