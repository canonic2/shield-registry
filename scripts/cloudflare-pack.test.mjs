import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {cloudflarePack, cloudflareInventory, commands, discoveryCommands} from './cloudflare-policy.mjs';
import {cloudflareCases} from './cloudflare-cases.mjs';
import {directory, guide} from './build-cloudflare-pack.mjs';
import {wranglerOperations, wranglerCompatibilityOperations, cloudflaredOperations, cloudflaredCompatibilityOperations} from './cloudflare-inventory.mjs';
import {schemaValidator} from './schema-validation.mjs';
import {schema} from './policy-schema.mjs';
import {caseFileNames, splitCaseFiles} from './fixture-files.mjs';
import {checkPublication} from './registry-release.mjs';

test('Cloudflare authenticates the publication baseline and preserves any published bytes', async () => {
  const catalog = await checkPublication(new URL('../public/', import.meta.url).pathname,
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  if (catalog.releases.some(row => row.id === 'canonic/cloudflare' && row.version === '0.1.0'))
    for (const file of ['pack.yml', 'commands.json', 'README.md', 'LICENSE', ...await caseFileNames(directory)])
      assert.deepEqual(readFileSync(new URL(file, directory)),
        readFileSync(new URL(`../public/packs/canonic/cloudflare/0.1.0/${file}`, import.meta.url)), `Published ${file} requires a successor`);
});

test('Cloudflare sources reproduce schema-valid bounded artifacts and discovery', async () => {
  const pack = cloudflarePack();
  const validate = schemaValidator(schema);
  const fixtures = splitCaseFiles(cloudflareCases());
  assert.deepEqual(await caseFileNames(directory), fixtures.map(([name]) => name));
  for (const [file, document] of [['pack.yml', pack], ...fixtures]) {
    const bytes = readFileSync(new URL(file, directory));
    assert.ok(bytes.length <= 1_048_576, `${file}: ${bytes.length}`);
    assert.equal(bytes.toString(), JSON.stringify(document, null, file === 'pack.yml' ? 0 : 2) + '\n');
    assert.equal(validate(document), true, JSON.stringify(validate.errors));
  }
  assert.equal(readFileSync(new URL('README.md', directory), 'utf8'), guide);
  assert.deepEqual(readFileSync(new URL('LICENSE', directory)), readFileSync(new URL('../LICENSE', import.meta.url)));
  assert.deepEqual(JSON.parse(readFileSync(new URL('commands.json', directory))), cloudflareInventory(pack));
  assert.equal(new Set(pack.rules.map(row => row.id)).size, pack.rules.length);
  assert.deepEqual([...new Set(cloudflareInventory(pack).commands.flatMap(row => row.rule_ids))].sort(), pack.rules.map(row => row.id).sort());
  const manifest = JSON.parse(readFileSync(new URL('../release.json', import.meta.url)));
  assert.equal(manifest.packs.filter(path => path === 'packs/canonic/cloudflare/0.1.0/pack.yml').length, 1);
  assert.deepEqual(manifest.commands['canonic/cloudflare'], discoveryCommands);
});

test('Every current/compatibility operation has independent fixture decisions across profiles', () => {
  const cases = cloudflareCases().cases;
  assert.equal(new Set(cases.map(row => row.name)).size, cases.length);
  for (const profile of ['loose', 'recommended', 'strict']) {
    const fixtures = cases.filter(row => row.profile === profile && row.argv);
    for (const name of commands) assert.ok(fixtures.some(row => row.argv[0] === name), `${name}: ${profile}`);
    for (const [name, operations] of [['wrangler', [...wranglerOperations, ...wranglerCompatibilityOperations]],
      ['cloudflared', [...cloudflaredOperations, ...cloudflaredCompatibilityOperations]]]) {
      assert.equal(new Set(operations).size, operations.length, name);
      for (const operation of operations) {
        const argv = [name, ...operation.split(' ')];
        assert.ok(fixtures.some(row => JSON.stringify(row.argv) === JSON.stringify(argv)), `${argv.join(' ')}: ${profile}`);
      }
    }
  }
});

test('Production Shield verifies Cloudflare decisions alone and with Baseline/Node/Bun', {skip: !process.env.SHIELD_BINARY}, async t => {
  const companions = ['baseline/0.17.0', 'node/0.5.1', 'bun/0.1.0'].map(path =>
    new URL(`../packs/canonic/${path}/pack.yml`, import.meta.url).pathname);
  let count = 0;
  for (const file of await caseFileNames(directory)) for (const withPacks of [[], companions]) {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--pack', new URL('pack.yml', directory).pathname,
      '--cases', new URL(file, directory).pathname, ...withPacks.flatMap(path => ['--with-pack', path])],
    {encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, JSON.parse(readFileSync(new URL(file, directory))).cases.length);
    if (!withPacks.length) count += report.cases.length;
  }
  assert.equal(count, cloudflareCases().cases.length);
  t.diagnostic(`Evaluated ${count} independent decisions alone and with Baseline/Node/Bun.`);
});
