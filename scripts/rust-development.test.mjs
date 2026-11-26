import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {destination, guide, previous, rustCases, rustPack} from './build-rust-development.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication} from './registry-release.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = (name, root = destination) => readFileSync(new URL(name, root));

test('Rust development extends the authenticated published release', async () => {
  const publicDirectory = new URL('../public/', import.meta.url);
  const catalog = await checkPublication(fileURLToPath(publicDirectory),
    read('../keys/main.pub', import.meta.url).toString().trim());
  const manifest = JSON.parse(read('../release.json', import.meta.url));
  const files = ['pack.yml', 'cases.json', 'commands.json', 'README.md', 'LICENSE'];
  for (const [source, version] of [[previous, '0.2.1'], [destination, '0.2.2']]) {
    const path = `packs/canonic/rust/${version}/pack.yml`;
    const published = (catalog.releases ?? catalog.packs).find(row => row.path === path);
    assert.equal(manifest.packs.filter(entry => entry === path).length, 1);
    if (source === previous) assert.ok(published, 'Rust baseline must be published');
    if (published) {
      const publishedDirectory = new URL('.', new URL(path, publicDirectory));
      for (const file of files) assert.deepEqual(read(file, source), read(file, publishedDirectory));
    }
  }
});

test('Rust development sources reproduce the candidate and preserve path and profile boundaries', async () => {
  const prior = JSON.parse(read('pack.yml', previous));
  const pack = JSON.parse(read('pack.yml'));
  const cases = JSON.parse(read('cases.json'));
  assert.deepEqual(pack, await rustPack());
  assert.deepEqual(cases, await rustCases());
  assert.equal(read('README.md').toString(), await guide());
  for (const file of ['commands.json', 'LICENSE']) assert.deepEqual(read(file), read(file, previous));

  const validate = schemaValidator(schema);
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  assert.deepEqual(pack.engines, {shield: '>=0.55.0, <1.0.0'});
  assert.deepEqual(pack.capabilities, [...prior.capabilities, 'executable-path-lists-v1'].sort());
  assert.deepEqual(Object.keys(pack.variables), Object.keys(prior.variables));
  for (const [name, variable] of Object.entries(pack.variables)) {
    assert.equal(variable.type, 'list', name);
    assert.equal(variable.layer, 'local', name);
    assert.equal(variable.items.type, 'string', name);
    assert.deepEqual(variable.discover.slice(0, prior.variables[name].discover.length), prior.variables[name].discover);
    assert.deepEqual(variable.discover.at(-1), {path_search: name.replace(/_executable$/, '')});
  }
  assert.deepEqual(pack.rules.map(rule => rule.id), prior.rules.map(rule => rule.id));
  for (const [index, rule] of pack.rules.entries()) {
    const old = prior.rules[index];
    assert.deepEqual(rule.decision, old.decision, rule.id);
    assert.deepEqual(rule.on_unmet, old.on_unmet, rule.id);
    assert.deepEqual(rule.requirements?.argument_paths?.options, old.requirements?.argument_paths?.options, rule.id);
    assert.deepEqual(rule.requirements?.argument_paths?.operands, old.requirements?.argument_paths?.operands, rule.id);
    if (rule.requirements?.argument_paths)
      assert.deepEqual(rule.requirements.argument_paths.grammar, rule.conditions.arguments, rule.id);
  }
});

test('Production Shield evaluates routine Rust development and adjacent boundaries in all profiles',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack',
      fileURLToPath(new URL('pack.yml', destination)), '--cases', fileURLToPath(new URL('cases.json', destination))],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(read('cases.json')).cases.length);
    t.diagnostic(`Verified ${report.cases.length} Rust decisions.`);
  });
