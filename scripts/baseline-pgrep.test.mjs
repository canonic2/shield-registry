import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {baselinePgrepCases, baselinePgrepCommands, baselinePgrepPack, destination, guide, previous} from './build-baseline-pgrep.mjs';
import {schema} from './policy-schema.mjs';
import {checkPublication} from './registry-release.mjs';
import {schemaValidator} from './schema-validation.mjs';

const read = (name, root = destination) => JSON.parse(readFileSync(new URL(name, root)));

test('Baseline pgrep sources reproduce the candidate and preserve the signed predecessor', async () => {
  const publicDirectory = new URL('../public/', import.meta.url);
  const catalog = await checkPublication(fileURLToPath(publicDirectory),
    readFileSync(new URL('../keys/main.pub', import.meta.url), 'utf8').trim());
  const entry = (catalog.releases ?? catalog.packs)
    .find(row => row.id === 'canonic/baseline' && row.version === '0.19.0');
  assert.ok(entry);
  const published = new URL('.', new URL(entry.path, publicDirectory));
  for (const name of ['pack.yml', 'commands.json', 'cases.json', 'README.md', 'LICENSE'])
    assert.deepEqual(readFileSync(new URL(name, previous)), readFileSync(new URL(name, published)));

  const pack = read('pack.yml');
  const cases = read('cases.json');
  const commands = read('commands.json');
  assert.deepEqual(pack, await baselinePgrepPack());
  assert.deepEqual(cases, await baselinePgrepCases());
  assert.deepEqual(commands, await baselinePgrepCommands());
  assert.equal(readFileSync(new URL('README.md', destination), 'utf8'), guide);
  assert.deepEqual(readFileSync(new URL('LICENSE', destination)), readFileSync(new URL('LICENSE', previous)));
  const validate = schemaValidator(schema);
  for (const document of [pack, cases]) assert.equal(validate(document), true, JSON.stringify(validate.errors));
  const {version, rules, ...rest} = pack;
  const earlier = read('pack.yml', previous);
  assert.equal(version, '0.20.0');
  assert.deepEqual({...rest, version: earlier.version, rules: rules.slice(0, -2)}, earlier);
  assert.deepEqual(rules.slice(-2).map(rule => rule.id), ['process-full-match-listing', 'shield-mcp-pack-restore']);
  assert.deepEqual(commands.commands.find(row => row.name === 'pgrep')?.rule_ids,
    ['process-lookup', 'process-full-match-listing']);
  assert.equal(read('../release.json', import.meta.url).packs
    .filter(path => path === 'packs/canonic/baseline/0.20.0/pack.yml').length, 1);
});

test('Production Shield verifies Baseline decisions, locked pack recovery and the PID-only hint',
  {skip: !process.env.SHIELD_BINARY}, t => {
    const result = spawnSync(process.env.SHIELD_BINARY, ['__internal', 'test-pack', '--details', '--pack',
      fileURLToPath(new URL('pack.yml', destination)), '--cases', fileURLToPath(new URL('cases.json', destination))],
    {encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024});
    assert.ifError(result.error);
    const report = JSON.parse(result.stdout || '{}');
    assert.equal(result.status, 0, JSON.stringify(report.cases?.filter(row => !row.passed) ?? report) + result.stderr);
    assert.equal(report.passed, true);
    assert.equal(report.cases.length, read('cases.json').cases.length);
    const listing = report.cases.filter(row => row.name.startsWith('pgrep-build-listing-'));
    assert.equal(listing.length, 3);
    for (const row of listing) {
      assert.equal(row.actual, 'deny');
      const guidance = row.evaluation.guidance.find(item => item.rule_ref.rule_id === 'process-full-match-listing');
      assert.match(guidance?.message ?? '', /drop -l and retry with pgrep -f/);
      assert.match(guidance?.message ?? '', /one-time approval/);
    }
    t.diagnostic(`Verified ${report.cases.length} Baseline decisions.`);
  });
